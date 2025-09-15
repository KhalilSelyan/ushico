import { auth } from "@/auth/auth";
import { joinRoom, getRoomById } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from 'next/server';
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();
    const { method, roomCode } = z
      .object({
        method: z.enum(["request", "code"]),
        roomCode: z.string().optional(),
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
    } else if (method === "request") {
      // For now, auto-approve join requests
      // In the future, this could require host approval
      console.log(`User ${session.user.name} requested to join room ${roomData.name}`);
    }

    // Join the room
    await joinRoom(roomId, session.user.id);

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