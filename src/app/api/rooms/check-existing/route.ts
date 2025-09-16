import { auth } from "@/auth/auth";
import { findExistingOneOnOneRoom } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { friendId } = z
      .object({
        friendId: z.string(),
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

    // Check for existing 1-on-1 room
    const existingRoom = await findExistingOneOnOneRoom(session.user.id, friendId);

    return NextResponse.json({
      hasExistingRoom: !!existingRoom,
      existingRoom: existingRoom,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request payload", {
        status: 422,
      });
    }
    console.error("Check existing room error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}