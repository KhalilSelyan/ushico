import { fetchRedis, redis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { AxiosError } from "axios";
import { getServerSession } from "next-auth";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    const { id: idToDeny } = z
      .object({
        id: z.string(),
      })
      .parse(body);

    // check if already received request
    const alreadyReceived = await fetchRedis(
      "sismember",
      `unstorage:user:${session.user.id}:incoming_friend_requests`,
      idToDeny
    );
    if (!alreadyReceived) {
      return new Response("No friend request", {
        status: 400,
      });
    }

    // remove friend request
    await redis.srem(
      `unstorage:user:${session.user.id}:incoming_friend_requests`,
      idToDeny
    );

    return new Response("OK", {
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return new Response("Invalid request payload", {
        status: 422,
      });
    else if (error instanceof AxiosError)
      return new Response(error.message, {
        status: 400,
      });
    else {
      return new Response("Invalid Request", {
        status: 400,
      });
    }
  }
}
