// lib/websocket.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000; // Start with 1 second
  private debug = true; // Enable logging
  private url: string;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      this.url = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
    }
    this.connect();
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

        // Resubscribe to all channels
        this.subscribers.forEach((callbacks, channel) => {
          this.log("Resubscribing to channel:", channel);
          const subscribeMessage = {
            channel,
            event: "subscribe",
            data: {},
          };
          this.ws!.send(JSON.stringify(subscribeMessage));
        });
      };

      this.ws.onmessage = (event) => {
        this.log("Received message:", event.data);
        try {
          const message = JSON.parse(event.data);
          this.log("Parsed message:", message);

          const subscribers = this.subscribers.get(message.channel);
          this.log(
            "Subscribers for channel",
            message.channel,
            ":",
            subscribers?.size ?? 0
          );

          if (subscribers) {
            subscribers.forEach((callback) => {
              try {
                callback(message.data); // Pass only the 'data' field
              } catch (error) {
                console.error("Error in subscriber callback:", error);
              }
            });
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

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

  public subscribe(channel: string, callback: (data: any) => void) {
    this.log("Subscribing to channel:", channel);

    let isNewChannel = false;
    if (!this.subscribers.has(channel)) {
      isNewChannel = true;
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)?.add(callback);
    this.log(
      "Current subscribers for channel",
      channel,
      ":",
      this.subscribers.get(channel)?.size
    );

    if (isNewChannel) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const subscribeMessage = {
          channel,
          event: "subscribe",
          data: {},
        };
        this.log("Sending subscribe message:", subscribeMessage);
        this.ws.send(JSON.stringify(subscribeMessage));
      } else {
        this.log("WebSocket not open, will subscribe on connect");
      }
    }

    return () => this.unsubscribe(channel, callback);
  }

  private unsubscribe(channel: string, callback: (data: any) => void) {
    const callbacks = this.subscribers.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(channel);

        // Send unsubscribe message to server
        if (this.ws?.readyState === WebSocket.OPEN) {
          const unsubscribeMessage = {
            channel,
            event: "unsubscribe",
            data: {},
          };
          this.ws.send(JSON.stringify(unsubscribeMessage));
        }
      }
    }
  }

  public send(channel: string, event: string, data: any) {
    const message = { channel, event, data };
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
