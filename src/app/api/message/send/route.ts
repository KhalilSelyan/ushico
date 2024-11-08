import { fetchRedis, redis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import { Message, messageValidator } from "@/lib/validators/messages";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { z } from "zod";

// Define request schema
const messageRequestSchema = z.object({
  text: z.string().min(1).max(2000), // Adjust max length as needed
  chatId: z.string().regex(/^[\w-]+--[\w-]+$/),
});

interface User {
  id: string;
  name: string;
  image?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate request data
    const result = messageRequestSchema.safeParse(body);
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: result.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { text, chatId } = result.data;

    // 3. Auth validation
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: No valid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Chat ID validation
    const [userId1, userId2] = chatId.split("--");
    if (!userId1 || !userId2) {
      return new Response(JSON.stringify({ error: "Invalid chat ID format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { user } = session;
    if (user.id !== userId1 && user.id !== userId2) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: User not part of chat" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const receiverId = user.id === userId1 ? userId2 : userId1;

    // 5. Friend validation
    let friendList: string[];
    try {
      friendList = (await fetchRedis(
        "smembers",
        `unstorage:user:${user.id}:friends`
      )) as string[];
    } catch (error) {
      console.error("Redis friend list error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch friend list" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!friendList.includes(receiverId)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Users are not friends" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Fetch sender information
    let sender: User;
    try {
      const senderData = await fetchRedis("get", `unstorage:user:${user.id}`);
      if (!senderData) {
        throw new Error("Sender data not found");
      }
      sender = JSON.parse(senderData as string);
    } catch (error) {
      console.error("Redis sender fetch error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch sender information" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7. Create and validate message
    const timestamp = Date.now();
    const messageData: Message = {
      id: nanoid(),
      senderId: user.id,
      text,
      timestamp,
    };

    try {
      messageValidator.parse(messageData);
    } catch (error) {
      console.error("Message validation error:", error);
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 8. Store message in Redis
    try {
      await redis.zadd(
        `chat:${chatId}:messages`,
        timestamp,
        JSON.stringify(messageData)
      );
    } catch (error) {
      console.error("Redis message storage error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store message" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 9. Send Pusher notifications
    try {
      await Promise.all([
        pusherServer.trigger(
          toPusherKey(`chat:${chatId}:messages`),
          "incoming_message",
          messageData
        ),
        pusherServer.trigger(
          toPusherKey(`unstorage:user:${receiverId}:chats`),
          "new_message",
          {
            ...messageData,
            senderImg: sender.image,
            senderName: sender.name,
          }
        ),
      ]);
    } catch (error) {
      console.error("Pusher notification error:", error);
      // Note: Message is stored but notification failed
      return new Response(
        JSON.stringify({
          warning: "Message stored but notification delivery failed",
          messageId: messageData.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 10. Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message sent successfully",
        messageId: messageData.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // 11. Catch-all error handler
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message:
          // @ts-expect-error - error type
          process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
