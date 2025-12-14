import Peer, { MediaConnection, DataConnection } from "peerjs";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";
export type ConnectionQuality = "excellent" | "good" | "poor";

interface HeartbeatMessage {
  type: "PING" | "PONG";
  timestamp: number;
}

interface WebRTCServiceOptions {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionQualityChange?: (quality: ConnectionQuality, rtt: number) => void;
  onError?: (error: string) => void;
}

class WebRTCService {
  private peer: Peer | null = null;
  private mediaConnection: MediaConnection | null = null;
  private dataConnection: DataConnection | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = Date.now();
  private rtt: number = 0;
  private options: WebRTCServiceOptions = {};
  private isHost: boolean = false;
  private chatId: string = "";

  private readonly ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  private readonly HEARTBEAT_INTERVAL = 2000; // 2 seconds
  private readonly DISCONNECT_THRESHOLD = 10000; // 10 seconds

  /**
   * Initialize peer connection
   * Host creates a peer with a known ID (ushico-{chatId})
   * Watcher creates a peer with random ID and connects to host
   */
  async init(
    chatId: string,
    isHost: boolean,
    options: WebRTCServiceOptions = {}
  ): Promise<void> {
    this.options = options;
    this.isHost = isHost;
    this.chatId = chatId;

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 1,
        config: {
          iceServers: this.ICE_SERVERS,
        },
      };

      // Host creates peer with known ID, watcher gets random ID
      this.peer = isHost
        ? new Peer(`ushico-${chatId}`, peerOptions)
        : new Peer(peerOptions);

      this.peer.on("open", (id) => {
        console.log("[WebRTC] Peer opened with ID:", id);
        this.options.onConnectionStateChange?.("connecting");

        if (!isHost) {
          // Watcher: connect to host's peer ID
          this.connectToHost();
        }

        resolve();
      });

      this.peer.on("error", (err) => {
        console.error("[WebRTC] Peer error:", err);
        this.options.onError?.(err.message || "Connection error");
        this.options.onConnectionStateChange?.("failed");
        reject(err);
      });

      this.peer.on("disconnected", () => {
        console.log("[WebRTC] Peer disconnected, attempting reconnect...");
        this.options.onConnectionStateChange?.("disconnected");
        // PeerJS will attempt to reconnect automatically
        this.peer?.reconnect();
      });

      // Host: listen for incoming calls
      if (isHost) {
        this.peer.on("call", (call) => {
          console.log("[WebRTC] Incoming call from watcher");
          this.mediaConnection = call;
          this.setupMediaConnection(call);
          // Host answers without stream (one-way: host -> watcher)
          call.answer();
        });

        this.peer.on("connection", (conn) => {
          console.log("[WebRTC] Incoming data connection");
          this.dataConnection = conn;
          this.setupDataConnection(conn);
        });
      }
    });
  }

  /**
   * Watcher connects to host
   */
  private connectToHost(): void {
    if (!this.peer) return;

    const hostPeerId = `ushico-${this.chatId}`;
    console.log("[WebRTC] Connecting to host:", hostPeerId);

    // Create data connection for heartbeat
    this.dataConnection = this.peer.connect(hostPeerId, { reliable: true });
    this.setupDataConnection(this.dataConnection);
  }

  /**
   * Host sends media stream to watcher
   */
  sendStream(stream: MediaStream): void {
    if (!this.peer || !this.isHost) {
      console.error("[WebRTC] Cannot send stream: not host or peer not ready");
      return;
    }

    // If there's an existing watcher connected via data connection,
    // we need to call them with the stream
    if (this.dataConnection?.peer) {
      console.log("[WebRTC] Calling watcher with stream");
      this.mediaConnection = this.peer.call(this.dataConnection.peer, stream);
      this.setupMediaConnection(this.mediaConnection);
    } else {
      console.log("[WebRTC] No watcher connected yet, waiting...");
      // Store the stream and send when watcher connects
      this.peer.on("connection", (conn) => {
        console.log("[WebRTC] Watcher connected, sending stream");
        this.dataConnection = conn;
        this.setupDataConnection(conn);
        this.mediaConnection = this.peer!.call(conn.peer, stream);
        this.setupMediaConnection(this.mediaConnection);
      });
    }
  }

  /**
   * Watcher calls host to receive stream
   * (In our case, watcher just listens - host calls watcher)
   */
  requestStream(): void {
    if (!this.peer || this.isHost) return;

    // Watcher listens for incoming call from host
    this.peer.on("call", (call) => {
      console.log("[WebRTC] Receiving call from host");
      this.mediaConnection = call;
      this.setupMediaConnection(call);
      // Answer without stream (one-way: host -> watcher)
      call.answer();
    });
  }

  private setupMediaConnection(call: MediaConnection): void {
    call.on("stream", (remoteStream) => {
      console.log("[WebRTC] Received remote stream");
      this.options.onRemoteStream?.(remoteStream);
      this.options.onConnectionStateChange?.("connected");
    });

    call.on("close", () => {
      console.log("[WebRTC] Media connection closed");
      this.options.onConnectionStateChange?.("disconnected");
    });

    call.on("error", (err) => {
      console.error("[WebRTC] Media connection error:", err);
      this.options.onError?.(err.message || "Media connection error");
    });
  }

  private setupDataConnection(conn: DataConnection): void {
    conn.on("open", () => {
      console.log("[WebRTC] Data connection open");
      this.lastPongTime = Date.now();
      this.startHeartbeat();
      this.options.onConnectionStateChange?.("connected");
    });

    conn.on("data", (data) => {
      const msg = data as HeartbeatMessage;

      if (msg.type === "PING") {
        // Respond with PONG
        conn.send({ type: "PONG", timestamp: msg.timestamp });
      } else if (msg.type === "PONG") {
        // Calculate RTT
        this.rtt = Date.now() - msg.timestamp;
        this.lastPongTime = Date.now();
        this.updateConnectionQuality();
      }
    });

    conn.on("close", () => {
      console.log("[WebRTC] Data connection closed");
      this.stopHeartbeat();
      this.options.onConnectionStateChange?.("disconnected");
    });

    conn.on("error", (err) => {
      console.error("[WebRTC] Data connection error:", err);
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.dataConnection?.open) {
        this.dataConnection.send({ type: "PING", timestamp: Date.now() });

        // Check for ghost connection
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > this.DISCONNECT_THRESHOLD) {
          console.warn("[WebRTC] No heartbeat response, connection may be dead");
          this.options.onConnectionStateChange?.("disconnected");
          this.options.onError?.("Connection lost - no heartbeat response");
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateConnectionQuality(): void {
    let quality: ConnectionQuality;

    if (this.rtt < 100) {
      quality = "excellent";
    } else if (this.rtt < 300) {
      quality = "good";
    } else {
      quality = "poor";
    }

    this.options.onConnectionQualityChange?.(quality, this.rtt);
  }

  /**
   * Get current RTT
   */
  getRtt(): number {
    return this.rtt;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return (
      this.dataConnection?.open === true ||
      this.mediaConnection?.open === true
    );
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    console.log("[WebRTC] Cleaning up...");

    this.stopHeartbeat();

    if (this.mediaConnection) {
      this.mediaConnection.close();
      this.mediaConnection = null;
    }

    if (this.dataConnection) {
      this.dataConnection.close();
      this.dataConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.rtt = 0;
    this.lastPongTime = Date.now();
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();

// Also export class for cases where multiple instances are needed
export { WebRTCService };
