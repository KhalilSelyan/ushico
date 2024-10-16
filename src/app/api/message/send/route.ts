import { fetchRedis, redis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import { Message, messageValidator } from "@/lib/validators/messages";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  try {
    const {
      text,
      chatId,
    }: {
      text: string;
      chatId: string;
    } = await req.json();

    const session = await getServerSession(authOptions);
    if (!session) throw new Response("Unauthorized", { status: 401 });
    const { user } = session;

    const [userId1, userId2] = chatId.split("--");
    if (user.id !== userId1 && user.id !== userId2)
      throw new Response("Unauthorized", { status: 401 });

    const receiverId = user.id === userId1 ? userId2 : userId1;

    const friendList = (await fetchRedis(
      "smembers",
      `unstorage:user:${user.id}:friends`
    )) as string[];
    if (!friendList.includes(receiverId))
      throw new Response("Unauthorized", { status: 401 });

    const sender = JSON.parse(
      (await fetchRedis("get", `unstorage:user:${user.id}`)) as string
    ) as User;

    const timestamp = Date.now();

    const messageData: Message = {
      id: nanoid(),
      senderId: user.id,
      text,
      timestamp,
    };

    const message = messageValidator.parse(messageData);

    await redis.zadd(
      `chat:${chatId}:messages`,
      timestamp,
      JSON.stringify(message)
    );

    pusherServer.trigger(
      toPusherKey(`chat:${chatId}:messages`),
      "incoming_message",
      message
    );

    pusherServer.trigger(
      toPusherKey(`unstorage:user:${receiverId}:chats`),
      "new_message",
      {
        ...message,
        senderImg: sender.image,
        senderName: sender.name,
      }
    );

    return new Response("Message sent", { status: 200 });
  } catch (error) {
    if (error instanceof Error)
      return new Response(error.message, { status: 500 });

    return new Response("Internal server error", { status: 500 });
  }
}
