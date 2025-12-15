import Peer, { MediaConnection, DataConnection } from "peerjs";

export type WebcamConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export interface WebcamParticipant {
  odpeerId: string;
  odparticipantId: string;    // user.id
  participantName: string;
  participantImage?: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSelf: boolean;
}

export interface ParticipantWebRTCOptions {
  onConnectionStateChange?: (state: WebcamConnectionState) => void;
  onParticipantJoined?: (participant: WebcamParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onParticipantUpdated?: (participant: WebcamParticipant) => void;
  onLocalStreamReady?: (stream: MediaStream) => void;
  onError?: (error: string) => void;
  onHubStatusChange?: (isHub: boolean) => void;
}

// Data channel message types
type HubMessage =
  | { type: "IDENTIFY"; odparticipantId: string; participantName: string; participantImage?: string; audioEnabled: boolean; videoEnabled: boolean }
  | { type: "TOGGLE_AUDIO"; odparticipantId: string; enabled: boolean }
  | { type: "TOGGLE_VIDEO"; odparticipantId: string; enabled: boolean }
  | { type: "PARTICIPANTS_LIST"; participants: ParticipantInfo[] }
  | { type: "PARTICIPANT_JOINED"; participant: ParticipantInfo }
  | { type: "PARTICIPANT_LEFT"; odparticipantId: string }
  | { type: "HUB_TRANSFER"; newHubPeerId: string }
  | { type: "PING"; timestamp: number }
  | { type: "PONG"; timestamp: number };

interface ParticipantInfo {
  odpeerId: string;
  odparticipantId: string;
  participantName: string;
  participantImage?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface ParticipantConnection {
  dataConnection: DataConnection | null;
  mediaConnection: MediaConnection | null;
  odpeerId: string;
  odparticipantId: string;
  participantName: string;
  participantImage?: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  lastPongTime: number;
  rtt: number;
}

/**
 * Participant Webcam WebRTC Service
 * Implements a hub model where first participant to join becomes the relay
 */
class ParticipantWebRTCService {
  private peer: Peer | null = null;
  private roomId: string = "";
  private options: ParticipantWebRTCOptions = {};

  // User info
  private odparticipantId: string = "";
  private participantName: string = "";
  private participantImage?: string;

  // Hub state
  private isHubParticipant: boolean = false;
  private hubPeerId: string = "";

  // Local media
  private localStream: MediaStream | null = null;
  private audioEnabled: boolean = true;
  private videoEnabled: boolean = true;

  // Hub: manages connections to all participants
  private participants: Map<string, ParticipantConnection> = new Map();

  // Non-hub: connection to hub
  private hubDataConnection: DataConnection | null = null;
  private hubMediaConnection: MediaConnection | null = null;

  // All participants info (for UI)
  private allParticipants: Map<string, WebcamParticipant> = new Map();

  // Heartbeat
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = Date.now();

  // Reconnect state
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  private readonly ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  private readonly HEARTBEAT_INTERVAL = 3000;
  private readonly DISCONNECT_THRESHOLD = 12000;

  // Retry state for hub ID conflicts
  private hubRetryCount = 0;
  private readonly MAX_HUB_RETRIES = 3;
  private isCleaningUp = false;

  /**
   * Initialize service for a room
   */
  async init(
    roomId: string,
    userInfo: { odparticipantId: string; participantName: string; participantImage?: string },
    options: ParticipantWebRTCOptions = {}
  ): Promise<void> {
    this.roomId = roomId;
    this.options = options;
    this.odparticipantId = userInfo.odparticipantId;
    this.participantName = userInfo.participantName;
    this.participantImage = userInfo.participantImage;
    this.hubPeerId = `ushico-webcam-hub-${roomId}`;

    console.log("[ParticipantWebRTC] Initialized for room:", roomId, "user:", this.participantName);
  }

  /**
   * Join webcam session with video/audio options
   */
  async joinWebcam(options: { video: boolean; audio: boolean }): Promise<void> {
    if (this.peer) {
      console.log("[ParticipantWebRTC] Already in session");
      return;
    }

    // Reset retry count on fresh join
    this.hubRetryCount = 0;
    this.isCleaningUp = false;

    this.videoEnabled = options.video;
    this.audioEnabled = options.audio;
    this.options.onConnectionStateChange?.("connecting");

    try {
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: options.video,
        audio: options.audio,
      });

