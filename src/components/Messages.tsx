/* eslint-disable @next/next/no-img-element */
"use client";
import { pusherClient } from "@/lib/pusher";
import { cn, toPusherKey } from "@/lib/utils";
import { User } from "next-auth";
import { FC, useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

interface MessagesProps {
  initialMessages: Message[];
  user: User;
  chatPartner: User;
  chatId: string;
}

const Messages: FC<MessagesProps> = ({
  initialMessages,
  user,
  chatPartner,
  chatId,
}) => {
  const scrollDownRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>(() =>
    // Sort messages by timestamp in descending order initially
    [...initialMessages].sort((a, b) => b.timestamp - a.timestamp)
  );
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Memoized message handler
  const messageHandler = useCallback((message: Message) => {
    setMessages((prev) => {
      // Check if message already exists to prevent duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      // Insert new message in correct position
      const newMessages = [...prev];
      const insertIndex = newMessages.findIndex(
        (m) => m.timestamp < message.timestamp
      );

      if (insertIndex === -1) {
        newMessages.push(message);
      } else {
        newMessages.splice(insertIndex, 0, message);
      }
      return newMessages;
    });

    // Scroll to bottom with a slight delay to ensure message is rendered
    setTimeout(() => {
      scrollDownRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Format timestamp
  const formatMessageTimestamp = (timestamp: number) => {
    return format(new Date(timestamp), "HH:mm");
  };

  // Memoized reconnection handler
  const handleReconnection = useCallback(() => {
    setIsReconnecting(true);
    // Fetch latest messages
    fetch(`/api/messages/${chatId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages((prev) => {
          // Merge new messages with existing ones, removing duplicates
          const combined = [...prev, ...data.messages];
          const unique = Array.from(
            new Map(combined.map((m) => [m.id, m])).values()
          );
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch messages:", err);
        setError("Failed to reconnect. Messages might be out of sync.");
      })
      .finally(() => {
        setIsReconnecting(false);
      });
  }, [chatId]);

  useEffect(() => {
    const channel = pusherClient.subscribe(
      toPusherKey(`chat:${chatId}:messages`)
    );

    channel.bind("incoming_message", messageHandler);

    // Handle connection issues
    channel.bind("pusher:subscription_error", () => {
      setError("Failed to subscribe to messages");
    });

    channel.bind("pusher:subscription_succeeded", () => {
      setError(null);
    });

    return () => {
      channel.unbind("incoming_message", messageHandler);
      channel.unbind("pusher:subscription_error");
      channel.unbind("pusher:subscription_succeeded");
      pusherClient.unsubscribe(toPusherKey(`chat:${chatId}:messages`));
    };
  }, [chatId, messageHandler]);

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-red-50 p-2 text-red-500 text-sm text-center">
          {error}{" "}
          <button
            onClick={handleReconnection}
            className="underline ml-2"
            disabled={isReconnecting}
          >
            {isReconnecting ? "Reconnecting..." : "Try to reconnect"}
          </button>
        </div>
      )}

      <div
        id="messages"
        className="flex h-full flex-1 flex-col-reverse gap-4 p-2 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
      >
        <div ref={scrollDownRef} />
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === user.id;
          const hasNextMessageFromSameUser =
            messages[index - 1]?.senderId === message.senderId;
          const hasPrevMessageFromSameUser =
            messages[index + 1]?.senderId === message.senderId;

          // Group messages that are within 2 minutes of each other
          const showTimestamp =
            !hasPrevMessageFromSameUser ||
            (messages[index + 1] &&
              message.timestamp - messages[index + 1].timestamp > 120000);

          return (
            <div
              key={`${message.id}-${message.timestamp}`}
              className="chat-message"
            >
              <div
                className={cn("flex items-end", {
                  "justify-end": isCurrentUser,
                })}
              >
                <div
                  className={cn(
                    "flex flex-col space-y-2 text-base max-w-xs mx-2",
                    {
                      "items-end order-1": isCurrentUser,
                      "items-start order-2": !isCurrentUser,
                    }
                  )}
                >
                  <span
                    className={cn("px-4 py-2 rounded-lg inline-block", {
                      "bg-indigo-600 text-white": isCurrentUser,
                      "bg-gray-100 text-gray-900": !isCurrentUser,
                      "rounded-br-none":
                        !hasNextMessageFromSameUser && isCurrentUser,
                      "rounded-bl-none":
                        !hasNextMessageFromSameUser && !isCurrentUser,
                      "rounded-tr-none":
                        hasPrevMessageFromSameUser && isCurrentUser,
                      "rounded-tl-none":
                        hasPrevMessageFromSameUser && !isCurrentUser,
                    })}
                  >
                    {message.text}
                    {showTimestamp && (
                      <span className="text-xs text-gray-400 ml-2">
                        {formatMessageTimestamp(message.timestamp)}
                      </span>
                    )}
                  </span>
                </div>

                <div
                  className={cn(
                    "relative flex items-center justify-center ml-2",
                    {
                      "order-2": isCurrentUser,
                      "order-1": !isCurrentUser,
                      invisible: hasNextMessageFromSameUser,
                    }
                  )}
                >
                  <div className="relative">
                    <div className="relative h-6 w-6">
                      <img
                        src={isCurrentUser ? user.image! : chatPartner.image!}
                        referrerPolicy="no-referrer"
                        alt={`${
                          isCurrentUser ? user.name : chatPartner.name
                        }'s profile picture`}
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Messages;
