"use client";

import { User } from "better-auth";
import { FC, useRef, useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import Button from "./ui/ButtonOld";
import {
  getWebSocketService,
  sendTypingIndicator,
  sendStoppedTyping,
} from "@/lib/websocket";
import { formatDistanceToNow } from "date-fns";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Announcements } from "@/components/Announcements";
import { ReactionButtons } from "@/components/ReactionButtons";

interface RoomMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string;
  timestamp: string;
}

interface RoomChatProps {
  roomId: string;
  user: User;
  participants: (User & { role: string })[];
  videoRef: React.RefObject<HTMLVideoElement>;
  className?: string;
}

const RoomChat: FC<RoomChatProps> = ({
  roomId,
  user,
  participants,
  videoRef,
  className,
}) => {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Use typing indicator hook
  const { typingUsers, handleUserTyping, handleUserStoppedTyping } =
    useTypingIndicator(roomId, user.id);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket subscription for room messages and other events
  useEffect(() => {
    if (!roomId || !user.id) return;

    const wsService = getWebSocketService(user.id);
    const channel = `room-${roomId}`;
    let unsubscribes: (() => void)[] = [];

    const setupSubscription = async () => {
      // Messages
      const unsubMessage = await wsService.subscribe(
        channel,
        "room_message",
        (data: any) => {
          // Construct message data from server response
          const messageData: RoomMessage = {
            id: data.messageId || data.id || `${Date.now()}-${data.senderId}`,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName || "Anonymous",
            senderImage: data.senderImage || "",
            timestamp: data.timestamp || new Date().toISOString(),
          };

          // Don't add our own messages twice (we already add them locally)
          if (messageData.senderId !== user.id) {
            setMessages((prev) => [...prev, messageData]);
          }
        }
      );
      unsubscribes.push(unsubMessage);

      // Typing indicators
      const unsubTyping = await wsService.subscribe(
        channel,
        "user_typing",
        handleUserTyping
      );
      unsubscribes.push(unsubTyping);

      const unsubStoppedTyping = await wsService.subscribe(
        channel,
        "user_stopped_typing",
        handleUserStoppedTyping
      );
      unsubscribes.push(unsubStoppedTyping);

      // Announcements
      const unsubAnnouncements = await wsService.subscribe(
        channel,
        "room_announcement",
        (data: any) => {
          setAnnouncements((prev) => [...prev, data]);
          // Remove announcement after 5 seconds
          setTimeout(() => {
            setAnnouncements((prev) =>
              prev.filter((a) => a.announcementId !== data.announcementId)
            );
          }, 5000);
        }
      );
      unsubscribes.push(unsubAnnouncements);
    };

    void setupSubscription();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
    // handleUserTyping and handleUserStoppedTyping are stable (memoized with useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user.id]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      const wsService = getWebSocketService(user.id);
      const messageData: RoomMessage = {
        id: `${Date.now()}-${user.id}`,
        text: input.trim(),
        senderId: user.id,
        senderName: user.name || "Anonymous",
        senderImage: user.image || "",
        timestamp: new Date().toISOString(),
      };

      // Send message via WebSocket with full sender info
      await wsService.send(`room-${roomId}`, "room_message", {
        roomId,
        text: messageData.text,
        senderId: user.id,
        senderName: user.name || "Anonymous",
        senderImage: user.image || "",
        timestamp: messageData.timestamp,
        messageId: messageData.id,
      });

      // Add message to local state immediately
      setMessages((prev) => [...prev, messageData]);

      setInput("");
      textareaRef.current?.focus();

      // Clear typing state when message is sent
      if (isTyping) {
        setIsTyping(false);
        sendStoppedTyping(roomId, user.id, user.name || "", user.image || "");
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    } catch (error) {
      console.error("Error sending room message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getParticipantName = (senderId: string) => {
    const participant = participants.find((p) => p.id === senderId);
    return participant?.name || "Unknown User";
  };

  const getParticipantImage = (senderId: string) => {
    const participant = participants.find((p) => p.id === senderId);
    return participant?.image || "";
  };

  const isCurrentUser = (senderId: string) => senderId === user.id;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Send typing indicator
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      sendTypingIndicator(roomId, user.id, user.name || "", user.image || "");
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send stopped typing after 1 second of no typing
    if (e.target.value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendStoppedTyping(roomId, user.id, user.name || "", user.image || "");
      }, 1000);
    } else if (isTyping) {
      // If input is cleared, immediately stop typing
      setIsTyping(false);
      sendStoppedTyping(roomId, user.id, user.name || "", user.image || "");
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden ${
        className || ""
      }`}
    >
      {/* Chat Header */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900">Room Chat</h3>
        <p className="text-sm text-gray-500">
          {participants.length} participants
        </p>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="p-2 border-b">
          <Announcements announcements={announcements} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                isCurrentUser(message.senderId) ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                <img
                  src={
                    message.senderImage ||
                    getParticipantImage(message.senderId) ||
                    ""
                  }
                  alt={
                    message.senderName || getParticipantName(message.senderId)
                  }
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Message Content */}
              <div
                className={`flex flex-col max-w-xs lg:max-w-md ${
                  isCurrentUser(message.senderId) ? "items-end" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-sm font-medium ${
                      isCurrentUser(message.senderId)
                        ? "text-indigo-600 order-last"
                        : "text-gray-900"
                    }`}
                  >
                    {isCurrentUser(message.senderId)
                      ? "You"
                      : message.senderName ||
                        getParticipantName(message.senderId)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(message.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div
                  className={`rounded-lg px-3 py-2 text-sm break-all ${
                    isCurrentUser(message.senderId)
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        <div ref={messagesEndRef} />
      </div>

      {/* Reaction Buttons */}
      <div className="border-t border-gray-200 p-2 flex-shrink-0 overflow-hidden">
        <div className="flex justify-center">
          <ReactionButtons
            roomId={roomId}
            videoRef={videoRef}
            currentUser={user}
          />
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <TextareaAutosize
              ref={textareaRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              value={input}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="block w-full resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <Button
            isLoading={isLoading}
            onClick={sendMessage}
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoomChat;
