import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { getFriendsById } from "@/helpers/getfriendsbyid";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const friends = await getFriendsById(session.user.id);

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Error getting friends:", error);
    return NextResponse.json(
      { error: "Failed to get friends" },
      { status: 500 }
    );
  }
}
