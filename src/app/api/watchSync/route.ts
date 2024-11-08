import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { getServerSession } from "next-auth";
import { z } from "zod"; // You'll need to install zod if not already present

// Input validation schema
const syncRequestSchema = z.object({
  timestamp: z.number(),
  chatId: z.string().regex(/^[\w-]+--[\w-]+$/),
  url: z.string().url(),
  state: z.any(),
});

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
    const result = syncRequestSchema.safeParse(body);
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: result.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { timestamp, chatId, url, state } = result.data;

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

    // 5. Get receiver ID
    const receiverId = user.id === userId1 ? userId2 : userId1;

    // 6. Friend validation with Redis error handling
    let friendList: string[];
    try {
      friendList = (await fetchRedis(
        "smembers",
        `unstorage:user:${user.id}:friends`
      )) as string[];
    } catch (error) {
      console.error("Redis error:", error);
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

    // 7. Pusher trigger with error handling
    try {
      await pusherServer.trigger(`sync-${chatId}`, "sync", {
        timestamp,
        url,
        state,
      });
    } catch (error) {
      console.error("Pusher error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to sync via Pusher" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 8. Success response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // 9. Catch-all error handler
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
