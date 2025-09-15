import { auth } from "@/auth/auth";
import { getRoomByCode } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = z
      .object({
        code: z.string().min(1, "Room code is required"),
      })
      .parse(body);

    const room = await getRoomByCode(code);

    if (!room || !room.isActive) {
      return new Response("Room not found", { status: 404 });
    }

    return NextResponse.json({ roomId: room.id });
  } catch (error) {
    console.error("Find room by code error:", error);
    if (error instanceof z.ZodError) {
      return new Response("Invalid request data", { status: 400 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}