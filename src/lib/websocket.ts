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

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Map<string, Set<(data: any) => void>>> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private debug = process.env.NODE_ENV === "development";
  private url: string;
  private connectionPromise: Promise<void> | null = null;

  constructor(url?: string, autoConnect: boolean = true) {
    this.url = url ?? process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
    if (autoConnect) {
      this.connect();
    }
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
      try {
        this.log("Connecting to WebSocket...");
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.log("Connected");
          this.reconnectAttempts = 0;
          this.reconnectTimeout = 1000;

          // Resubscribe to all channels and events
          this.subscribers.forEach((channelMap, channel) => {
            channelMap.forEach((_, event) => {
              this.sendSubscription(channel, event);
            });
          });

          resolve();
        };

        this.ws.onmessage = this.onMessage.bind(this);

        this.ws.onclose = () => {
          this.log("Disconnected");
          this.connectionPromise = null;
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket Error:", error);
          reject(error);
        };
      } catch (error) {
        console.error("WebSocket Connection Error:", error);
        this.connectionPromise = null;
        this.handleReconnect();
        reject(error);
      }
    });

    return this.connectionPromise;
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

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff

      setTimeout(() => {
        this.log(`Attempting to reconnect... (${this.reconnectAttempts})`);
        this.connect();
      }, this.reconnectTimeout);
    }
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
    await this.connect();

    const message: WebSocketMessage<T> = {
      channel,
      event,
      data,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log("Message sent:", message);
    } else {
      throw new Error("WebSocket is not connected");
    }
  }
}

// Room-specific message types - matches server format
export interface RoomSyncData {
  timestamp: number;
  url: string;
  roomId: string;
  state: "playing" | "paused";
  videoId: string; // UUID generated when URL changes
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

// Legacy export for backward compatibility - disabled auto-connect to prevent userID errors
export const wsService = new WebSocketService(undefined, false);
