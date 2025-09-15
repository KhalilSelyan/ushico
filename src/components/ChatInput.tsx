"use client";
import { User } from "better-auth";
import { FC, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import Button from "./ui/ButtonOld";
import axios from "axios";
import toast from "react-hot-toast";
import { getWebSocketService } from "@/lib/websocket";

interface ChatInputProps {
  chatId: string;
  user: User;
  chatPartner: User;
}

const ChatInput: FC<ChatInputProps> = ({ chatId, chatPartner, user }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sendChatMessage = async () => {
    if (!input) return toast.error("Please enter a message.");
    setIsLoading(true);

    try {
      const response = await axios.post("/api/message/send", {
        chatId,
        text: input,
      });

      if (response.status !== 200) {
        throw new Error(response.data.error || "Failed to send message");
      }

      const messageData = response.data.messageData;
      const wsService = getWebSocketService(user.id);

      // Send the message via WebSocket to chat channel
      await wsService.send(`chat:${chatId}:messages`, "incoming_message", {
        ...messageData,
        timestamp: new Date().toISOString(),
      });

      // Send notification to the receiver's channel
      await wsService.send(`user:${chatPartner.id}:chats`, "new_message", {
        ...messageData,
        senderImg: user.image,
        senderName: user.name,
        timestamp: new Date().toISOString(),
      });

      setInput("");
      textareaRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 px-4 pt-4 mb-2 sm:mb-0">
      <div className="relative flex-1 overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-indigo-600">
        <TextareaAutosize
          ref={textareaRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendChatMessage();
            }
          }}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${chatPartner.name}`}
          className="block w-full resize-none border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:py-1.5 sm:text-sm sm:leading-6"
        />

        <div
          onClick={() => textareaRef.current?.focus()}
          className="py-2"
          aria-hidden="true"
        >
          <div className="py-px">
            <div className="h-8" />
          </div>
        </div>

        <div className="absolute bottom-0 right-0 flex justify-between py-2 pl-4 pr-2">
          <div className="flex-shrink-0">
            <Button
              isLoading={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
              onClick={sendChatMessage}
              type="submit"
              disabled={isLoading || !input}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
