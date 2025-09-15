import { auth } from "@/auth/auth";
import { createRoom, getUserById } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, inviteUserIds } = z
      .object({
        name: z.string().min(1, "Room name is required"),
        inviteUserIds: z.array(z.string()).optional().default([]),
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

    // Create room with host and optional initial participants
    const room = await createRoom(session.user.id, name, inviteUserIds);

    // Get participant details for response
    const participants = [];
    for (const userId of [session.user.id, ...inviteUserIds]) {
      const user = await getUserById(userId);
      if (user) {
        participants.push(user);
      }
    }

    return NextResponse.json({
      room,
      participants,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request payload", {
        status: 422,
      });
    }
    console.error("Create room error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}
