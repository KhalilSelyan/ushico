import { getFriendsById } from "@/helpers/getfriendsbyid";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import axios from "axios";

import { notFound } from "next/navigation";
import { fetchRedis } from "@/helpers/redis";
import { hrefChatConstructor } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const page = async () => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return notFound();
  }
  const friends = await getFriendsById(session.user.id);

  const friendsWithLastMessage = await Promise.allSettled(
    friends.map(async (friend) => {
      const [lastMessage] = await fetchRedis(
        "zrange",
        `chat:${hrefChatConstructor(session.user.id, friend.id)}:messages`,
        -1,
        -1
      );
      return {
        ...friend,
        lastMessage: lastMessage ? JSON.parse(lastMessage) : null,
      };
    })
  );

  const failedFriends = friendsWithLastMessage.filter(
    (friend) => friend.status === "rejected"
  );

  const fulfilledFriends = friendsWithLastMessage
    .filter(
      (
        friend
      ): friend is PromiseFulfilledResult<{
        lastMessage: Message | null;
        name: string;
        email: string;
        image: string;
        id: string;
      }> => friend.status === "fulfilled"
    )
    .map((friend) => friend.value);

  return (
    <div className="container py-12">
      <h1 className="font-bold text-5xl mb-8">Recent chats</h1>
      {fulfilledFriends.length > 0 ? (
        fulfilledFriends.map((friend) => {
          return (
            <div
              key={friend.id}
              className="border border-zinc-200 bg-zinc-50 relative p-4 rounded-md"
            >
              <div className="absolute right-4 inset-y-0 flex items-center">
                <ChevronRight className="w-6 h-6 text-zinc-400" />
              </div>
              <Link
                href={`/dashboard/chat/${hrefChatConstructor(
                  session.user.id,
                  friend.id
                )}`}
              >
                <div className="flex items-center">
                  <div className="relative w-12 h-12 mr-4">
                    <Image
                      src={friend.image}
                      alt={friend.name}
                      className="rounded-full"
                      layout="fill"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold">{friend.name}</span>
                    {friend.lastMessage && (
                      <div className="flex items-center">
                        <span className="text-sm text-zinc-500">
                          {friend.lastMessage.senderId === session.user.id && (
                            <span className="mr-1">You: </span>
                          )}
                          {friend.lastMessage.text}
                        </span>
                        <span className="text-sm text-zinc-500 ml-2">
                          at{" "}
                          {new Date(
                            friend.lastMessage.timestamp
                          ).toLocaleString()}
                        </span>
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
