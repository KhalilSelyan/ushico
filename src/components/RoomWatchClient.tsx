"use client";

import { User } from "better-auth";
import { useState } from "react";
import VideoPlayer from "./VideoPlayer";
import RoomChat from "./RoomChat";
import { MessageSquare, X } from "lucide-react";

interface RoomWatchClientProps {
  roomId: string;
  userRole: "host" | "viewer";
  participants: (User & { role: string })[];
  user: User;
}

const RoomWatchClient = ({
  roomId,
  userRole,
  participants,
  user,
}: RoomWatchClientProps) => {
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  return (
    <div className="flex flex-1 gap-4 p-4">
      {/* Video Player Section */}
      <div className="flex-1 min-w-0 relative">
        <VideoPlayer
          roomId={roomId}
          userRole={userRole}
          participants={participants}
          user={user}
        />

        {/* Mobile Chat Toggle Button */}
        <button
          onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
          className="lg:hidden absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg z-10 transition-colors"
        >
          {isMobileChatOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageSquare className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Desktop Chat Panel - Hidden on mobile, visible on large screens */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <RoomChat
          roomId={roomId}
          user={user}
          participants={participants}
          className="h-full"
        />
      </div>

      {/* Mobile Chat Overlay */}
      {isMobileChatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
          <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-white rounded-t-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Room Chat</h3>
              <button
                onClick={() => setIsMobileChatOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="h-full pb-16">
              <RoomChat
                roomId={roomId}
                user={user}
                participants={participants}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomWatchClient;