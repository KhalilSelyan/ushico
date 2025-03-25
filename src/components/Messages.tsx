/* eslint-disable @next/next/no-img-element */
"use client";
import { cn } from "@/lib/utils";
import { Message as DbMessage } from "@/db/schema";
import { User } from "better-auth";
import { FC, useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { wsService } from "@/lib/websocket";
import { FormattedMessage, formatMessage } from "@/types/message";

interface MessagesProps {
  initialMessages: DbMessage[];
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
  const [messages, setMessages] = useState<FormattedMessage[]>(() =>
    initialMessages.map(formatMessage).sort((a, b) => a.timestamp - b.timestamp)
  );

  const messageHandler = useCallback((message: any) => {
    const newMessage = formatMessage(message as DbMessage);
    setMessages((prev) => {
      // Check if message already exists
      if (prev.some((m) => m.id === newMessage.id)) {
        return prev;
      }

      return [...prev, newMessage].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Scroll to bottom
    setTimeout(() => {
      scrollDownRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Format timestamp
  const formatMessageTimestamp = (timestamp: number) => {
    return format(new Date(timestamp), "HH:mm");
  };

  useEffect(() => {
    const channelName = `chat:${chatId}:messages`;
    const userChannel = `user:${user.id}:chats`;

    let unsubscribe1: (() => void) | undefined;
    let unsubscribe2: (() => void) | undefined;

    // Set up subscriptions
    const setupSubscriptions = async () => {
      unsubscribe1 = await wsService.subscribe(
        userChannel,
        "new_message",
        messageHandler
      );
      unsubscribe2 = await wsService.subscribe(
        channelName,
        "incoming_message",
        messageHandler
      );
    };

    void setupSubscriptions();

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
    };
  }, [chatId, messageHandler, user.id]);

  return (
    <div className="flex flex-col h-full">
      <div
        id="messages"
        className="flex h-full flex-col gap-4 p-2 overflow-y-auto scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
      >
        {messages.map((message, index) => {
          const isCurrentUser = message.senderId === user.id;
          const hasNextMessageFromSameUser =
            messages[index + 1]?.senderId === message.senderId;
          const hasPrevMessageFromSameUser =
            messages[index - 1]?.senderId === message.senderId;

          // Group messages that are within 2 minutes of each other
          const showTimestamp =
            !hasPrevMessageFromSameUser ||
            (messages[index - 1] &&
              messages[index - 1].timestamp - message.timestamp > 120000);

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
        <div ref={scrollDownRef} />
      </div>
    </div>
  );
};

export default Messages;
