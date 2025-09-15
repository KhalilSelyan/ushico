/* eslint-disable @next/next/no-img-element */
"use client";
import { cn } from "@/lib/utils";
import { Message as DbMessage } from "@/db/schema";
import { User } from "better-auth";
import { FC, useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { getWebSocketService } from "@/lib/websocket";
import { FormattedMessage, formatMessage } from "@/types/message";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";

interface MessagesProps {
  initialMessages: DbMessage[];
  user: User;
  chatPartner?: User; // Optional for room messages
  chatId?: string;    // Optional for room support
  roomId?: string;    // Optional for room support
  participants?: (User & { role: string })[]; // For room messages
}

const Messages: FC<MessagesProps> = ({
  initialMessages,
  user,
  chatPartner,
  chatId,
  roomId,
  participants,
}) => {
  const scrollDownRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<FormattedMessage[]>(() =>
    initialMessages.map(formatMessage).sort((a, b) => a.timestamp - b.timestamp)
  );

  // Use typing indicator hook for room chats
  const { typingUsers, handleUserTyping, handleUserStoppedTyping } = useTypingIndicator(
    roomId || chatId || "",
    user.id
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
    let unsubscribes: (() => void)[] = [];

    // Set up subscriptions
    const setupSubscriptions = async () => {
      const wsService = getWebSocketService(user.id);

      if (roomId) {
        // Room message subscriptions
        const roomChannel = `room-${roomId}`;

        const unsubMessage = await wsService.subscribe(
          roomChannel,
          "room_message",
          messageHandler
        );
        unsubscribes.push(unsubMessage);

        // Typing indicators for room
        const unsubTyping = await wsService.subscribe(
          roomChannel,
          "user_typing",
          handleUserTyping
        );
        unsubscribes.push(unsubTyping);

        const unsubStoppedTyping = await wsService.subscribe(
          roomChannel,
          "user_stopped_typing",
          handleUserStoppedTyping
        );
        unsubscribes.push(unsubStoppedTyping);


      } else if (chatId) {
        // Direct chat subscriptions
        const channelName = `chat:${chatId}:messages`;
        const userChannel = `user:${user.id}:chats`;

        const unsubMessage1 = await wsService.subscribe(
          userChannel,
          "new_message",
          messageHandler
        );
        unsubscribes.push(unsubMessage1);

        const unsubMessage2 = await wsService.subscribe(
          channelName,
          "incoming_message",
          messageHandler
        );
        unsubscribes.push(unsubMessage2);

        // Typing indicators for direct chat
        const unsubTyping = await wsService.subscribe(
          channelName,
          "user_typing",
          handleUserTyping
        );
        unsubscribes.push(unsubTyping);

        const unsubStoppedTyping = await wsService.subscribe(
          channelName,
          "user_stopped_typing",
          handleUserStoppedTyping
        );
        unsubscribes.push(unsubStoppedTyping);
      }
    };

    void setupSubscriptions();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [chatId, roomId, messageHandler, user.id, handleUserTyping, handleUserStoppedTyping]);

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

          // Get sender info for room messages
          const getSenderInfo = () => {
            if (isCurrentUser) {
              return { name: user.name, image: user.image };
            }

            if (roomId && participants) {
              const sender = participants.find(p => p.id === message.senderId);
              return { name: sender?.name || "Unknown", image: sender?.image };
            }

            if (chatPartner) {
              return { name: chatPartner.name, image: chatPartner.image };
            }

            return { name: "Unknown", image: null };
          };

          const senderInfo = getSenderInfo();

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
                  {/* Show sender name for room messages when not current user */}
                  {roomId && !isCurrentUser && !hasPrevMessageFromSameUser && (
                    <span className="text-xs text-gray-500 px-2">
                      {senderInfo.name}
                    </span>
                  )}

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
                      {senderInfo.image ? (
                        <img
                          src={senderInfo.image}
                          referrerPolicy="no-referrer"
                          alt={`${senderInfo.name}'s profile picture`}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-400 flex items-center justify-center text-xs text-white">
                          {senderInfo.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        <div ref={scrollDownRef} />
      </div>
    </div>
  );
};

export default Messages;