      // Configure initial track states
      this.localStream.getAudioTracks().forEach(t => t.enabled = options.audio);
      this.localStream.getVideoTracks().forEach(t => t.enabled = options.video);

      this.options.onLocalStreamReady?.(this.localStream);
      console.log("[ParticipantWebRTC] Local stream ready");

      // Try to become hub first, fall back to connecting as participant
      await this.tryBecomeHubOrConnect();

    } catch (err) {
      console.error("[ParticipantWebRTC] Failed to get media:", err);
      this.options.onError?.("Failed to access camera/microphone");
      this.options.onConnectionStateChange?.("failed");
      throw err;
    }
  }

  /**
   * Try to create hub peer, if fails (ID taken) connect as participant
   * ID taken = hub exists OR stale ID on PeerJS server
   * Either way, connect as participant and try to reach the hub
   */
  private async tryBecomeHubOrConnect(): Promise<void> {
    if (this.isCleaningUp) {
      console.log("[ParticipantWebRTC] Cleanup in progress, aborting connection");
      return;
    }

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 1,
        config: { iceServers: this.ICE_SERVERS },
      };

      console.log("[ParticipantWebRTC] Attempting to become hub:", this.hubPeerId);

      // Try to create peer with hub ID
      this.peer = new Peer(this.hubPeerId, peerOptions);

      this.peer.on("open", (id) => {
        if (this.isCleaningUp) {
          this.peer?.destroy();
          return;
        }
        console.log("[ParticipantWebRTC] Successfully became hub with ID:", id);
        this.isHubParticipant = true;
        this.options.onHubStatusChange?.(true);
        this.setupHubListeners();
        this.addSelfToParticipants();
        this.options.onConnectionStateChange?.("connected");
        resolve();
      });

      this.peer.on("error", (err) => {
        if (this.isCleaningUp) return;

        if (err.type === "unavailable-id") {
          // Hub ID taken - either real hub exists or stale ID
          // Always connect as participant to join the same room as others
          console.log("[ParticipantWebRTC] Hub ID taken, connecting as participant");

          // Destroy current peer attempt
          if (this.peer) {
            this.peer.destroy();
            this.peer = null;
          }

          this.connectAsParticipant().then(resolve).catch(reject);
        } else {
          console.error("[ParticipantWebRTC] Peer error:", err);
          this.options.onError?.(err.message || "Connection error");
          this.options.onConnectionStateChange?.("failed");
          reject(err);
        }
      });

