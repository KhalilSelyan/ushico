import { auth } from "@/auth/auth";
import { respondToRoomInvitation } from "@/db/queries";
import { headers } from "next/headers";
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } }
) {
  try {
    const body = await request.json();
    const { status } = z
      .object({
        status: z.enum(["accepted", "declined"]),
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

    const { invitationId } = params;

    // Respond to invitation
    await respondToRoomInvitation(invitationId, status);

    return new Response(JSON.stringify({
      success: true,
      status,
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
    if (error instanceof Error) {
      if (error.message === "Invitation not found") {
        return new Response("Invitation not found", {
          status: 404,
        });
      }
      if (error.message === "Invitation already responded to") {
        return new Response("Invitation already responded to", {
          status: 409,
        });
      }
    }
    console.error("Respond to invitation error:", error);
    return new Response("Internal server error", {
      status: 500,
    });
  }
}