import { auth } from "@/auth/auth";
import { joinRoom, getRoomById } from "@/db/queries";
import { headers } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    const { roomId } = params;

    // Check if room exists and is active
    const roomData = await getRoomById(roomId);
    if (!roomData || !roomData.isActive) {
      return new Response("Room not found or inactive", {
        status: 404,
      });
    }

    // Join the room
    await joinRoom(roomId, session.user.id);

    return Response.json({
      success: true,
      room: roomData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User is already in room") {
      return new Response("User is already in room", {
        status: 409,
      });
    }
    console.error("Join room error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}