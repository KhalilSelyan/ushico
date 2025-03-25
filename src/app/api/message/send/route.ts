import { auth } from "@/auth/auth";
import { sendMessage } from "@/db/queries";
import { messageValidator } from "@/lib/validators/messages";
import { headers } from "next/headers";
import { z } from "zod";

// Define request schema
const messageRequestSchema = z.object({
  text: z.string().min(1).max(2000), // Adjust max length as needed
  chatId: z.string().regex(/^[\w-]+--[\w-]+$/),
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
    const session = await auth.api.getSession({
      headers: headers(),
    });
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

    // 5. Send message
    const message = await sendMessage({
      chatId,
      senderId: user.id,
      text,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message sent successfully",
        messageData: message,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
