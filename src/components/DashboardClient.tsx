/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "better-auth";
import { Room, RoomInvitation } from "@/db/schema";
import UserRoomsSection from "@/components/UserRoomsSection";
import RoomInvitationsSection from "@/components/RoomInvitationsSection";
import CreateRoomModal from "@/components/CreateRoomModal";
import { getWebSocketService } from "@/lib/websocket";
import { useDailyCleanup } from "@/hooks/useDailyCleanup";

interface DashboardClientProps {
  user: User;
  friends: User[];
  rooms: Room[];
  invitations: (RoomInvitation & { room: Room & { host: User }; inviter: User })[];
}

export default function DashboardClient({
  user,
  friends,
  rooms: initialRooms,
  invitations: initialInvitations,
}: DashboardClientProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);

  // Run daily cleanup for user's ephemeral rooms
  useDailyCleanup();

  // Check for migration query parameter and set up WebSocket listeners
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const migrateChatId = searchParams.get("migrate");

    if (migrateChatId) {
      // Show migration modal or automatically migrate
      setIsCreateRoomModalOpen(true);
    }

    // Set up WebSocket listeners for join request responses
    const wsService = getWebSocketService(user.id);

    const unsubscribeApproved = wsService.subscribe(
      `user-${user.id}`,
      "join_request_approved",
      (data: any) => {
        // Show success notification and optionally redirect to room
        console.log("Join request approved:", data);
        router.push(`/watch/room/${data.roomId}`);
      }
    );

    const unsubscribeDenied = wsService.subscribe(
      `user-${user.id}`,
      "join_request_denied",
      (data: any) => {
        // Show denial notification
        console.log("Join request denied:", data);
      }
    );

    const unsubscribeInvitation = wsService.subscribe(
      `user-${user.id}`,
      "room_invitation",
      (data: any) => {
        // Add invitation to list
        console.log("Room invitation received:", data);
        router.refresh(); // Refresh to show new invitation
      }
    );

    return () => {
      Promise.all([
        unsubscribeApproved.then(unsub => unsub()),
        unsubscribeDenied.then(unsub => unsub()),
        unsubscribeInvitation.then(unsub => unsub())
      ]);
    };
  }, [user.id, router]);

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

  const handleRoomRemoved = (roomId: string) => {
    // Optimistically remove the room from local state
    setRooms(prev => prev.filter(room => room.id !== roomId));
    // Also refresh from server
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
        onRoomRemoved={handleRoomRemoved}
      />


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