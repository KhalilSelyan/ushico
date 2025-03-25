import { auth } from "@/auth/auth";
import { acceptFriendRequest } from "@/db/queries";
import { headers } from "next/headers";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id: idToAccept } = z
      .object({
        id: z.string(),
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

    await acceptFriendRequest(session.user.id, idToAccept);

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
