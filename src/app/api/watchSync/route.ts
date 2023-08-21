import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  const { timestamp, chatId, url, state } = await req.json();
  const session = await getServerSession(authOptions);
  if (!session) throw new Response("Unauthorized", { status: 401 });
  const { user } = session;
  const [userId1, userId2] = chatId.split("--");
  if (user.id !== userId1 && user.id !== userId2)
    throw new Response("Unauthorized", { status: 401 });
  const receiverId = user.id === userId1 ? userId2 : userId1;

  const friendList = (await fetchRedis(
    "smembers",
    `user:${user.id}:friends`
  )) as string[];
  if (!friendList.includes(receiverId))
    throw new Response("Unauthorized", { status: 401 });

  await pusherServer.trigger(`sync-${chatId}`, "sync", {
    timestamp,
    url,
    state,
  });
}
