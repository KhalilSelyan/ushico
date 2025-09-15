import { auth } from "@/auth/auth";
import { getRoomById, validateRoomAccess } from "@/db/queries";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { roomId: string };
}) {
  const { roomId } = params;

  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    return null;
  }

  // Validate access and get room data
  const hasAccess = await validateRoomAccess(roomId, session.user.id);
  if (!hasAccess) {
    notFound();
  }

  const roomData = await getRoomById(roomId);
  if (!roomData || !roomData.isActive) {
    notFound();
  }

  return (
    <div className="h-screen w-screen bg-background">
      {children}
    </div>
  );
}