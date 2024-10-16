import ChatInput from "@/components/ChatInput";
import Messages from "@/components/Messages";
import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { messageListValidator } from "@/lib/validators/messages";
import { MonitorPlay, User2Icon } from "lucide-react";
import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";

interface PageProps {
  params: {
    chatId: string;
  };
}

export async function getChatMessages(chatId: string) {
  try {
    const result: string[] = (await fetchRedis(
      "zrange",
      `chat:${chatId}:messages`,
      0,
      -1
    )) as string[];
    const dbMessages = result.map((message) => JSON.parse(message) as Message);
    const reversedDbMessages = dbMessages.reverse();
    const messages = messageListValidator.parse(reversedDbMessages);

    return messages;
  } catch (error) {
    return [
      {
        id: "0",
        senderId: "0",
        text: "0",
        timestamp: 0,
      },
    ];
  }
}

const Page = async ({ params }: PageProps) => {
  const { chatId } = params;
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const { user } = session;

  const [userId1, userId2] = chatId.split("--");

  if (userId1 !== user.id && userId2 !== user.id) return null;

  const chatPartnerId = userId1 === user.id ? userId2 : userId1;

  const chatPartner = JSON.parse(
    (await fetchRedis("get", `unstorage:user:${chatPartnerId}`)) as string
  ) as User;

  const initialMessages = await getChatMessages(chatId);

  return (
    <div className="flex flex-col flex-1 justify-between h-full max-h-[calc(100dvh-6rem)]">
      <div className="flex sm:items-center justify-between py-3 px-4 border-b-2 border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="relative -z-10 h-8 sm:h-12 w-8 sm:w-12">
              {chatPartner.image ? (
                <Image
                  src={chatPartner.image}
                  layout="fill"
                  referrerPolicy="no-referrer"
                  alt={`${chatPartner.name} picture`}
                  className="rounded-full -z-10 object-cover"
                />
              ) : (
                <User2Icon className="h-8 sm:h-12 w-8 sm:w-12" />
              )}
            </div>
            {/* <div className="absolute bottom-0 -z-10 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" /> */}
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
              {chatPartner.name}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {chatPartner.email}
            </p>
          </div>
        </div>
        <Link href={`/watch/${chatId}`}>
          <MonitorPlay className="h-8 w-8 text-gray-400 hover:text-indigo-600 cursor-pointer" />
        </Link>
      </div>
      <Messages
        chatId={chatId}
        chatPartner={chatPartner}
        user={user}
        initialMessages={initialMessages}
      />
      <ChatInput chatPartner={chatPartner} chatId={chatId} user={user} />
    </div>
  );
};

export default Page;
