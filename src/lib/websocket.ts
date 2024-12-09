// lib/websocket.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Map<string, Set<(data: any) => void>>> =
    new Map(); // Map<channel, Map<event, Set<callback>>>
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000; // Start with 1 second
  private debug = true; // Enable logging
  private url: string;
  private userId: string | null = null;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      this.url = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
    }
    this.connect();
  }

  public setUserId(userId: string) {
    this.log("Setting userId:", userId);
    this.userId = userId;
    // If we're already connected, send a message to establish userId on server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send("system", "identify", { userId });
    }
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log("[WebSocket]", ...args);
    }
  }

  private connect() {
    try {
      this.log("Connecting to WebSocket...");
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.log("Connected");
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;

        // Send userId if available
        if (this.userId) {
          this.send("system", "identify", { userId: this.userId });
        }

        // Resubscribe to all channels and events
        this.subscribers.forEach((channelMap, channel) => {
          channelMap.forEach((eventSet, event) => {
            const subscribeMessage = {
              channel,
              event: "subscribe",
              data: { event },
              userId: this.userId,
            };
            this.log("Resubscribing to channel:", channel, "event:", event);
            this.ws!.send(JSON.stringify(subscribeMessage));
          });
        });
      };
      this.ws.onmessage = this.onMessage.bind(this);

      this.ws.onclose = () => {
        this.log("Disconnected");
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };
    } catch (error) {
      console.error("WebSocket Connection Error:", error);
      this.handleReconnect();
    }
  }

  private onMessage(event: MessageEvent) {
    this.log("Received message:", event.data);
    try {
      const message = JSON.parse(event.data);
      this.log("Parsed message:", message);

      const { channel, event: msgEvent, data } = message;

      const channelMap = this.subscribers.get(channel);
      if (!channelMap) return;

      const eventSet = channelMap.get(msgEvent);
      if (!eventSet) return;

      this.log(
        "Subscribers for channel",
        channel,
        "event",
        msgEvent,
        ":",
        eventSet.size
      );

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
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff

      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts})`);
        this.connect();
      }, this.reconnectTimeout);
    }
  }

  public subscribe(
    channel: string,
    event: string,
    callback: (data: any) => void
  ) {
    this.log(
      `Subscribing to channel: ${channel}, event: ${event}, userId: ${this.userId}`
    );

    let channelMap = this.subscribers.get(channel);
    if (!channelMap) {
      channelMap = new Map<string, Set<(data: any) => void>>();
      this.subscribers.set(channel, channelMap);
    }

    let eventSet = channelMap.get(event);
    if (!eventSet) {
      eventSet = new Set<(data: any) => void>();
      channelMap.set(event, eventSet);
    }

    eventSet.add(callback);

    // Send subscribe message if it's a new channel-event combination
    if (eventSet.size === 1 && this.ws?.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        channel,
        event: "subscribe",
        data: { event },
        userId: this.userId,
      };
      this.log("Sending subscribe message:", subscribeMessage);
      this.ws.send(JSON.stringify(subscribeMessage));
    }
    // Return unsubscribe function
    return () => this.unsubscribe(channel, event, callback);
  }

  public unsubscribe(
    channel: string,
    event: string,
    callback: (data: any) => void
  ) {
    const channelMap = this.subscribers.get(channel);
    if (!channelMap) return;

    const eventSet = channelMap.get(event);
    if (!eventSet) return;

    eventSet.delete(callback);
    if (eventSet.size === 0) {
      channelMap.delete(event);

      // Send unsubscribe message to server
      if (this.ws?.readyState === WebSocket.OPEN) {
        const unsubscribeMessage = {
          channel,
          event: "unsubscribe",
          data: { event },
          userId: this.userId,
        };
        this.ws.send(JSON.stringify(unsubscribeMessage));
      }
    }

    if (channelMap.size === 0) {
      this.subscribers.delete(channel);
    }
  }

  public send(channel: string, event: string, data: any) {
    if (!this.userId) {
      console.error("User ID is not set. Cannot send message.");
      return;
    }
    const message = { channel, event, data, userId: this.userId };
    this.log("Sending message:", message);

    if (this.ws) {
      this.log("WebSocket readyState:", this.ws.readyState);
    } else {
      this.log("WebSocket is null");
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log("Message sent:", message);
    } else {
      console.error("WebSocket is not connected, message not sent");
    }
  }
}
// Create a singleton instance
export const wsService = new WebSocketService();
