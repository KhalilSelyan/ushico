/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "better-auth";
import { Room, RoomInvitation, Message } from "@/db/schema";
import { distanceFromDateInHours, hrefChatConstructor } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import UserRoomsSection from "@/components/UserRoomsSection";
import RoomInvitationsSection from "@/components/RoomInvitationsSection";
import CreateRoomModal from "@/components/CreateRoomModal";

type FriendWithLastMessage = User & {
  lastMessage: Message | null;
};

interface DashboardClientProps {
  user: User;
  friends: User[];
  friendsWithLastMessage: FriendWithLastMessage[];
  rooms: Room[];
  invitations: (RoomInvitation & { room: Room & { host: User }; inviter: User })[];
}

export default function DashboardClient({
  user,
  friends,
  friendsWithLastMessage,
  rooms: initialRooms,
  invitations: initialInvitations,
}: DashboardClientProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);

  // Check for migration query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const migrateChatId = searchParams.get("migrate");

    if (migrateChatId) {
      // Show migration modal or automatically migrate
      setIsCreateRoomModalOpen(true);
    }
  }, []);

  const handleCreateRoom = () => {
    setIsCreateRoomModalOpen(true);
  };

  const handleRoomCreated = (newRoom: Room) => {
    setRooms(prev => [...prev, newRoom]);
    router.push(`/watch/room/${newRoom.id}`);
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/watch/room/${roomId}`);
  };

  const handleRoomsChange = () => {
    // Refresh to get updated room list
    router.refresh();
  };

  const handleInvitationResponse = async (
    invitationId: string,
    status: "accepted" | "declined"
  ) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to respond to invitation");
      }

      // Remove invitation from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // If accepted, refresh the page to show the new room
      if (status === "accepted") {
        router.refresh();
      }
    } catch (error) {
      console.error("Error responding to invitation:", error);
    }
  };

  return (
    <div className="container py-12 space-y-8">
      {/* Room Invitations */}
      {invitations.length > 0 && (
        <RoomInvitationsSection
          invitations={invitations}
          onRespond={handleInvitationResponse}
        />
      )}

      {/* Watch Parties */}
      <UserRoomsSection
        rooms={rooms}
        user={user}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onRoomsChange={handleRoomsChange}
      />

      {/* Recent Chats */}
      <div className="space-y-4">
        <h1 className="font-bold text-3xl">Recent chats</h1>
        {friendsWithLastMessage.length > 0 ? (
          <div className="space-y-2">
            {friendsWithLastMessage
              .sort((a, b) => {
                return (
                  new Date(b.lastMessage?.timestamp || 0).getTime() -
                  new Date(a.lastMessage?.timestamp || 0).getTime()
                );
              })
              .map((friend) => (
                <div
                  key={friend.id}
                  className="border border-zinc-200 bg-zinc-50 relative p-4 rounded-md"
                >
                  <div className="absolute right-4 inset-y-0 flex items-center">
                    <div className="hidden md:block text-sm text-zinc-500 mr-2">
                      {friend.lastMessage
                        ? distanceFromDateInHours(
                            new Date(friend.lastMessage.timestamp)
                          )
                        : null}
                    </div>
                    <ChevronRight className="w-6 h-6 text-zinc-400" />
                  </div>
                  <Link
                    href={`/dashboard/chat/${hrefChatConstructor(
                      user.id,
                      friend.id
                    )}`}
                  >
                    <div className="flex items-center w-full">
                      <div className="relative h-8 w-8 sm:w-12 sm:h-12 aspect-square">
                        <img
                          src={friend.image || ""}
                          alt={friend.name}
                          className="rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col w-full px-6 sm:px-8">
                        <span className="font-bold">{friend.name}</span>
                        {friend.lastMessage && (
                          <div className="flex justify-between w-full items-center">
                            <div className="text-sm text-zinc-500">
                              {friend.lastMessage.senderId === user.id && (
                                <span className="mr-1">You: </span>
                              )}
                              {friend.lastMessage.text}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-500">
            You don&apos;t have any chats yet
          </p>
        )}
      </div>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        onRoomCreated={handleRoomCreated}
        friends={friends}
      />
    </div>
  );
}