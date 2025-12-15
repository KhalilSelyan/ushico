// lib/websocket.ts
type WebSocketMessage<T = any> = {
  channel: string;
  event: string;
  data: T;
};

// Event types that match the Go server
export type WebSocketEvent =
  | "incoming_message"
  | "new_message"
  | "new_friend"
  | "incoming_friend_request"
  | "friend_request_denied"
  | "friend_request_accepted"
  | "friend_removed"
  | "subscribe"
  | "unsubscribe"
  | "sync"
  // NEW ROOM EVENTS
  | "create_room"
  | "join_room"
  | "leave_room"
  | "sync_room_state"    // Sync existing room state with server
  | "host_sync"          // Replaces "sync" for rooms
  | "room_message"
  | "participant_joined"
  | "participant_left"
  | "host_transferred"
  | "error_response"
  // NEW NOTIFICATION EVENTS
  | "room_join_request"        // Someone requested to join your room
  | "join_request_approved"    // Your join request was approved
  | "join_request_denied"      // Your join request was denied
  | "room_invitation"          // You've been invited to a room
  | "room_deactivated"         // Room was ended by host
  | "participant_kicked"       // You were removed from room
  // NEW UX FEATURES
  | "user_typing"              // User is typing in chat
  | "user_stopped_typing"      // User stopped typing
  | "video_reaction"           // Emoji reaction on video
  | "room_announcement"        // Activity announcements
  // PRESENCE SYSTEM
  | "user_presence_update"     // Update user's presence state
  | "get_room_presence"        // Request current presence of all room participants
  | "user_presence_updated"    // Broadcasted when someone's presence changes
  | "room_presence_status"     // Response with all participants' presence states
  // WEBRTC STREAMING
  | "stream_mode_changed"      // Host changed stream mode (url/webrtc)
  | "stream_mode_status"       // Response with current stream mode
  // PARTICIPANT WEBCAMS
  | "webcam_join"              // User joined webcam session
  | "webcam_leave"             // User left webcam session
  | "webcam_toggle"            // User toggled audio/video
  | "webcam_hub_change"        // Hub changed (transfer)

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Map<string, Set<(data: any) => void>>> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelays = [1000, 2000, 4000, 8000, 15000, 30000]; // Then stay at 30s
  private debug = process.env.NODE_ENV === "development";
  private url: string;
  private connectionPromise: Promise<void> | null = null;
  private connectionTimeout = 10000; // 10 second connection timeout
  private messageQueue: Array<{ channel: string; event: string; data: any }> = [];
  private onConnectionLost?: () => void;

  constructor(url?: string, autoConnect: boolean = true) {
    this.url = url ?? process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
    if (autoConnect) {
      this.connect();
    }
  }

  public setOnConnectionLost(callback: () => void): void {
    this.onConnectionLost = callback;
  }

  public hasUserID(): boolean {
    return this.url.includes('userID=');
  }

  public async connectManually(): Promise<void> {
    if (!this.connectionPromise) {
      return this.connect();
    }
    return this.connectionPromise;
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log("[WebSocket]", ...args);
    }
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Prevent connections without userID to avoid server errors
    if (!this.hasUserID()) {
      this.log("⚠️  Skipping connection - no userID provided. Use getWebSocketService(userID) for authenticated connections.");
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Set up connection timeout
      const timeoutId = setTimeout(() => {
        this.log("Connection timeout");
        if (this.ws) {
          this.ws.close();
        }
        this.connectionPromise = null;
        reject(new Error("Connection timeout"));
      }, this.connectionTimeout);

      try {
        this.log("Connecting to WebSocket...");
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.log("Connected");
          this.reconnectAttempts = 0;

          // Resubscribe to all channels and events
          this.subscribers.forEach((channelMap, channel) => {
            channelMap.forEach((_, event) => {
              this.sendSubscription(channel, event);
            });
          });

          // Flush any queued messages
          this.flushMessageQueue();

          resolve();
        };

        this.ws.onmessage = this.onMessage.bind(this);

        this.ws.onclose = () => {
          clearTimeout(timeoutId);
          this.log("Disconnected");
          this.connectionPromise = null;
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error("WebSocket Error:", error);
          reject(error);
        };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("WebSocket Connection Error:", error);
        this.connectionPromise = null;
        this.handleReconnect();
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private flushMessageQueue(): void {
    this.log(`Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift()!;
      this.ws.send(JSON.stringify(msg));
      this.log("Sent queued message:", msg);
    }
  }

  private async onMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.log("Received message:", message);

      const { channel, event: msgEvent, data } = message;

      const channelMap = this.subscribers.get(channel);
      if (!channelMap) return;

      const eventSet = channelMap.get(msgEvent);
      if (!eventSet) return;

      eventSet.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error("Error in subscriber callback:", error);
        }
      });
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private handleReconnect() {
    // Don't attempt reconnection if no userID (would fail anyway)
    if (!this.hasUserID()) {
      this.log("⚠️  Skipping reconnection - no userID provided.");
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("Max reconnection attempts reached, notifying UI");
      this.onConnectionLost?.();
      return;
    }

    // Get delay from array, or stay at last value if we've exceeded array length
    const delay = this.reconnectDelays[
      Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)
    ];

    this.reconnectAttempts++;
    this.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => {
        this.log("Reconnection failed:", err);
      });
    }, delay);
  }

  private sendSubscription(channel: string, event: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        channel,
        event: "subscribe",
        data: { event },
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  public async subscribe<T = any>(
    channel: string,
    event: WebSocketEvent,
    callback: (data: T) => void
  ): Promise<() => void> {
    await this.connect();

    let channelMap = this.subscribers.get(channel);
    if (!channelMap) {
      channelMap = new Map();
      this.subscribers.set(channel, channelMap);
    }

    let eventSet = channelMap.get(event);
    if (!eventSet) {
      eventSet = new Set();
      channelMap.set(event, eventSet);
    }

    eventSet.add(callback);

    if (eventSet.size === 1) {
      this.sendSubscription(channel, event);
    }

    return () => this.unsubscribe(channel, event, callback);
  }

  public unsubscribe(
    channel: string,
    event: WebSocketEvent,
    callback: (data: any) => void
  ) {
    const channelMap = this.subscribers.get(channel);
    if (!channelMap) return;

    const eventSet = channelMap.get(event);
    if (!eventSet) return;

    eventSet.delete(callback);
    if (eventSet.size === 0) {
      channelMap.delete(event);
      if (this.ws?.readyState === WebSocket.OPEN) {
        const message: WebSocketMessage = {
          channel,
          event: "unsubscribe",
          data: { event },
        };
        this.ws.send(JSON.stringify(message));
      }
    }

    if (channelMap.size === 0) {
      this.subscribers.delete(channel);
    }
  }

  public async send<T = any>(
    channel: string,
    event: WebSocketEvent,
    data: T
  ): Promise<void> {
    const message: WebSocketMessage<T> = {
      channel,
      event,
      data,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log("Message sent:", message);
    } else {
      // Queue message for retry when connection is restored
      this.log("WebSocket not connected, queueing message:", message);
      this.messageQueue.push(message);

      // Attempt to reconnect
      try {
        await this.connect();
        // If connect succeeds, message should be flushed automatically
      } catch {
        this.log("Connection failed, message remains queued");
      }
    }
  }

  public getConnectionState(): "connected" | "connecting" | "disconnected" {
    if (this.ws?.readyState === WebSocket.OPEN) return "connected";
    if (this.connectionPromise) return "connecting";
    return "disconnected";
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }
}

// Room-specific message types - matches server format
export interface RoomSyncData {
  timestamp: number;
  url: string;
  roomId: string;
  state: "playing" | "paused";
  videoId: string; // UUID generated when URL changes
  sentAt?: number; // Timestamp when message was sent (for latency compensation)
}

// Server error response format
export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
}

export interface RoomParticipantData {
  userId: string;
  userName: string;
  role: "host" | "viewer";
}

export interface HostTransferData {
  oldHostId: string;
  newHostId: string;
  newHostName: string;
}

// WebSocket service functions
export function subscribeToRoom(roomId: string): void {
  wsService.send(`room-${roomId}`, "subscribe", {});
}

export function sendHostSync(roomId: string, syncData: RoomSyncData): void {
  wsService.send(`room-${roomId}`, "host_sync", syncData);
}

export function sendRoomMessage(roomId: string, text: string): void {
  wsService.send(`room-${roomId}`, "room_message", { text, roomId });
}

// Connection setup with userID
export function connectWithUserID(userID: string): WebSocketService {
  const baseUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
  const urlWithUserId = `${baseUrl}?userID=${userID}`;
  return new WebSocketService(urlWithUserId);
}

// Create a singleton instance - will be replaced when user connects
let _wsService: WebSocketService | null = null;

export const getWebSocketService = (userID?: string): WebSocketService => {
  if (!_wsService || (userID && !_wsService.hasUserID())) {
    const baseUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
    const url = userID
      ? `${baseUrl}?userID=${userID}`
      : baseUrl;
    _wsService = new WebSocketService(url);
  }
  return _wsService;
};

// UX Features helper functions
export function sendTypingIndicator(roomId: string, userId: string, userName: string, userImage?: string): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "user_typing", {
    roomId,
    userId,
    userName,
    userImage
  });
}

export function sendStoppedTyping(roomId: string, userId: string, userName: string, userImage?: string): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "user_stopped_typing", {
    roomId,
    userId,
    userName,
    userImage
  });
}

export function sendVideoReaction(
  roomId: string,
  emoji: string,
  videoTimestamp: number,
  user: { id: string; name: string }
): void {
  const wsService = getWebSocketService(user.id);
  wsService.send(`room-${roomId}`, "video_reaction", {
    roomId,
    userId: user.id,
    userName: user.name,
    emoji,
    videoTimestamp,
    timestamp: new Date().toISOString(),
    reactionId: `${Date.now()}-${user.id}`
  });
}

export function sendRoomAnnouncement(
  roomId: string,
  type: string,
  userName: string,
  message: string
): void {
  const wsService = getWebSocketService();
  wsService.send(`room-${roomId}`, "room_announcement", {
    roomId,
    type,
    userName,
    message,
    timestamp: new Date().toISOString(),
    announcementId: `${Date.now()}-${type}`
  });
}

// Presence System helper functions
export function sendPresenceUpdate(
  roomId: string,
  userId: string,
  userName: string,
  presenceState: "active" | "away" | "offline"
): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "user_presence_update", {
    roomId,
    userId,
    userName,
    presenceState,
    timestamp: new Date().toISOString()
  });
}

export function requestRoomPresence(roomId: string, userId: string): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "get_room_presence", {
    roomId
  });
}

// WebRTC Streaming helper functions
export function sendStreamModeChange(
  roomId: string,
  userId: string,
  mode: "url" | "webrtc"
): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "stream_mode_changed", {
    roomId,
    userId,
    mode,
    timestamp: new Date().toISOString()
  });
}

// Participant Webcam helper functions
export function sendWebcamJoin(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string | undefined,
  audioEnabled: boolean,
  videoEnabled: boolean,
  isHub: boolean
): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "webcam_join", {
    roomId,
    userId,
    userName,
    userImage,
    audioEnabled,
    videoEnabled,
    isHub,
    timestamp: new Date().toISOString(),
  });
}

export function sendWebcamLeave(roomId: string, userId: string): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "webcam_leave", {
    roomId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export function sendWebcamToggle(
  roomId: string,
  userId: string,
  audioEnabled?: boolean,
  videoEnabled?: boolean
): void {
  const wsService = getWebSocketService(userId);
  wsService.send(`room-${roomId}`, "webcam_toggle", {
    roomId,
    userId,
    audioEnabled,
    videoEnabled,
    timestamp: new Date().toISOString(),
  });
}

export function sendWebcamHubChange(
  roomId: string,
  newHubUserId: string | null
): void {
  const wsService = getWebSocketService();
  wsService.send(`room-${roomId}`, "webcam_hub_change", {
    roomId,
    newHubUserId,
    timestamp: new Date().toISOString(),
  });
}

// Legacy export for backward compatibility - disabled auto-connect to prevent userID errors
export const wsService = new WebSocketService(undefined, false);
