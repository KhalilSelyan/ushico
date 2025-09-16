import { auth } from "@/auth/auth";
import { cleanupUserEphemeralRooms } from "@/db/queries";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const cleanedCount = await cleanupUserEphemeralRooms(session.user.id);

    return NextResponse.json({
      success: true,
      cleanedRooms: cleanedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}