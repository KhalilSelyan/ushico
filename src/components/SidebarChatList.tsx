/* eslint-disable @next/next/no-img-element */
"use client";
import { hrefChatConstructor } from "@/lib/utils";
import { wsService } from "@/lib/websocket";
import { usePathname, useRouter } from "next/navigation";
import { FC, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface SidebarChatListProps {
  chats: User[];
  userId: string;
}

const SidebarChatList: FC<SidebarChatListProps> = ({ chats, userId }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [unseenMessages, setUnseenMessages] = useState<Message[]>([]);
  const [activeChats, setActiveChats] = useState<User[]>(chats);

  const chatHandler = useCallback(
    (message: any) => {
      const data = message as Message;
      const shouldNotify =
        pathname !==
        `/dashboard/chat/${hrefChatConstructor(userId, data.senderId)}`;
      if (!shouldNotify) return;
      // Show toast and update unseen messages
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="relative h-10 w-10 pt-0.5">
                <img className="rounded-full" src={data.senderImage} alt="" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {data.senderName}
                </p>
                <p className="mt-1 text-sm text-gray-500">{data.text}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col border-l border-gray-200">
            <button
              onClick={() => {
                toast.dismiss(t.id);
              }}
              className="w-full border border-transparent rounded-none rounded-br-lg px-4 py-2 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
            <div className="h-0 flex-1 flex border-t border-gray-200" />
            <button
              onClick={() => {
                toast.dismiss(t.id);
                router.push(
                  `/dashboard/chat/${hrefChatConstructor(
                    userId,
                    data.senderId
                  )}`
                );
                router.refresh();
              }}
              className="w-full border border-transparent rounded-none rounded-br-lg px-4 py-2 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              View
            </button>
          </div>
        </div>
      ));

      setUnseenMessages((prev) => [...prev, data]);
    },
    [pathname, router, userId]
  );

  const friendHandler = useCallback((message: any) => {
    console.log("Received WebSocket message:", message);
    if (message.event === "new_friend") {
      const newFriend = message.data as User;
      setActiveChats((prev) => [...prev, newFriend]);
    }
  }, []);

  useEffect(() => {
    const userChatsChannel = `user:${userId}:chats`;
    const userFriendsChannel = `user:${userId}:friends`;

    console.log(
      "Subscribing to channels:",
      userChatsChannel,
      userFriendsChannel
    );

    const unsubscribeChats = wsService.subscribe(userChatsChannel, chatHandler);
    const unsubscribeFriends = wsService.subscribe(
      userFriendsChannel,
      friendHandler
    );

    return () => {
      console.log(
        "Unsubscribing from channels:",
        userChatsChannel,
        userFriendsChannel
      );
      unsubscribeChats();
      unsubscribeFriends();
    };
  }, [chatHandler, friendHandler, pathname, router, userId]);

  useEffect(() => {
    if (pathname?.includes("chat")) {
      setUnseenMessages((prev) => {
        return prev.filter((message) => !pathname.includes(message.senderId));
      });
    }
  }, [pathname]);
  return (
    <ul role="list" className="max-h-[25rem] overflow-y-auto -mx-2 space-y-2">
      {activeChats.sort().map((friend) => {
        const unseenMessagesCount = unseenMessages.filter(
          (message) => message.senderId === friend.id
        ).length;
        return (
          <li key={friend.id}>
            <a
              href={`/dashboard/chat/${hrefChatConstructor(userId, friend.id)}`}
              className="flex items-center p-2 text-sm leading-6 font-semibold rounded-lg hover:bg-gray-100 text-gray-700 hover:text-indigo-600 gap-x-3"
            >
              {friend.name}
              {unseenMessagesCount > 0 ? (
                <span className="flex h-5 w-5 text-xs items-center justify-center rounded-full bg-indigo-600 text-white">
                  {unseenMessagesCount}
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
};

export default SidebarChatList;
