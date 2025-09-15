import { auth } from "@/auth/auth";
import { getRoomById } from "@/db/queries";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import RoomJoinClient from "@/components/RoomJoinClient";

interface RoomJoinPageProps {
  params: { roomId: string };
}

export default async function RoomJoinPage({ params }: RoomJoinPageProps) {
  const { roomId } = params;

  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    return null;
  }

  // Fetch room data to display info
  const roomData = await getRoomById(roomId);
  if (!roomData || !roomData.isActive) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <RoomJoinClient
        room={roomData}
        user={session.user}
      />
    </div>
  );
}