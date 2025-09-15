/* eslint-disable @next/next/no-img-element */
import { auth } from "@/auth/auth";
import { getChatMessages, getUserRooms, getUserRoomInvitations } from "@/db/queries";
import type { Message } from "@/db/schema";
import { getFriendsById } from "@/helpers/getfriendsbyid";
import { distanceFromDateInHours, hrefChatConstructor } from "@/lib/utils";
import type { User } from "better-auth";
import { ChevronRight } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import DashboardClient from "@/components/DashboardClient";

type FriendWithLastMessage = User & {
  lastMessage: Message | null;
};

const page = async () => {
  const session = await auth.api.getSession({
    headers: headers(),
  });
  if (!session?.user?.id) {
    return null;
  }

  // Fetch all data in parallel
  const [friends, rooms, invitations] = await Promise.all([
    getFriendsById(session.user.id),
    getUserRooms(session.user.id),
    getUserRoomInvitations(session.user.id),
  ]);

  const friendsWithLastMessage = await Promise.allSettled(
    friends.map(async (friend) => {
      const messages = await getChatMessages(
        hrefChatConstructor(session.user.id, friend.id)
      );
      const lastMessage = messages[messages.length - 1] || null;
      return {
        ...friend,
        lastMessage,
      } as FriendWithLastMessage;
    })
  );

  const fulfilledFriends = friendsWithLastMessage
    .filter(
      (friend): friend is PromiseFulfilledResult<FriendWithLastMessage> =>
        friend.status === "fulfilled"
    )
    .map((friend) => friend.value);

  return (
    <DashboardClient
      user={session.user}
      friends={friends}
      friendsWithLastMessage={fulfilledFriends}
      rooms={rooms}
      invitations={invitations}
    />
  );
};

export default page;
