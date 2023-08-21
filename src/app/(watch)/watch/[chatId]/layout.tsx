import { getChatMessages } from "@/app/(dashboard)/dashboard/chat/[chatId]/page";
import ChatInput from "@/components/ChatInput";
import { Icon, Icons } from "@/components/Icons";
import Messages from "@/components/Messages";
import MobileChatWatchLayout from "@/components/MobileChatWatchLayout";
import SignoutButton from "@/components/SignoutButton";
import { getFriendsById } from "@/helpers/getfriendsbyid";
import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
  params: {
    chatId: string;
  };
}
type SidebarOption = {
  id: number;
  name: string;
  href: string;
  Icon: Icon;
};
const sidebarOptions: SidebarOption[] = [
  {
    id: 1,
    name: "Add Friend",
    href: "/dashboard/add",
    Icon: "UserPlus",
  },
];

const Layout = async ({ children, params }: LayoutProps) => {
  const { chatId } = params;
  const session = await getServerSession(authOptions);
  if (!session) return notFound();
  const unseenRequestCount = (
    (await fetchRedis(
      "smembers",
      `user:${session.user.id}:incoming_friend_requests`
    )) as User[]
  ).length;

  const friends = await getFriendsById(session.user.id);

  const chatPartnerId = chatId.split("--").find((id) => id !== session.user.id);

  const chatPartner = friends.find((friend) => friend.id === chatPartnerId)!;

  const initialMessages = await getChatMessages(chatId);

  return (
    <div className="w-full h-screen flex">
      <div className="md:hidden">
        <MobileChatWatchLayout
          chatId={chatId}
          user={session.user}
          chatPartner={chatPartner}
          initialMessages={initialMessages}
        />
      </div>

      <div className="hidden md:flex h-full w-full max-w-xs grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
        <Link href="/dashboard" className="flex h-16 shrink-0 items-center">
          <Icons.Logo className="h-8 w-auto text-indigo-600" />
        </Link>
        <nav className="flex flex-col flex-1">
          <ul
            role="list"
            className="flex flex-1 flex-col gap-y-4 justify-between"
          >
            <li className="max-h-[36rem]">
              <Messages
                chatId={chatId}
                user={session.user}
                chatPartner={chatPartner}
                initialMessages={initialMessages}
              />
            </li>
            <li className="-mx-6 flex flex-col w-full justify-center">
              <ChatInput
                chatId={chatId}
                user={session.user}
                chatPartner={chatPartner}
              />
              <div className="flex flex-row items-center">
                <div className="flex flex-1 items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900">
                  <div className="relative h-8 w-8 bg-gray-50">
                    <Image
                      fill
                      referrerPolicy="no-referrer"
                      className="rounded-full"
                      src={session.user.image || ""}
                      alt="user profile image"
                    />
                  </div>
                  <span className="sr-only">Your Profile</span>
                  <div className="flex flex-col">
                    <span aria-hidden="true">{session.user.name}</span>
                    <span className="text-xs text-zinc-400" aria-hidden="true">
                      {session.user.email}
                    </span>
                  </div>
                </div>
                <SignoutButton className="h-full aspect-square" />
              </div>
            </li>
          </ul>
        </nav>
      </div>
      <aside className="max-h-[100dvh] pt-16 md:pt-12 container w-full">
        {children}
      </aside>
    </div>
  );
};

export default Layout;
