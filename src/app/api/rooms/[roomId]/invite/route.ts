import { auth } from "@/auth/auth";
import { createRoomInvitation, validateRoomAccess } from "@/db/queries";
import { headers } from "next/headers";
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const body = await request.json();
    const { userIds } = z
      .object({
        userIds: z.array(z.string()),
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

    // Validate user has access to room
    const hasAccess = await validateRoomAccess(roomId, session.user.id);
    if (!hasAccess) {
      return new Response("Forbidden", {
        status: 403,
      });
    }

    // Create invitations for each user
    const invitations = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const invitation = await createRoomInvitation(roomId, session.user.id, userId);
        invitations.push(invitation);
      } catch (error) {
        errors.push({
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({
      invitations,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request payload", {
        status: 422,
      });
    }
    console.error("Create room invitations error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}