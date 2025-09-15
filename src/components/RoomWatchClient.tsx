"use client";

import { User } from "better-auth";
import { useState, useEffect, useRef } from "react";
import VideoPlayer from "./VideoPlayer";
import RoomChat from "./RoomChat";
import RoomInviteModal from "./RoomInviteModal";
import WatchHeaderClient from "./WatchHeaderClient";
import { MessageSquare, X, UserPlus } from "lucide-react";
import { Room } from "@/db/schema";
import { useUserPresence } from "@/hooks/useUserPresence";
import { PresenceBadge } from "@/components/PresenceIndicator";

interface RoomWatchClientProps {
  roomId: string;
  userRole: "host" | "viewer";
  participants: (User & { role: string })[];
  user: User;
  room: Room;
  hostName: string;
}

const RoomWatchClient = ({
  roomId,
  userRole,
  participants,
  user,
  room,
  hostName,
}: RoomWatchClientProps) => {
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize presence tracking
  const { presence, currentState } = useUserPresence(roomId, user.id, user.name || "", participants);

  // Fetch user's friends for inviting
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await fetch("/api/friends/list");
        if (response.ok) {
          const data = await response.json();
          setFriends(data.friends || []);
        }
      } catch (error) {
        console.error("Failed to fetch friends:", error);
      }
    };

    void fetchFriends();
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <WatchHeaderClient
        hostName={hostName}
        roomName={room.name}
        participantCount={participants.length}
        participants={participants}
        presence={presence}
      />
      <div className="flex flex-1 gap-4 p-4">
      {/* Video Player Section */}
      <div className="flex-1 min-w-0 relative">
        <VideoPlayer
          roomId={roomId}
          userRole={userRole}
          participants={participants}
          user={user}
          videoRef={videoRef}
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

        {/* Invite Button - Desktop */}
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="hidden lg:block absolute top-4 right-4 bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg z-10 transition-colors"
          title="Invite friends"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* Invite Button - Mobile */}
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="lg:hidden absolute bottom-20 right-4 bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg z-10 transition-colors"
          title="Invite friends"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Chat Panel - Hidden on mobile, visible on large screens */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <RoomChat
          roomId={roomId}
          user={user}
          participants={participants}
          videoRef={videoRef}
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
                videoRef={videoRef}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <RoomInviteModal
        room={room}
        friends={friends}
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      </div>
    </div>
  );
};

export default RoomWatchClient;