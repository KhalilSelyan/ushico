import { auth } from "@/auth/auth";
import {
  getJoinRequestById,
  respondToJoinRequest,
  joinRoom,
  isRoomHost
} from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string; requestId: string } }
) {
  try {
    const body = await request.json();
    const { action } = z
      .object({
        action: z.enum(["approve", "deny"]),
      })
      .parse(body);

    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { roomId, requestId } = params;

    // Check if user is host
    const isHost = await isRoomHost(roomId, session.user.id);
    if (!isHost) {
      return new Response("Only hosts can respond to join requests", { status: 403 });
    }

    // Get the join request
    const joinRequest = await getJoinRequestById(requestId);
    if (!joinRequest || joinRequest.roomId !== roomId) {
      return new Response("Join request not found", { status: 404 });
    }

    if (joinRequest.status !== "pending") {
      return new Response("Join request already processed", { status: 400 });
    }

    // Update request status
    const status = action === "approve" ? "approved" : "denied";
    await respondToJoinRequest(requestId, status);

    // If approved, add user to room
    if (action === "approve") {
      await joinRoom(roomId, joinRequest.requesterId);
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === "approve" ? "User added to room" : "Request denied"
    });
  } catch (error) {
    console.error("Respond to join request error:", error);
    if (error instanceof z.ZodError) {
      return new Response("Invalid request data", { status: 400 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}