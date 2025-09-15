import { auth } from "@/auth/auth";
import { getRoomById } from "@/db/queries";
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

  // Only validate that the room exists and is active in layout
  // Access validation is handled by individual pages
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