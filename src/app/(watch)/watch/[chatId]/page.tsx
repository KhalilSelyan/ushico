import VideoPlayer from "@/components/VideoPlayer";
import Header from "@/components/WatchHeader";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

interface PageProps {
  params: {
    chatId: string;
  };
}

const Page = async ({ params }: PageProps) => {
  const { chatId } = params;
  const session = await getServerSession(authOptions);

  if (!session) return null;

  const [userId1, userId2] = chatId.split("--");

  if (userId1 !== session.user.id && userId2 !== session.user.id) return null;

  return (
    <div className="no-scrollbar flex h-full w-full flex-col items-center">
      <Header userId={userId1} />
      <VideoPlayer userId1={userId1} chatId={chatId} user={session.user} />
    </div>
  );
};

export default Page;
