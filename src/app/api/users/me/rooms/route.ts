import { auth } from "@/auth/auth";
import { getUserRooms, getUserRoomInvitations } from "@/db/queries";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    // Get user's rooms and pending invitations
    const [rooms, invitations] = await Promise.all([
      getUserRooms(session.user.id),
      getUserRoomInvitations(session.user.id),
    ]);

    return Response.json({
      rooms,
      invitations,
    });
  } catch (error) {
    console.error("Get user rooms error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}