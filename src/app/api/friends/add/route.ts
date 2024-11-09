import { fetchRedis, redis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { addFriendValidator } from "@/lib/validators/add-friend";
import { getServerSession } from "next-auth";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const { email: emailToAdd } = addFriendValidator.parse(email);

    const idToAdd = (await fetchRedis(
      "get",
      `unstorage:user:email:${emailToAdd}`
    )) as string;

    if (!idToAdd) {
      return new Response("This user does not exist", { status: 400 });
    }

    const session = await getServerSession(authOptions);

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (idToAdd === session.user.id) {
      return new Response("Cannot add yourself", { status: 400 });
    }

    // Check if already added
    const isAlreadyAdded = (await fetchRedis(
      "sismember",
      `unstorage:user:${idToAdd}:incoming_friend_requests`,
      session.user.id
    )) as 0 | 1;
    if (isAlreadyAdded) {
      return new Response("Already added", { status: 400 });
    }

    // Check if already friends
    const isAlreadyFriend = (await fetchRedis(
      "sismember",
      `unstorage:user:${session.user.id}:friends`,
      idToAdd
    )) as 0 | 1;
    if (isAlreadyFriend) {
      return new Response("Already friends", { status: 400 });
    }

    // Valid request, add to Redis
    await redis.sadd(
      `unstorage:user:${idToAdd}:incoming_friend_requests`,
      session.user.id
    );

    // Return the idToAdd to the client
    return new Response(JSON.stringify({ idToAdd }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(err.message, { status: 400 });
    }

    return new Response("Invalid request payload", { status: 500 });
  }
}
