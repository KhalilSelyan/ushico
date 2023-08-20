import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import { AxiosError } from "axios";
import { getServerSession } from "next-auth";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id: idToAccept } = z
      .object({
        id: z.string(),
      })
      .parse(body);

    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    // check if already friends
    const alreadyFriends = await fetchRedis(
      "sismember",
      `user:${session.user.id}:friends`,
      idToAccept
    );
    if (alreadyFriends) {
      return new Response("Already friends", {
        status: 400,
      });
    }

    // check if already received request
    const alreadyReceived = await fetchRedis(
      "sismember",
      `user:${session.user.id}:incoming_friend_requests`,
      idToAccept
    );
    if (!alreadyReceived) {
      return new Response("No friend request", {
        status: 400,
      });
    }

    const [userRaw, friendRaw] = (await Promise.all([
      fetchRedis("get", `user:${session.user.id}`),
      fetchRedis("get", `user:${idToAccept}`),
    ])) as [string, string];

    const [user, friend] = [userRaw, friendRaw].map((x) => JSON.parse(x));

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`user:${idToAccept}:friends`),
        "new_friend",
        user
      ),
      pusherServer.trigger(
        toPusherKey(`user:${session.user.id}:friends`),
        "new_friend",
        friend
      ),
      db.sadd(`user:${session.user.id}:friends`, idToAccept),
      db.sadd(`user:${idToAccept}:friends`, session.user.id),
      db.srem(`user:${session.user.id}:incoming_friend_requests`, idToAccept),
    ]);

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
