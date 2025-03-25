import { auth } from "@/auth/auth";
import { denyFriendRequest } from "@/db/queries";
import { headers } from "next/headers";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });
    if (!session) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    const body = await req.json();
    const { id: idToDeny } = z
      .object({
        id: z.string(),
      })
      .parse(body);

    await denyFriendRequest(session.user.id, idToDeny);

    return new Response("OK", {
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return new Response("Invalid request payload", {
        status: 422,
      });
    else {
      return new Response("Invalid Request", {
        status: 400,
      });
    }
  }
}
