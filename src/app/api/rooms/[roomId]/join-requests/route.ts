import { auth } from "@/auth/auth";
import { getRoomJoinRequests, isRoomHost } from "@/db/queries";
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

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { roomId } = params;

    // Check if user is host
    const isHost = await isRoomHost(roomId, session.user.id);
    if (!isHost) {
      return new Response("Only hosts can view join requests", { status: 403 });
    }

    // Get pending join requests
    const requests = await getRoomJoinRequests(roomId);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Get join requests error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}