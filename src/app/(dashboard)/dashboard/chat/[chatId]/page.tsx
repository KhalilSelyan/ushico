import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import Messages from "@/components/Messages";
import { getChatMessages } from "@/db/queries";
import { getSpecificUserById } from "@/helpers/getfriendsbyid";

interface PageProps {
  params: {
    chatId: string;
  };
}

const Page = async ({ params }: PageProps) => {
  const { chatId } = params;
  const session = await auth.api.getSession({
    headers: headers(),
  });
  if (!session) return null;
  const { user } = session;

  const [userId1, userId2] = chatId.split("--");

  if (userId1 !== user.id && userId2 !== user.id) return null;

  const chatPartnerId = userId1 === user.id ? userId2 : userId1;
  const chatPartner = await getSpecificUserById(chatPartnerId);
  if (!chatPartner) return null;

  const initialMessages = await getChatMessages(chatId);
  return (
    <div className="flex flex-col flex-1 justify-between h-full max-h-[calc(100dvh-1rem)]">
      <ChatHeader chatPartner={chatPartner} chatId={chatId} />
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
