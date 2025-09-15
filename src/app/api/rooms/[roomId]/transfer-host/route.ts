import { auth } from "@/auth/auth";
import { transferRoomHost, isRoomHost, validateRoomAccess } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();
    const { newHostId } = z
      .object({
        newHostId: z.string(),
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

    // Check if current user is the host
    const isCurrentHost = await isRoomHost(roomId, session.user.id);
    if (!isCurrentHost) {
      return new Response("Only host can transfer ownership", {
        status: 403,
      });
    }

    // Check if new host is in the room
    const newHostInRoom = await validateRoomAccess(roomId, newHostId);
    if (!newHostInRoom) {
      return new Response("New host must be in the room", {
        status: 400,
      });
    }

    // Transfer host
    await transferRoomHost(roomId, newHostId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request payload", {
        status: 422,
      });
    }
    console.error("Transfer host error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}
