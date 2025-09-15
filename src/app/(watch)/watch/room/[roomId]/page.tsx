import { auth } from "@/auth/auth";
import RoomWatchClient from "@/components/RoomWatchClient";
import { getRoomById, validateRoomAccessHybrid, autoJoinRoomFromInvitation } from "@/db/queries";
import { getSpecificUserById } from "@/helpers/getfriendsbyid";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

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

  // Fetch room data first to check if room exists
  const roomData = await getRoomById(roomId);
  if (!roomData || !roomData.isActive) {
    notFound();
  }

  // Check room access with hybrid validation
  const accessResult = await validateRoomAccessHybrid(roomId, session.user.id);

  if (!accessResult.hasAccess) {
    // If requires approval, redirect to join request page
    if (accessResult.requiresApproval) {
      redirect(`/watch/room/${roomId}/join`);
    }
    notFound();
  }

  // Auto-join if user has pending invitation
  if (accessResult.reason === "pending_invitation") {
    const joined = await autoJoinRoomFromInvitation(roomId, session.user.id);
    if (!joined) {
      notFound();
    }
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

  // Get host user data
  const hostUser = await getSpecificUserById(roomData.hostId);

  return (
    <div className="relative no-scrollbar flex h-full w-full flex-col">
      <RoomWatchClient
        roomId={roomId}
        userRole={userRole as "host" | "viewer"}
        participants={participants}
        user={session.user}
        room={roomData}
        hostName={hostUser?.name || "Unknown Host"}
      />
    </div>
  );
}