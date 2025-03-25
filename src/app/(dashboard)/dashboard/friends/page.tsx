import { auth } from "@/auth/auth";
import { getFriendsById } from "@/helpers/getfriendsbyid";
import { headers } from "next/headers";
import FriendsPageClient from "@/components/FriendsPageClient";
import db from "@/db";
import { friendRequest } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function FriendsPage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });
  if (!session?.user?.id) {
    return null;
  }

  const [initialFriends, initialFriendRequests] = await Promise.all([
    getFriendsById(session.user.id),
    db.query.friendRequest.findMany({
      where: eq(friendRequest.receiverId, session.user.id),
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
  ]);

  // Transform friend requests to match the expected format
  const transformedFriendRequests = initialFriendRequests.map((request) => ({
    senderId: request.sender.id,
    senderName: request.sender.name || "",
    senderEmail: request.sender.email,
    senderImage: request.sender.image || "",
  }));

  return (
    <FriendsPageClient
      initialFriends={initialFriends}
      initialFriendRequests={transformedFriendRequests}
      userId={session.user.id}
    />
  );
}
