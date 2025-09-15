import { auth } from "@/auth/auth";
import {
  getRoomMessages,
  sendRoomMessage,
  validateRoomAccess,
} from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

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

    // Get room messages
    const messages = await getRoomMessages(roomId, limit);

    return new Response(JSON.stringify({ messages }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Get room messages error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();
    const { text } = z
      .object({
        text: z.string().min(1, "Message text is required"),
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

    // Send room message (validation happens in the function)
    const message = await sendRoomMessage(roomId, session.user.id, text);

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request payload", {
        status: 422,
      });
    }
    if (error instanceof Error && error.message === "User is not in room") {
      return new Response("User is not in room", {
        status: 403,
      });
    }
    console.error("Send room message error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}
