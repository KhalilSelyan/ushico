import Peer, { MediaConnection, DataConnection } from "peerjs";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";
export type ConnectionQuality = "excellent" | "good" | "poor";
export type StreamSource = "screen" | "file" | "camera";

export interface ViewerInfo {
  peerId: string;
  userName: string;
  userImage?: string;
  dataConnected: boolean;
  mediaConnected: boolean;
  rtt: number;
}

interface ViewerConnection {
  dataConnection: DataConnection | null;
  mediaConnection: MediaConnection | null;
  mediaConnected: boolean; // Track if media is actually flowing
  peerId: string;
  userName: string;
  userImage?: string;
  lastPongTime: number;
  rtt: number;
}

interface RoomWebRTCOptions {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionQualityChange?: (quality: ConnectionQuality, rtt: number) => void;
  onError?: (error: string) => void;
  onViewerCountChange?: (count: number) => void;
  onViewersChange?: (viewers: ViewerInfo[]) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

interface HeartbeatMessage {
  type: "PING" | "PONG";
  timestamp: number;
}

interface IdentifyMessage {
  type: "IDENTIFY";
  userName: string;
  userImage?: string;
}

type DataMessage = HeartbeatMessage | IdentifyMessage;

/**
 * Room-based WebRTC service supporting 1-to-many streaming
 * Host streams to multiple viewers
 */
class RoomWebRTCService {
  private peer: Peer | null = null;
  private isHost: boolean = false;
  private roomId: string = "";
  private options: RoomWebRTCOptions = {};

  // Host: manages multiple viewer connections
  private viewers: Map<string, ViewerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Viewer: single connection to host
  private hostDataConnection: DataConnection | null = null;
  private hostMediaConnection: MediaConnection | null = null;
  private lastPongTime: number = Date.now();
  private rtt: number = 0;
  private currentPeerId: string | null = null;

  // User info (for viewer identification)
  private userName: string = "";
  private userImage?: string;

  // Auto-reconnect configuration (viewer only)
  private autoReconnect = true;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  private readonly ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  private readonly HEARTBEAT_INTERVAL = 2000;
  private readonly DISCONNECT_THRESHOLD = 10000;

  /**
   * Initialize peer connection for a room
   * Host creates peer with known ID: ushico-room-{roomId}
   * Viewers create peer with random ID and connect to host
   */
  private initRetryCount = 0;
  private readonly MAX_INIT_RETRIES = 3;

  async init(
    roomId: string,
    isHost: boolean,
    options: RoomWebRTCOptions = {},
    userInfo?: { userName: string; userImage?: string }
  ): Promise<void> {
    this.options = options;
    this.isHost = isHost;
    this.roomId = roomId;
    if (userInfo) {
      this.userName = userInfo.userName;
      this.userImage = userInfo.userImage;
    }

    // Cleanup any existing connection and wait for it to fully close
    await this.cleanupAsync();

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 2,
        config: {
          iceServers: this.ICE_SERVERS,
        },
      };

      // Host gets known ID (with retry suffix if needed), viewers get random ID
      let peerId: string | undefined;
      if (isHost) {
        // Add retry suffix to avoid "ID taken" errors on reconnect
        peerId = this.initRetryCount > 0
          ? `ushico-room-${roomId}-${this.initRetryCount}`
          : `ushico-room-${roomId}`;
      }

      console.log("[RoomWebRTC] Creating peer with ID:", peerId || "(random)", "isHost:", isHost);

      this.peer = peerId
        ? new Peer(peerId, peerOptions)
        : new Peer(peerOptions);

      // Store the actual peer ID for viewers to connect to
      this.currentPeerId = peerId || null;

      this.peer.on("open", (id) => {
        console.log("[RoomWebRTC] Peer opened with ID:", id);
        this.currentPeerId = id;
        this.initRetryCount = 0; // Reset on successful connection
        this.options.onConnectionStateChange?.("connecting");

        if (isHost) {
          this.setupHostListeners();
        } else {
          this.connectToHost();
        }

        resolve();
      });

