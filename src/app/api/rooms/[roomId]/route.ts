import { auth } from "@/auth/auth";
import { getRoomById, validateRoomAccess, leaveRoom, deactivateRoom, isRoomHost } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
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

    // Validate user has access to room
    const hasAccess = await validateRoomAccess(roomId, session.user.id);
    if (!hasAccess) {
      return new Response("Forbidden", {
        status: 403,
      });
    }

    // Get room details with participants and recent messages
    const roomData = await getRoomById(roomId);

    if (!roomData) {
      return new Response("Room not found", {
        status: 404,
      });
    }

    return NextResponse.json({
      room: roomData,
      participants: roomData.participants.map(p => ({
        ...p.user,
        role: p.role,
      })),
      messages: roomData.messages,
    });
  } catch (error) {
    console.error("Get room error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}

export async function DELETE(
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

    // Check if user is host or participant
    const isHost = await isRoomHost(roomId, session.user.id);
    const hasAccess = await validateRoomAccess(roomId, session.user.id);

    if (!hasAccess) {
      return new Response("Forbidden", {
        status: 403,
      });
    }

    if (isHost) {
      // Host deactivates the room
      await deactivateRoom(roomId);
    } else {
      // Participant leaves the room
      await leaveRoom(roomId, session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave/deactivate room error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}