import { auth } from "@/auth/auth";
import { joinRoom, getRoomById, createRoomJoinRequest } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from 'next/server';
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();
    const { method, roomCode, message } = z
      .object({
        method: z.enum(["request", "code"]),
        roomCode: z.string().optional(),
        message: z.string().optional(),
      })
      .parse(body);

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

    // Handle different join methods
    if (method === "code") {
      // Validate room code
      if (!roomCode || roomCode !== roomData.roomCode) {
        return new Response("Invalid room code", {
          status: 400,
        });
      }
      // Join the room immediately with valid code
      await joinRoom(roomId, session.user.id);
    } else if (method === "request") {
      // Create a join request for host approval
      await createRoomJoinRequest(roomId, session.user.id, message);

      return NextResponse.json({
        success: true,
        message: "Join request sent. Waiting for host approval.",
        requiresApproval: true,
      });
    }

    return NextResponse.json({
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