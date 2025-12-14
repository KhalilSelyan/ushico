import Peer, { MediaConnection, DataConnection } from "peerjs";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";
export type ConnectionQuality = "excellent" | "good" | "poor";
export type StreamSource = "screen" | "file" | "camera";

interface ViewerConnection {
  dataConnection: DataConnection | null;
  mediaConnection: MediaConnection | null;
  peerId: string;
  lastPongTime: number;
  rtt: number;
}

interface RoomWebRTCOptions {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionQualityChange?: (quality: ConnectionQuality, rtt: number) => void;
  onError?: (error: string) => void;
  onViewerCountChange?: (count: number) => void;
}

interface HeartbeatMessage {
  type: "PING" | "PONG";
  timestamp: number;
}

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
  async init(
    roomId: string,
    isHost: boolean,
    options: RoomWebRTCOptions = {}
  ): Promise<void> {
    this.options = options;
    this.isHost = isHost;
    this.roomId = roomId;

    // Cleanup any existing connection
    this.cleanup();

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 1,
        config: {
          iceServers: this.ICE_SERVERS,
        },
      };

      // Host gets known ID, viewers get random ID
      const peerId = isHost ? `ushico-room-${roomId}` : undefined;
      this.peer = peerId
        ? new Peer(peerId, peerOptions)
        : new Peer(peerOptions);

      this.peer.on("open", (id) => {
        console.log("[RoomWebRTC] Peer opened with ID:", id);
        this.options.onConnectionStateChange?.("connecting");

        if (isHost) {
          this.setupHostListeners();
        } else {
          this.connectToHost();
        }

        resolve();
      });

      this.peer.on("error", (err) => {
        console.error("[RoomWebRTC] Peer error:", err);

        // Handle "peer unavailable" error for viewers
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
        this.peer?.reconnect();
      });
    });
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

      // Store viewer connection
      const viewer: ViewerConnection = {
        dataConnection: conn,
        mediaConnection: null,
        peerId: viewerId,
        lastPongTime: Date.now(),
        rtt: 0,
      };
      this.viewers.set(viewerId, viewer);
      this.options.onViewerCountChange?.(this.viewers.size);

      // If we have a stream, call the viewer
      if (this.localStream && this.peer) {
        console.log("[RoomWebRTC] Calling viewer with stream:", viewerId);
        const mediaConn = this.peer.call(viewerId, this.localStream);
        viewer.mediaConnection = mediaConn;
        this.setupHostMediaConnection(mediaConn, viewerId);
      }
    });

    conn.on("data", (data) => {
      const msg = data as HeartbeatMessage;
      if (msg.type === "PONG") {
        const viewer = this.viewers.get(viewerId);
        if (viewer) {
          viewer.rtt = Date.now() - msg.timestamp;
          viewer.lastPongTime = Date.now();
        }
      }
    });

    conn.on("close", () => {
      console.log("[RoomWebRTC] Viewer disconnected:", viewerId);
      this.viewers.delete(viewerId);
      this.options.onViewerCountChange?.(this.viewers.size);
    });

    conn.on("error", (err) => {
      console.error("[RoomWebRTC] Viewer connection error:", viewerId, err);
    });
  }

  /**
   * Host: Set up media connection handlers for a viewer
   */
  private setupHostMediaConnection(call: MediaConnection, viewerId: string): void {
    call.on("stream", () => {
      // Host doesn't receive streams from viewers in one-way setup
      console.log("[RoomWebRTC] Unexpected stream from viewer:", viewerId);
    });

    call.on("close", () => {
      console.log("[RoomWebRTC] Media connection closed with viewer:", viewerId);
      const viewer = this.viewers.get(viewerId);
      if (viewer) {
        viewer.mediaConnection = null;
      }
    });

    call.on("error", (err) => {
      console.error("[RoomWebRTC] Media connection error with viewer:", viewerId, err);
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
          this.options.onViewerCountChange?.(this.viewers.size);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Viewer: Connect to host
   */
  private connectToHost(): void {
    if (!this.peer) return;

    const hostPeerId = `ushico-room-${this.roomId}`;
    console.log("[RoomWebRTC] Connecting to host:", hostPeerId);

    // Create data connection for heartbeat
    this.hostDataConnection = this.peer.connect(hostPeerId, { reliable: true });
    this.setupViewerDataConnection(this.hostDataConnection);

    // Listen for incoming calls from host
    this.peer.on("call", (call) => {
      console.log("[RoomWebRTC] Receiving stream from host");
      this.hostMediaConnection = call;
      call.answer(); // Answer without stream (one-way)
      this.setupViewerMediaConnection(call);
    });
  }

  /**
   * Viewer: Set up data connection to host
   */
  private setupViewerDataConnection(conn: DataConnection): void {
    conn.on("open", () => {
      console.log("[RoomWebRTC] Connected to host");
      this.lastPongTime = Date.now();
      this.startViewerHeartbeat();
      this.options.onConnectionStateChange?.("connected");
    });

    conn.on("data", (data) => {
      const msg = data as HeartbeatMessage;
      if (msg.type === "PING") {
        conn.send({ type: "PONG", timestamp: msg.timestamp });
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
   */
  private setupViewerMediaConnection(call: MediaConnection): void {
    let streamReceived = false;

    call.on("stream", (remoteStream) => {
      // PeerJS fires "stream" event multiple times (once per track)
      // Only process the first one to avoid interrupting play()
      if (streamReceived) {
        console.log("[RoomWebRTC] Ignoring duplicate stream event");
        return;
      }
      streamReceived = true;

      console.log("[RoomWebRTC] Received stream from host");
      this.options.onRemoteStream?.(remoteStream);
      this.options.onConnectionStateChange?.("connected");
    });

    call.on("close", () => {
      console.log("[RoomWebRTC] Media connection to host closed");
      streamReceived = false;
      this.options.onConnectionStateChange?.("disconnected");
    });

    call.on("error", (err) => {
      console.error("[RoomWebRTC] Media connection error:", err);
      this.options.onError?.("Stream from host failed");
    });
  }

  /**
   * Viewer: Start heartbeat response tracking
   */
  private startViewerHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPongTime;
      if (timeSinceLastPing > this.DISCONNECT_THRESHOLD) {
        console.warn("[RoomWebRTC] No heartbeat from host");
        this.options.onConnectionStateChange?.("disconnected");
        this.options.onError?.("Connection lost - no response from host");
      }

      // Update last pong time when we receive pings (handled in data callback)
      this.lastPongTime = Date.now(); // Reset on each interval check
    }, this.HEARTBEAT_INTERVAL);
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

  /**
   * Host: Stream from a video file
   */
  async startFileStream(file: File): Promise<MediaStream> {
    if (!this.isHost) {
      throw new Error("Only host can stream files");
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const blobUrl = URL.createObjectURL(file);
      video.src = blobUrl;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = async () => {
        try {
          await video.play();

          // Try captureStream first, fall back to canvas
          let stream: MediaStream;
          if ("captureStream" in video) {
            stream = (video as any).captureStream();
          } else if ("mozCaptureStream" in video) {
            stream = (video as any).mozCaptureStream();
          } else {
            // Fallback: use canvas
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d")!;

            const drawFrame = () => {
              if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0);
                requestAnimationFrame(drawFrame);
              }
            };
            drawFrame();

            stream = canvas.captureStream(30);

            // Add audio if present
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
          }

          this.setStream(stream);
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to load video file"));
      };
    });
  }

  /**
   * Host: Set the stream and send to all connected viewers
   */
  private setStream(stream: MediaStream): void {
    this.localStream = stream;

    // Send stream to all connected viewers
    if (this.peer) {
      this.viewers.forEach((viewer, viewerId) => {
        if (!viewer.mediaConnection) {
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
  }
}

export { RoomWebRTCService };
