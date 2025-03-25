import { auth } from "@/auth/auth";
import db from "@/db";
import { friendRequest, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email } = body;

    const friendToAdd = await db.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (!friendToAdd) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if friend request already exists
    const existingRequest = await db.query.friendRequest.findFirst({
      where:
        eq(friendRequest.senderId, session.user.id) &&
        eq(friendRequest.receiverId, friendToAdd.id),
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Friend request already exists" },
        { status: 400 }
      );
    }

    // Create friend request
    const newFriendRequest = {
      id: crypto.randomUUID(),
      senderId: session.user.id,
      receiverId: friendToAdd.id,
      status: "pending",
    };

    await db.insert(friendRequest).values(newFriendRequest);

    return NextResponse.json(
      {
        message: "Friend request sent",
        request: newFriendRequest,
        receiver: {
          id: friendToAdd.id,
          email: friendToAdd.email,
          name: friendToAdd.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[FRIENDS_ADD]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
