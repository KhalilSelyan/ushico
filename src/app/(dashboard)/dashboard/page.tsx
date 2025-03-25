/* eslint-disable @next/next/no-img-element */
import { auth } from "@/auth/auth";
import { getChatMessages } from "@/db/queries";
import type { Message } from "@/db/schema";
import { getFriendsById } from "@/helpers/getfriendsbyid";
import { distanceFromDateInHours, hrefChatConstructor } from "@/lib/utils";
import type { User } from "better-auth";
import { ChevronRight } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

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

  const friends = await getFriendsById(session.user.id);

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

  const failedFriends = friendsWithLastMessage.filter(
    (friend) => friend.status === "rejected"
  );

  const fulfilledFriends = friendsWithLastMessage
    .filter(
      (friend): friend is PromiseFulfilledResult<FriendWithLastMessage> =>
        friend.status === "fulfilled"
    )
    .map((friend) => friend.value);

  return (
    <div className="container py-12">
      <h1 className="font-bold text-5xl mb-8">Recent chats</h1>
      {fulfilledFriends.length > 0 ? (
        fulfilledFriends
          .sort((a, b) => {
            return (
              new Date(b.lastMessage?.timestamp || 0).getTime() -
              new Date(a.lastMessage?.timestamp || 0).getTime()
            );
          })
          .map((friend) => {
            return (
              <div
                key={friend.id}
                className="border border-zinc-200 bg-zinc-50 relative p-4 rounded-md"
              >
                <div className="absolute right-4 inset-y-0 flex items-center">
                  <div className="hidden md:block text-sm text-zinc-500 mr-2">
                    {friend.lastMessage
                      ? distanceFromDateInHours(
                          new Date(friend.lastMessage.timestamp)
                        )
                      : null}
                  </div>
                  <ChevronRight className="w-6 h-6 text-zinc-400" />
                </div>
                <Link
                  href={`/dashboard/chat/${hrefChatConstructor(
                    session.user.id,
                    friend.id
                  )}`}
                >
                  <div className="flex items-center w-full">
                    <div className="relative h-8 w-8 sm:w-12 sm:h-12 aspect-square">
                      <img
                        src={friend.image || ""}
                        alt={friend.name}
                        className="rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col w-full px-6 sm:px-8">
                      <span className="font-bold">{friend.name}</span>
                      {friend.lastMessage && (
                        <div className="flex justify-between w-full items-center">
                          <div className="text-sm text-zinc-500">
                            {friend.lastMessage.senderId ===
                              session.user.id && (
                              <span className="mr-1">You: </span>
                            )}
                            {friend.lastMessage.text}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })
      ) : (
        <p className="text-center text-sm text-zinc-500">
          You don&apos;t have any chats yet
        </p>
      )}
    </div>
  );
};

export default page;
