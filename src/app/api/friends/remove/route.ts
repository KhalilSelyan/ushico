import { auth } from "@/auth/auth";
import db from "@/db";
import { friend } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { friendId } = await req.json();

    // Delete both sides of the friendship
    await db.transaction(async (tx) => {
      await tx
        .delete(friend)
        .where(
          and(eq(friend.userId, session.user.id), eq(friend.friendId, friendId))
        );

      await tx
        .delete(friend)
        .where(
          and(eq(friend.userId, friendId), eq(friend.friendId, session.user.id))
        );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing friend:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