      this.peer.on("error", (err) => {
        console.error("[RoomWebRTC] Peer error:", err.type, err.message);

        // Handle "unavailable-id" error - ID is still registered on PeerJS server
        if (err.type === "unavailable-id" && isHost) {
          this.initRetryCount++;
          if (this.initRetryCount < this.MAX_INIT_RETRIES) {
            console.log(`[RoomWebRTC] Peer ID taken, retrying with suffix (${this.initRetryCount})...`);
            // Destroy current peer and retry with new ID
            this.peer?.destroy();
            this.peer = null;
            setTimeout(() => {
              this.init(roomId, isHost, options).then(resolve).catch(reject);
            }, 500);
            return;
          }
        }

        // Handle "peer-unavailable" error for viewers
        if (err.type === "peer-unavailable") {
          this.options.onError?.("Host is not streaming yet. Please wait...");
          this.options.onConnectionStateChange?.("disconnected");
        } else {
          this.options.onError?.(err.message || "Connection error");
          this.options.onConnectionStateChange?.("failed");
        }

        reject(err);
      });

      this.peer.on("disconnected", () => {
        console.log("[RoomWebRTC] Peer disconnected, attempting reconnect...");
        this.options.onConnectionStateChange?.("disconnected");
        // Only reconnect if peer still exists and isn't destroyed
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  /**
   * Async cleanup that waits for peer to be fully destroyed
   */
  private async cleanupAsync(): Promise<void> {
    if (this.peer) {
      const wasDestroyed = this.peer.destroyed;
      this.cleanup();
      // Wait a bit for PeerJS server to release the ID
      if (!wasDestroyed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Host: Set up listeners for incoming viewer connections
   */
  private setupHostListeners(): void {
    if (!this.peer) return;

    // Listen for data connections (heartbeat)
    this.peer.on("connection", (conn) => {
      console.log("[RoomWebRTC] Viewer connected:", conn.peer);
      this.handleViewerDataConnection(conn);
    });

    // Listen for calls (but host initiates calls, not viewers)
    // This is a fallback in case viewer tries to call
    this.peer.on("call", (call) => {
      console.log("[RoomWebRTC] Unexpected incoming call from:", call.peer);
      // If we have a stream, answer with it
      if (this.localStream) {
        call.answer(this.localStream);
        this.setupHostMediaConnection(call, call.peer);
      }
    });

    this.options.onConnectionStateChange?.("connected");
    this.startHostHeartbeat();
  }

  /**
   * Host: Handle new viewer data connection
   */
  private handleViewerDataConnection(conn: DataConnection): void {
    const viewerId = conn.peer;

    conn.on("open", () => {
      console.log("[RoomWebRTC] Data connection open with viewer:", viewerId);

      // Store viewer connection (userName will be updated when IDENTIFY is received)
      const viewer: ViewerConnection = {
        dataConnection: conn,
        mediaConnection: null,
        mediaConnected: false,
        peerId: viewerId,
        userName: `Viewer ${viewerId.slice(-4)}`, // Default until IDENTIFY
        lastPongTime: Date.now(),
        rtt: 0,
      };
      this.viewers.set(viewerId, viewer);
      this.notifyViewersChange();

      // If we have a stream, call the viewer
      if (this.localStream && this.peer) {
        console.log("[RoomWebRTC] Calling viewer with stream:", viewerId);
        const mediaConn = this.peer.call(viewerId, this.localStream);
        viewer.mediaConnection = mediaConn;
        this.setupHostMediaConnection(mediaConn, viewerId);
        this.notifyViewersChange(); // Update with media connection
      }
    });

    conn.on("data", (data) => {
      const msg = data as DataMessage;
      const viewer = this.viewers.get(viewerId);

      if (msg.type === "PONG") {
        if (viewer) {
          viewer.rtt = Date.now() - (msg as HeartbeatMessage).timestamp;
          viewer.lastPongTime = Date.now();
        }
      } else if (msg.type === "IDENTIFY") {
        console.log("[RoomWebRTC] Received IDENTIFY from viewer:", viewerId, msg);
        if (viewer) {
          const identifyMsg = msg as IdentifyMessage;
          viewer.userName = identifyMsg.userName || viewer.userName;
          viewer.userImage = identifyMsg.userImage;
          console.log("[RoomWebRTC] Viewer identified:", viewerId, "->", viewer.userName);
          this.notifyViewersChange();
        } else {
          console.warn("[RoomWebRTC] Received IDENTIFY but viewer not in map:", viewerId);
        }
      }
    });

    conn.on("close", () => {
      console.log("[RoomWebRTC] Viewer disconnected:", viewerId);
      this.viewers.delete(viewerId);
      this.notifyViewersChange();
    });

    conn.on("error", (err) => {
      console.error("[RoomWebRTC] Viewer connection error:", viewerId, err);
    });
  }

  /**
   * Host: Set up media connection handlers for a viewer
   */
  private setupHostMediaConnection(call: MediaConnection, viewerId: string): void {
    // Monitor ICE connection state to know when media is actually flowing
    // PeerJS exposes the underlying RTCPeerConnection via peerConnection property
    const checkConnection = () => {
      const pc = (call as any).peerConnection as RTCPeerConnection | undefined;
      if (pc) {
        const updateMediaConnected = (connected: boolean) => {
          const viewer = this.viewers.get(viewerId);
          if (viewer && viewer.mediaConnected !== connected) {
            viewer.mediaConnected = connected;
            console.log(`[RoomWebRTC] Viewer ${viewerId} media ${connected ? 'connected' : 'disconnected'}`);
            this.notifyViewersChange();
          }
        };

        // Check current state
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          updateMediaConnected(true);
        }

        // Listen for state changes
        pc.oniceconnectionstatechange = () => {
          console.log(`[RoomWebRTC] Viewer ${viewerId} ICE state:`, pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            updateMediaConnected(true);
          } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            updateMediaConnected(false);
          }
        };
      }
    };

    // PeerConnection might not be available immediately, check after a short delay
    setTimeout(checkConnection, 100);

    call.on("stream", () => {
      // Host doesn't receive streams from viewers in one-way setup
      console.log("[RoomWebRTC] Unexpected stream from viewer:", viewerId);
    });

    call.on("close", () => {
      console.log("[RoomWebRTC] Media connection closed with viewer:", viewerId);
      const viewer = this.viewers.get(viewerId);
      if (viewer) {
        viewer.mediaConnection = null;
        viewer.mediaConnected = false;
        this.notifyViewersChange();
      }
    });

    call.on("error", (err) => {
      console.error("[RoomWebRTC] Media connection error with viewer:", viewerId, err);
      const viewer = this.viewers.get(viewerId);
      if (viewer) {
        viewer.mediaConnected = false;
        this.notifyViewersChange();
      }
    });
  }

  /**
   * Host: Start heartbeat to all viewers
   */
  private startHostHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.viewers.forEach((viewer, viewerId) => {
        // Send ping
        if (viewer.dataConnection?.open) {
          viewer.dataConnection.send({ type: "PING", timestamp: now });
        }

        // Check for ghost connection
        if (now - viewer.lastPongTime > this.DISCONNECT_THRESHOLD) {
          console.warn("[RoomWebRTC] Viewer timed out:", viewerId);
          viewer.dataConnection?.close();
          viewer.mediaConnection?.close();
          this.viewers.delete(viewerId);
          this.notifyViewersChange();
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private connectionRetryCount = 0;
  private hostIdSuffix = 0;
  private callListenerRegistered = false;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private readonly MAX_CONNECTION_RETRIES = 3;
  private readonly MAX_HOST_ID_SUFFIX = 3;
  private readonly CONNECTION_RETRY_DELAY = 2000;

  /**
   * Viewer: Connect to host with retry logic
   * Tries different host peer IDs in case host reconnected with a suffix
   */
  private connectToHost(): void {
    if (!this.peer) return;

    // Clear any existing connection timeout
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    // Clean up previous data connection listeners before creating new one
    if (this.hostDataConnection) {
      this.hostDataConnection.off("open");
      this.hostDataConnection.off("data");
      this.hostDataConnection.off("close");
      this.hostDataConnection.off("error");
      this.hostDataConnection.close();
      this.hostDataConnection = null;
    }

    // Try base ID first, then with suffixes (host may have reconnected)
    const hostPeerId = this.hostIdSuffix > 0
      ? `ushico-room-${this.roomId}-${this.hostIdSuffix}`
      : `ushico-room-${this.roomId}`;

    console.log("[RoomWebRTC] Connecting to host:", hostPeerId,
      `(suffix: ${this.hostIdSuffix}, retry: ${this.connectionRetryCount + 1})`);

    // Create data connection for heartbeat
    this.hostDataConnection = this.peer.connect(hostPeerId, { reliable: true });

    // Set a timeout to detect if connection fails silently
    this.connectionTimeoutId = setTimeout(() => {
      if (!this.hostDataConnection?.open) {
        this.connectionRetryCount++;

        // After retries exhausted for this ID, try next suffix
        if (this.connectionRetryCount >= this.MAX_CONNECTION_RETRIES) {
          this.connectionRetryCount = 0;
          this.hostIdSuffix++;

          if (this.hostIdSuffix <= this.MAX_HOST_ID_SUFFIX) {
            console.warn(`[RoomWebRTC] Trying host ID with suffix ${this.hostIdSuffix}...`);
            setTimeout(() => this.connectToHost(), this.CONNECTION_RETRY_DELAY);
            return;
          } else {
            // All suffixes exhausted
            console.error("[RoomWebRTC] All host IDs tried, host not available");
            this.options.onError?.("Could not connect to host. They may not be streaming yet.");
            this.options.onConnectionStateChange?.("disconnected");
            return;
          }
        }

        console.warn(`[RoomWebRTC] Connection timeout, retrying (${this.connectionRetryCount}/${this.MAX_CONNECTION_RETRIES})...`);
        setTimeout(() => this.connectToHost(), this.CONNECTION_RETRY_DELAY);
      }
    }, 5000); // 5 second timeout per attempt

    // Clear timeout and reset retry count if connection opens
    this.hostDataConnection.on("open", () => {
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }
      this.connectionRetryCount = 0;
      this.hostIdSuffix = 0; // Reset for future reconnections
    });

    this.setupViewerDataConnection(this.hostDataConnection);

    // Listen for incoming calls from host (only register once per peer instance)
    if (!this.callListenerRegistered && this.peer) {
      this.callListenerRegistered = true;
      this.peer.on("call", (call) => {
        console.log("[RoomWebRTC] Receiving stream from host");
        this.hostMediaConnection = call;
        call.answer(); // Answer without stream (one-way)
        this.setupViewerMediaConnection(call);
      });
    }
  }

  /**
   * Viewer: Set up data connection to host
   */
  private setupViewerDataConnection(conn: DataConnection): void {
    let identifySent = false;

    const sendIdentify = () => {
      if (identifySent || !this.userName || !conn.open) return;
      identifySent = true;
      const identifyMsg: IdentifyMessage = {
        type: "IDENTIFY",
        userName: this.userName,
        userImage: this.userImage,
      };
      conn.send(identifyMsg);
      console.log("[RoomWebRTC] Sent IDENTIFY to host:", this.userName);
    };

    conn.on("open", () => {
      console.log("[RoomWebRTC] Connected to host");
      this.lastPongTime = Date.now();
      this.startViewerHeartbeat();
      this.options.onConnectionStateChange?.("connected");

      // Send IDENTIFY message to host with user info (with small delay for reliability)
      setTimeout(sendIdentify, 100);
    });

    conn.on("data", (data) => {
      const msg = data as HeartbeatMessage;
      if (msg.type === "PING") {
        // Update lastPongTime when we receive a PING from host
        // This proves the connection is alive
        this.lastPongTime = Date.now();
        conn.send({ type: "PONG", timestamp: msg.timestamp });

        // Also send IDENTIFY as backup if not sent yet (ensures host gets it after connection is stable)
        sendIdentify();
      }
    });

    conn.on("close", () => {
      console.log("[RoomWebRTC] Disconnected from host");
      this.stopHeartbeat();
      this.options.onConnectionStateChange?.("disconnected");
    });

    conn.on("error", (err) => {
      console.error("[RoomWebRTC] Data connection error:", err);
      this.options.onError?.("Connection to host failed");
    });
  }

  /**
   * Viewer: Set up media connection from host
   * Uses named handlers so they can be properly removed with .off()
   */
  private setupViewerMediaConnection(call: MediaConnection): void {
    let streamReceived = false;

    const onStream = (remoteStream: MediaStream) => {
      // PeerJS fires "stream" event multiple times (once per track)
      // Only process the first one to avoid interrupting play()
      if (streamReceived) {
        console.log("[RoomWebRTC] Ignoring duplicate stream event");
        return;
      }
      streamReceived = true;

      console.log("[RoomWebRTC] Received stream from host");
      this.resetReconnectState(); // Reset reconnect on successful stream
      this.options.onRemoteStream?.(remoteStream);
      this.options.onConnectionStateChange?.("connected");
    };

    const onClose = () => {
      console.log("[RoomWebRTC] Media connection to host closed");
      // Remove listeners to prevent memory leaks
      call.off("stream", onStream);
      call.off("close", onClose);
      call.off("error", onError);
      streamReceived = false;
      this.hostMediaConnection = null;

      // Only trigger reconnect if the data connection is also dead
      // If data connection is still open, host just stopped streaming and may start again
      if (this.hostDataConnection?.open) {
        console.log("[RoomWebRTC] Data connection still open, waiting for host to restart stream");
        // Notify UI that stream stopped but we're still connected
        this.options.onConnectionStateChange?.("connecting");
      } else {
        this.options.onConnectionStateChange?.("disconnected");
        this.scheduleReconnect();
      }
    };

    const onError = (err: Error) => {
      console.error("[RoomWebRTC] Media connection error:", err);
      // Remove listeners to prevent memory leaks
      call.off("stream", onStream);
      call.off("close", onClose);
      call.off("error", onError);
      this.hostMediaConnection = null;

      // Only reconnect if data connection is also dead
      if (this.hostDataConnection?.open) {
        console.log("[RoomWebRTC] Media error but data connection open, waiting for host");
        this.options.onConnectionStateChange?.("connecting");
      } else {
        this.options.onError?.("Stream from host failed");
        this.scheduleReconnect();
      }
    };

    call.on("stream", onStream);
    call.on("close", onClose);
    call.on("error", onError);
  }

  /**
   * Viewer: Start heartbeat response tracking
   * Detects when host stops sending pings (ghost connection)
   */
  private startViewerHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPongTime;
      if (timeSinceLastPing > this.DISCONNECT_THRESHOLD) {
        console.warn("[RoomWebRTC] No heartbeat from host for", timeSinceLastPing, "ms");
        this.options.onConnectionStateChange?.("disconnected");
        this.options.onError?.("Connection lost - no response from host");
        this.stopHeartbeat();
      }
      // NOTE: lastPongTime is updated in setupViewerDataConnection when PING is received
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Viewer: Schedule auto-reconnect with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.isHost) return;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log("[RoomWebRTC] Max reconnect attempts reached, giving up");
      this.options.onError?.("Connection lost - max reconnection attempts reached");
      return;
    }

    const delay = this.RECONNECT_DELAYS[Math.min(this.reconnectAttempts, this.RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts++;

    console.log(`[RoomWebRTC] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    this.options.onReconnecting?.(this.reconnectAttempts, this.MAX_RECONNECT_ATTEMPTS);

    // Clear any existing timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      console.log(`[RoomWebRTC] Attempting reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`);

      // Clean up old connections but keep the peer
      if (this.hostDataConnection) {
        this.hostDataConnection.close();
        this.hostDataConnection = null;
      }
      if (this.hostMediaConnection) {
        this.hostMediaConnection.close();
        this.hostMediaConnection = null;
      }
      this.stopHeartbeat();

      // Try to reconnect
      this.connectionRetryCount = 0;
      this.hostIdSuffix = 0;
      this.connectToHost();
    }, delay);
  }

  /**
   * Reset reconnect state (called on successful connection)
   */
  private resetReconnectState(): void {
    this.reconnectAttempts = 0;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Host: Start streaming from screen share
   */
  async startScreenShare(): Promise<MediaStream> {
    if (!this.isHost) {
      throw new Error("Only host can share screen");
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        console.log("[RoomWebRTC] Screen share ended by user");
        this.stopStream();
      };

      this.setStream(stream);
      return stream;
    } catch (err) {
      console.error("[RoomWebRTC] Screen share failed:", err);
      throw err;
    }
  }

  /**
   * Host: Start streaming from camera
   */
  async startCamera(): Promise<MediaStream> {
    if (!this.isHost) {
      throw new Error("Only host can share camera");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this.setStream(stream);
      return stream;
    } catch (err) {
      console.error("[RoomWebRTC] Camera access failed:", err);
      throw err;
    }
  }

  // File streaming resources (need cleanup)
  private fileStreamVideo: HTMLVideoElement | null = null;
  private fileStreamCanvas: HTMLCanvasElement | null = null;
  private fileStreamAnimationId: number | null = null;
  private fileStreamAudioCtx: AudioContext | null = null;
  private fileStreamBlobUrl: string | null = null;

  /**
   * Host: Stream from a video file
   * Always uses canvas to re-encode video for WebRTC compatibility
   * (Direct captureStream() causes green screen on desktop Chrome with certain codecs)
   */
  async startFileStream(file: File): Promise<MediaStream> {
    if (!this.isHost) {
      throw new Error("Only host can stream files");
    }

    return new Promise((resolve, reject) => {
      // Cleanup any previous file stream resources
      this.cleanupFileStream();

      const video = document.createElement("video");
      const blobUrl = URL.createObjectURL(file);
      video.src = blobUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      this.fileStreamVideo = video;
      this.fileStreamBlobUrl = blobUrl;

      video.onloadedmetadata = async () => {
        try {
          await video.play();

          // Always use canvas to re-encode video for WebRTC compatibility
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d")!;

          this.fileStreamCanvas = canvas;

          const drawFrame = () => {
            if (video && !video.paused && !video.ended) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              this.fileStreamAnimationId = requestAnimationFrame(drawFrame);
            }
          };
          drawFrame();

          // Capture canvas at 30fps
          const stream = canvas.captureStream(30);

          // Add audio from the video element
          try {
            const audioCtx = new AudioContext();
            this.fileStreamAudioCtx = audioCtx;
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination); // Also play locally
            dest.stream.getAudioTracks().forEach((track) => {
              stream.addTrack(track);
            });
            console.log("[RoomWebRTC] File stream: audio tracks added");
          } catch (audioErr) {
            console.warn("[RoomWebRTC] Could not add audio to file stream:", audioErr);
          }

          console.log("[RoomWebRTC] File stream created via canvas, tracks:",
            stream.getTracks().map(t => `${t.kind}:${t.label}`).join(", "));

          this.setStream(stream);
          resolve(stream);
        } catch (err) {
          this.cleanupFileStream();
          reject(err);
        }
      };

      video.onerror = () => {
        this.cleanupFileStream();
        reject(new Error("Failed to load video file"));
      };
    });
  }

  /**
   * Cleanup file stream resources
   */
  private cleanupFileStream(): void {
    if (this.fileStreamAnimationId) {
      cancelAnimationFrame(this.fileStreamAnimationId);
      this.fileStreamAnimationId = null;
    }
    if (this.fileStreamAudioCtx) {
      this.fileStreamAudioCtx.close().catch(() => {});
      this.fileStreamAudioCtx = null;
    }
    if (this.fileStreamVideo) {
      this.fileStreamVideo.pause();
      this.fileStreamVideo.src = "";
      this.fileStreamVideo = null;
    }
    if (this.fileStreamBlobUrl) {
      URL.revokeObjectURL(this.fileStreamBlobUrl);
      this.fileStreamBlobUrl = null;
    }
    this.fileStreamCanvas = null;
  }

  /**
   * Host: Set the stream and send to all connected viewers
   * This properly handles stream switching by closing old connections and creating new ones
   */
  private setStream(stream: MediaStream): void {
    // Stop old stream tracks first
    if (this.localStream && this.localStream !== stream) {
      console.log("[RoomWebRTC] Stopping old stream tracks");
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.localStream = stream;

    // Update ALL existing viewer connections with the new stream
    // Close old media connections and create new ones
    if (this.peer) {
      this.viewers.forEach((viewer, viewerId) => {
        // Close existing media connection if any
        if (viewer.mediaConnection) {
          console.log("[RoomWebRTC] Closing old media connection for viewer:", viewerId);
          viewer.mediaConnection.close();
          viewer.mediaConnection = null;
        }

        // Create new call with new stream (only if data connection is open)
        if (viewer.dataConnection?.open) {
          console.log("[RoomWebRTC] Calling viewer with new stream:", viewerId);
          const mediaConn = this.peer!.call(viewerId, stream);
          viewer.mediaConnection = mediaConn;
          this.setupHostMediaConnection(mediaConn, viewerId);
        }
      });
    }
  }

  /**
   * Host: Stop streaming
   */
  stopStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close media connections but keep data connections
    this.viewers.forEach((viewer) => {
      if (viewer.mediaConnection) {
        viewer.mediaConnection.close();
        viewer.mediaConnection = null;
      }
    });
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
   * Notify about viewer changes with detailed info
   */
  private notifyViewersChange(): void {
    const viewerInfos: ViewerInfo[] = [];
    this.viewers.forEach((viewer) => {
      viewerInfos.push({
        peerId: viewer.peerId,
        userName: viewer.userName,
        userImage: viewer.userImage,
        dataConnected: viewer.dataConnection?.open ?? false,
        mediaConnected: viewer.mediaConnected,
        rtt: viewer.rtt,
      });
    });
    this.options.onViewerCountChange?.(this.viewers.size);
    this.options.onViewersChange?.(viewerInfos);
  }

  /**
   * Get viewer count (host only)
   */
  getViewerCount(): number {
    return this.viewers.size;
  }

  /**
   * Check if streaming
   */
  isStreaming(): boolean {
    return this.localStream !== null;
  }

  /**
   * Get connection state
   */
  isConnected(): boolean {
    if (this.isHost) {
      return this.peer !== null;
    }
    return this.hostDataConnection?.open === true;
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    console.log("[RoomWebRTC] Cleaning up...");

    this.stopHeartbeat();
    this.stopStream();
    this.cleanupFileStream();

    // Close all viewer connections (host)
    this.viewers.forEach((viewer) => {
      viewer.dataConnection?.close();
      viewer.mediaConnection?.close();
    });
    this.viewers.clear();

    // Close host connection (viewer)
    this.hostDataConnection?.close();
    this.hostMediaConnection?.close();
    this.hostDataConnection = null;
    this.hostMediaConnection = null;

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.rtt = 0;
    this.lastPongTime = Date.now();
    this.connectionRetryCount = 0;
    this.hostIdSuffix = 0;
    this.initRetryCount = 0;

    // Clear reconnect state
    this.resetReconnectState();
    this.currentPeerId = null;
    this.callListenerRegistered = false;

    // Clear connection timeout
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }
}

export { RoomWebRTCService };
