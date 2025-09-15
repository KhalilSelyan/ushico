import { auth } from "@/auth/auth";
import { getRoomById, isRoomHost } from "@/db/queries";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import RoomManageClient from "@/components/RoomManageClient";

interface RoomManagePageProps {
  params: { roomId: string };
}

export default async function RoomManagePage({ params }: RoomManagePageProps) {
  const { roomId } = params;

  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user is host
  const isHost = await isRoomHost(roomId, session.user.id);
  if (!isHost) {
    notFound();
  }

  // Get room data
  const roomData = await getRoomById(roomId);
  if (!roomData || !roomData.isActive) {
    notFound();
  }

  return (
    <div className="container py-12">
      <RoomManageClient room={roomData} user={session.user} />
    </div>
  );
}