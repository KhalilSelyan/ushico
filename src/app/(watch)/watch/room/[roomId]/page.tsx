import { auth } from "@/auth/auth";
import Header from "@/components/WatchHeader";
import RoomWatchClient from "@/components/RoomWatchClient";
import { getRoomById, validateRoomAccess } from "@/db/queries";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

interface RoomWatchPageProps {
  params: { roomId: string };
}

export default async function RoomWatchPage({ params }: RoomWatchPageProps) {
  const { roomId } = params;

  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    return null;
  }

  // Validate user has access to room
  const hasAccess = await validateRoomAccess(roomId, session.user.id);
  if (!hasAccess) {
    notFound();
  }

  // Fetch room data
  const roomData = await getRoomById(roomId);
  if (!roomData || !roomData.isActive) {
    notFound();
  }

  // Determine user role
  const userParticipant = roomData.participants.find(
    p => p.userId === session.user.id
  );
  const userRole = userParticipant?.role || "viewer";

  // Format participants for VideoPlayer
  const participants = roomData.participants.map(p => ({
    ...p.user,
    role: p.role,
  }));

  return (
    <div className="relative no-scrollbar flex h-full w-full flex-col">
      <Header
        userId={roomData.hostId}
        roomName={roomData.name}
        participantCount={participants.length}
      />
      <RoomWatchClient
        roomId={roomId}
        userRole={userRole as "host" | "viewer"}
        participants={participants}
        user={session.user}
        room={roomData}
      />
    </div>
  );
}