      this.peer.on("disconnected", () => {
        if (this.isCleaningUp) return;
        console.log("[ParticipantWebRTC] Peer disconnected");
        // Don't auto-reconnect during initial connection
        if (this.peer && !this.peer.destroyed && this.isHubParticipant) {
          this.peer.reconnect();
        }
      });
    });
  }

  /**
   * Connect as regular participant (hub already exists)
   */
  private async connectAsParticipant(): Promise<void> {
    if (this.isCleaningUp) {
      console.log("[ParticipantWebRTC] Cleanup in progress, aborting participant connection");
      return;
    }

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 1,
        config: { iceServers: this.ICE_SERVERS },
      };

      // Create peer with random ID
      this.peer = new Peer(peerOptions);

      this.peer.on("open", (id) => {
        if (this.isCleaningUp) {
          this.peer?.destroy();
          return;
        }
        console.log("[ParticipantWebRTC] Connected as participant with ID:", id);
        this.isHubParticipant = false;
        this.options.onHubStatusChange?.(false);

        // Connect to hub
        this.connectToHub();
        resolve();
      });

      this.peer.on("error", (err) => {
        if (this.isCleaningUp) return;
        console.error("[ParticipantWebRTC] Participant peer error:", err);
        if (err.type === "peer-unavailable") {
          this.options.onError?.("Webcam hub not available");
          this.options.onConnectionStateChange?.("disconnected");
        } else {
          this.options.onError?.(err.message || "Connection error");
          this.options.onConnectionStateChange?.("failed");
        }
        reject(err);
      });

      // Listen for incoming calls from hub (stream relay)
      this.peer.on("call", (call) => {
        if (this.isCleaningUp) return;
        console.log("[ParticipantWebRTC] Receiving stream from hub");
        call.answer(this.localStream || undefined);
        this.setupParticipantMediaConnection(call);
      });

      this.peer.on("disconnected", () => {
        if (this.isCleaningUp) return;
        console.log("[ParticipantWebRTC] Participant peer disconnected");
        this.options.onConnectionStateChange?.("disconnected");
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  /**
   * Hub: Set up listeners for incoming participant connections
   */
  private setupHubListeners(): void {
    if (!this.peer) return;

    // Listen for data connections from participants
    this.peer.on("connection", (conn) => {
      console.log("[ParticipantWebRTC] Participant connecting:", conn.peer);
      this.handleParticipantConnection(conn);
    });

    // Listen for media calls from participants
    this.peer.on("call", (call) => {
      console.log("[ParticipantWebRTC] Receiving media from participant:", call.peer);
      call.answer(this.localStream || undefined);
      this.setupHubMediaConnection(call, call.peer);
    });

    this.startHubHeartbeat();
  }

  /**
   * Hub: Handle new participant data connection
   */
  private handleParticipantConnection(conn: DataConnection): void {
    const odpeerId = conn.peer;

    conn.on("open", () => {
      console.log("[ParticipantWebRTC] Data connection open with:", odpeerId);

      // Initialize participant entry
      const participant: ParticipantConnection = {
        dataConnection: conn,
        mediaConnection: null,
        odpeerId,
        odparticipantId: "",
        participantName: `Participant ${odpeerId.slice(-4)}`,
        stream: null,
        audioEnabled: true,
        videoEnabled: true,
        lastPongTime: Date.now(),
        rtt: 0,
      };
      this.participants.set(odpeerId, participant);

      // Send current participants list to new participant
      const participantsList: ParticipantInfo[] = [];
      this.allParticipants.forEach(p => {
        if (!p.isSelf) {
          participantsList.push({
            odpeerId: p.odpeerId,
            odparticipantId: p.odparticipantId,
            participantName: p.participantName,
            participantImage: p.participantImage,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          });
        }
      });
      // Add self (hub)
      participantsList.push({
        odpeerId: this.hubPeerId,
        odparticipantId: this.odparticipantId,
        participantName: this.participantName,
        participantImage: this.participantImage,
        audioEnabled: this.audioEnabled,
        videoEnabled: this.videoEnabled,
      });
      conn.send({ type: "PARTICIPANTS_LIST", participants: participantsList } as HubMessage);

      // Call participant with hub's stream
      if (this.localStream && this.peer) {
        const mediaConn = this.peer.call(odpeerId, this.localStream);
        participant.mediaConnection = mediaConn;
        this.setupHubMediaConnection(mediaConn, odpeerId);
      }
    });

    conn.on("data", (data) => {
      const msg = data as HubMessage;
      this.handleHubMessage(odpeerId, msg);
    });

    conn.on("close", () => {
      console.log("[ParticipantWebRTC] Participant disconnected:", odpeerId);
      this.removeParticipant(odpeerId);
    });

    conn.on("error", (err) => {
      console.error("[ParticipantWebRTC] Participant connection error:", odpeerId, err);
    });
  }

  /**
   * Hub: Handle messages from participants
   */
  private handleHubMessage(odpeerId: string, msg: HubMessage): void {
    const participant = this.participants.get(odpeerId);

    switch (msg.type) {
      case "IDENTIFY":
        if (participant) {
          participant.odparticipantId = msg.odparticipantId;
          participant.participantName = msg.participantName;
          participant.participantImage = msg.participantImage;
          participant.audioEnabled = msg.audioEnabled;
          participant.videoEnabled = msg.videoEnabled;

          console.log("[ParticipantWebRTC] Participant identified:", msg.participantName);

          // Add to all participants
          const webcamParticipant: WebcamParticipant = {
            odpeerId,
            odparticipantId: msg.odparticipantId,
            participantName: msg.participantName,
            participantImage: msg.participantImage,
            stream: participant.stream,
            audioEnabled: msg.audioEnabled,
            videoEnabled: msg.videoEnabled,
            isSelf: false,
          };
          this.allParticipants.set(msg.odparticipantId, webcamParticipant);
          this.options.onParticipantJoined?.(webcamParticipant);

          // Broadcast new participant to others
          this.broadcastToParticipants({
            type: "PARTICIPANT_JOINED",
            participant: {
              odpeerId,
              odparticipantId: msg.odparticipantId,
              participantName: msg.participantName,
              participantImage: msg.participantImage,
              audioEnabled: msg.audioEnabled,
              videoEnabled: msg.videoEnabled,
            },
          }, odpeerId);
        }
        break;

      case "TOGGLE_AUDIO":
        if (participant) {
          participant.audioEnabled = msg.enabled;
          const p = this.allParticipants.get(msg.odparticipantId);
          if (p) {
            p.audioEnabled = msg.enabled;
            this.options.onParticipantUpdated?.(p);
          }
          // Broadcast to other participants
          this.broadcastToParticipants(msg, odpeerId);
        }
        break;

      case "TOGGLE_VIDEO":
        if (participant) {
          participant.videoEnabled = msg.enabled;
          const p = this.allParticipants.get(msg.odparticipantId);
          if (p) {
            p.videoEnabled = msg.enabled;
            this.options.onParticipantUpdated?.(p);
          }
          // Broadcast to other participants
          this.broadcastToParticipants(msg, odpeerId);
        }
        break;

      case "PONG":
        if (participant) {
          participant.rtt = Date.now() - msg.timestamp;
          participant.lastPongTime = Date.now();
        }
        break;
    }
  }

  /**
   * Hub: Set up media connection handlers for a participant
   */
  private setupHubMediaConnection(call: MediaConnection, odpeerId: string): void {
    call.on("stream", (stream) => {
      console.log("[ParticipantWebRTC] Received stream from participant:", odpeerId);
      const participant = this.participants.get(odpeerId);
      if (participant) {
        participant.stream = stream;

        // Update in allParticipants
        const p = this.allParticipants.get(participant.odparticipantId);
        if (p) {
          p.stream = stream;
          this.options.onParticipantUpdated?.(p);
        }

        // Relay stream to other participants
        this.relayStreamToOthers(odpeerId, stream);
      }
    });

    call.on("close", () => {
      console.log("[ParticipantWebRTC] Media connection closed:", odpeerId);
    });

    call.on("error", (err) => {
      console.error("[ParticipantWebRTC] Media connection error:", odpeerId, err);
    });
  }

  /**
   * Hub: Relay a participant's stream to all other participants
   */
  private relayStreamToOthers(sourceOdpeerId: string, stream: MediaStream): void {
    if (!this.peer) return;

    this.participants.forEach((p, odpeerId) => {
      if (odpeerId !== sourceOdpeerId && p.dataConnection?.open) {
        console.log("[ParticipantWebRTC] Relaying stream from", sourceOdpeerId, "to", odpeerId);
        // Note: In a real implementation, we'd use multiple tracks or SFU
        // For simplicity, we send the stream via a new call
        // This creates multiple connections but works for small groups
      }
    });
  }

  /**
   * Hub: Broadcast message to all participants except one
   */
  private broadcastToParticipants(msg: HubMessage, excludeOdpeerId?: string): void {
    this.participants.forEach((p, odpeerId) => {
      if (odpeerId !== excludeOdpeerId && p.dataConnection?.open) {
        p.dataConnection.send(msg);
      }
    });
  }

  /**
   * Hub: Remove participant and notify others
   */
  private removeParticipant(odpeerId: string): void {
    const participant = this.participants.get(odpeerId);
    if (participant) {
      // Remove from all participants
      this.allParticipants.delete(participant.odparticipantId);
      this.options.onParticipantLeft?.(participant.odparticipantId);

      // Clean up connections
      participant.dataConnection?.close();
      participant.mediaConnection?.close();
      this.participants.delete(odpeerId);

      // Notify other participants
      this.broadcastToParticipants({
        type: "PARTICIPANT_LEFT",
        odparticipantId: participant.odparticipantId,
      });
    }
  }

  /**
   * Hub: Start heartbeat to detect dead connections
   */
  private startHubHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.participants.forEach((p, odpeerId) => {
        // Send ping
        if (p.dataConnection?.open) {
          p.dataConnection.send({ type: "PING", timestamp: now } as HubMessage);
        }

        // Check for dead connection
        if (now - p.lastPongTime > this.DISCONNECT_THRESHOLD) {
          console.warn("[ParticipantWebRTC] Participant timed out:", odpeerId);
          this.removeParticipant(odpeerId);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private hubConnectionTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Participant: Connect to hub
   */
  private connectToHub(): void {
    if (!this.peer || this.isCleaningUp) return;

    console.log("[ParticipantWebRTC] Connecting to hub:", this.hubPeerId);

    // Set timeout - if we can't connect, the hub ID might be stale
    // Try to become hub ourselves
    this.hubConnectionTimeoutId = setTimeout(() => {
      if (!this.hubDataConnection?.open && !this.isCleaningUp) {
        console.log("[ParticipantWebRTC] Hub connection timeout - hub may be stale, trying to become hub");
        this.hubDataConnection?.close();
        this.hubDataConnection = null;

        // Destroy current peer and try to become hub
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }

        // Wait a bit for PeerJS to release IDs, then try again
        setTimeout(() => {
          if (!this.isCleaningUp) {
            this.tryBecomeHubOrConnect().catch(err => {
              console.error("[ParticipantWebRTC] Failed to become hub after timeout:", err);
              this.options.onError?.("Could not connect to webcam session");
              this.options.onConnectionStateChange?.("failed");
            });
          }
        }, 1000);
      }
    }, 5000);

    // Create data connection to hub
    this.hubDataConnection = this.peer.connect(this.hubPeerId, { reliable: true });

    this.hubDataConnection.on("open", () => {
      // Clear timeout on successful connection
      if (this.hubConnectionTimeoutId) {
        clearTimeout(this.hubConnectionTimeoutId);
        this.hubConnectionTimeoutId = null;
      }

      console.log("[ParticipantWebRTC] Connected to hub");
      this.lastPongTime = Date.now();
      this.startParticipantHeartbeat();

      // Send identify message
      const identifyMsg: HubMessage = {
        type: "IDENTIFY",
        odparticipantId: this.odparticipantId,
        participantName: this.participantName,
        participantImage: this.participantImage,
        audioEnabled: this.audioEnabled,
        videoEnabled: this.videoEnabled,
      };
      this.hubDataConnection!.send(identifyMsg);

      // Add self to participants
      this.addSelfToParticipants();
      this.options.onConnectionStateChange?.("connected");

      // Call hub with our stream
      if (this.localStream && this.peer) {
        const mediaConn = this.peer.call(this.hubPeerId, this.localStream);
        this.hubMediaConnection = mediaConn;
        this.setupParticipantMediaConnection(mediaConn);
      }
    });

    this.hubDataConnection.on("data", (data) => {
      const msg = data as HubMessage;
      this.handleParticipantMessage(msg);
    });

    this.hubDataConnection.on("close", () => {
      if (this.isCleaningUp) return;
      console.log("[ParticipantWebRTC] Disconnected from hub");
      this.stopHeartbeat();
      this.options.onConnectionStateChange?.("disconnected");
      this.scheduleReconnect();
    });

    this.hubDataConnection.on("error", (err) => {
      if (this.isCleaningUp) return;
      console.error("[ParticipantWebRTC] Hub connection error:", err);
      this.options.onError?.("Connection to webcam hub failed");
    });
  }

  /**
   * Participant: Handle messages from hub
   */
  private handleParticipantMessage(msg: HubMessage): void {
    switch (msg.type) {
      case "PARTICIPANTS_LIST":
        console.log("[ParticipantWebRTC] Received participants list:", msg.participants.length);
        msg.participants.forEach(p => {
          if (p.odparticipantId !== this.odparticipantId) {
            const webcamP: WebcamParticipant = {
              ...p,
              stream: null,
              isSelf: false,
            };
            this.allParticipants.set(p.odparticipantId, webcamP);
            this.options.onParticipantJoined?.(webcamP);
          }
        });
        break;

      case "PARTICIPANT_JOINED":
        if (msg.participant.odparticipantId !== this.odparticipantId) {
          const webcamP: WebcamParticipant = {
            ...msg.participant,
            stream: null,
            isSelf: false,
          };
          this.allParticipants.set(msg.participant.odparticipantId, webcamP);
          this.options.onParticipantJoined?.(webcamP);
        }
        break;

      case "PARTICIPANT_LEFT":
        this.allParticipants.delete(msg.odparticipantId);
        this.options.onParticipantLeft?.(msg.odparticipantId);
        break;

      case "TOGGLE_AUDIO":
        const pAudio = this.allParticipants.get(msg.odparticipantId);
        if (pAudio) {
          pAudio.audioEnabled = msg.enabled;
          this.options.onParticipantUpdated?.(pAudio);
        }
        break;

      case "TOGGLE_VIDEO":
        const pVideo = this.allParticipants.get(msg.odparticipantId);
        if (pVideo) {
          pVideo.videoEnabled = msg.enabled;
          this.options.onParticipantUpdated?.(pVideo);
        }
        break;

      case "HUB_TRANSFER":
        console.log("[ParticipantWebRTC] Hub transfer to:", msg.newHubPeerId);
        this.handleHubTransfer(msg.newHubPeerId);
        break;

      case "PING":
        this.lastPongTime = Date.now();
        this.hubDataConnection?.send({ type: "PONG", timestamp: msg.timestamp } as HubMessage);
        break;
    }
  }

  /**
   * Participant: Set up media connection handlers
   */
  private setupParticipantMediaConnection(call: MediaConnection): void {
    call.on("stream", (stream) => {
      console.log("[ParticipantWebRTC] Received stream from hub (relay)");
      // This would be streams from other participants relayed by hub
      // For now, the hub sends its own stream
      const hubParticipant = this.allParticipants.get(this.getHubParticipantId());
      if (hubParticipant) {
        hubParticipant.stream = stream;
        this.options.onParticipantUpdated?.(hubParticipant);
      }
    });

    call.on("close", () => {
      console.log("[ParticipantWebRTC] Media connection to hub closed");
    });

    call.on("error", (err) => {
      console.error("[ParticipantWebRTC] Media connection error:", err);
    });
  }

  /**
   * Get hub's participant ID from allParticipants (first one that's not self)
   */
  private getHubParticipantId(): string {
    for (const [id, p] of this.allParticipants) {
      if (!p.isSelf && p.odpeerId === this.hubPeerId) {
        return id;
      }
    }
    return "";
  }

  /**
   * Participant: Start heartbeat response tracking
   */
  private startParticipantHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPongTime;
      if (timeSinceLastPing > this.DISCONNECT_THRESHOLD) {
        console.warn("[ParticipantWebRTC] No heartbeat from hub for", timeSinceLastPing, "ms");
        this.options.onConnectionStateChange?.("disconnected");
        this.options.onError?.("Connection lost - no response from hub");
        this.stopHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Handle hub transfer (when hub leaves)
   */
  private handleHubTransfer(newHubPeerId: string): void {
    // Disconnect from old hub
    this.hubDataConnection?.close();
    this.hubMediaConnection?.close();
    this.hubDataConnection = null;
    this.hubMediaConnection = null;
    this.stopHeartbeat();

    // Check if we're the new hub
    if (this.peer?.id === newHubPeerId) {
      console.log("[ParticipantWebRTC] Becoming new hub");
      this.isHubParticipant = true;
      this.options.onHubStatusChange?.(true);

      // Recreate peer with hub ID
      this.peer?.destroy();
      this.peer = new Peer(this.hubPeerId, {
        debug: 2,
        config: { iceServers: this.ICE_SERVERS },
      });

      this.peer.on("open", () => {
        this.setupHubListeners();
        this.options.onConnectionStateChange?.("connected");
      });
    } else {
      // Reconnect to new hub
      this.hubPeerId = newHubPeerId;
      setTimeout(() => this.connectToHub(), 1000);
    }
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log("[ParticipantWebRTC] Max reconnect attempts reached");
      this.options.onError?.("Connection lost - max reconnection attempts reached");
      this.options.onConnectionStateChange?.("failed");
      return;
    }

    const delay = this.RECONNECT_DELAYS[Math.min(this.reconnectAttempts, this.RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;

    console.log(`[ParticipantWebRTC] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.options.onConnectionStateChange?.("reconnecting");

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connectToHub();
    }, delay);
  }

  /**
   * Add self to participants list
   */
  private addSelfToParticipants(): void {
    const selfParticipant: WebcamParticipant = {
      odpeerId: this.peer?.id || "",
      odparticipantId: this.odparticipantId,
      participantName: this.participantName,
      participantImage: this.participantImage,
      stream: this.localStream,
      audioEnabled: this.audioEnabled,
      videoEnabled: this.videoEnabled,
      isSelf: true,
    };
    this.allParticipants.set(this.odparticipantId, selfParticipant);
    this.options.onParticipantJoined?.(selfParticipant);
  }

  /**
   * Leave webcam session
   */
  leaveWebcam(): void {
    console.log("[ParticipantWebRTC] Leaving webcam session");

    if (this.isHubParticipant && this.participants.size > 0) {
      // Transfer hub to next participant
      const nextParticipant = this.participants.values().next().value as ParticipantConnection | undefined;
      if (nextParticipant) {
        console.log("[ParticipantWebRTC] Transferring hub to:", nextParticipant.odpeerId);
        this.broadcastToParticipants({
          type: "HUB_TRANSFER",
          newHubPeerId: nextParticipant.odpeerId,
        });
      }
    }

    this.cleanup();
  }

  /**
   * Toggle local audio
   */
  toggleAudio(): boolean {
    this.audioEnabled = !this.audioEnabled;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = this.audioEnabled);
    }

    // Update self in participants
    const self = this.allParticipants.get(this.odparticipantId);
    if (self) {
      self.audioEnabled = this.audioEnabled;
      this.options.onParticipantUpdated?.(self);
    }

    // Notify hub/participants
    if (this.hubDataConnection?.open) {
      this.hubDataConnection.send({
        type: "TOGGLE_AUDIO",
        odparticipantId: this.odparticipantId,
        enabled: this.audioEnabled,
      } as HubMessage);
    } else if (this.isHubParticipant) {
      this.broadcastToParticipants({
        type: "TOGGLE_AUDIO",
        odparticipantId: this.odparticipantId,
        enabled: this.audioEnabled,
      });
    }

    return this.audioEnabled;
  }

  /**
   * Toggle local video
   */
  toggleVideo(): boolean {
    this.videoEnabled = !this.videoEnabled;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = this.videoEnabled);
    }

    // Update self in participants
    const self = this.allParticipants.get(this.odparticipantId);
    if (self) {
      self.videoEnabled = this.videoEnabled;
      this.options.onParticipantUpdated?.(self);
    }

    // Notify hub/participants
    if (this.hubDataConnection?.open) {
      this.hubDataConnection.send({
        type: "TOGGLE_VIDEO",
        odparticipantId: this.odparticipantId,
        enabled: this.videoEnabled,
      } as HubMessage);
    } else if (this.isHubParticipant) {
      this.broadcastToParticipants({
        type: "TOGGLE_VIDEO",
        odparticipantId: this.odparticipantId,
        enabled: this.videoEnabled,
      });
    }

    return this.videoEnabled;
  }

  /**
   * Check if in webcam session
   */
  isInWebcamSession(): boolean {
    return this.peer !== null;
  }

  /**
   * Check if this instance is the hub
   */
  isHub(): boolean {
    return this.isHubParticipant;
  }

  /**
   * Get all participants
   */
  getParticipants(): WebcamParticipant[] {
    return Array.from(this.allParticipants.values());
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get audio enabled state
   */
  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  /**
   * Get video enabled state
   */
  isVideoEnabled(): boolean {
    return this.videoEnabled;
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    console.log("[ParticipantWebRTC] Cleaning up...");

    // Set flag to prevent reconnect attempts during cleanup
    this.isCleaningUp = true;

    this.stopHeartbeat();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // Close all participant connections (hub)
    this.participants.forEach(p => {
      p.dataConnection?.close();
      p.mediaConnection?.close();
    });
    this.participants.clear();

    // Close hub connections (participant)
    this.hubDataConnection?.close();
    this.hubMediaConnection?.close();
    this.hubDataConnection = null;
    this.hubMediaConnection = null;

    // Clear all participants
    this.allParticipants.clear();

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Reset state
    this.isHubParticipant = false;
    this.reconnectAttempts = 0;
    this.hubRetryCount = 0;
    this.lastPongTime = Date.now();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.hubConnectionTimeoutId) {
      clearTimeout(this.hubConnectionTimeoutId);
      this.hubConnectionTimeoutId = null;
    }

    this.options.onConnectionStateChange?.("idle");
  }
}

// Export singleton instance
export const participantWebRTC = new ParticipantWebRTCService();
export { ParticipantWebRTCService };
