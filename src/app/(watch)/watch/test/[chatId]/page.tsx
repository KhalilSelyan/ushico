import { auth } from "@/auth/auth";
import WebRTCPlayer from "@/components/VideoPlayerRTC";
import Header from "@/components/WatchHeader";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

  if (!session) {
    redirect("/auth/signin");
  }

  const [userId1, userId2] = chatId.split("--");

  if (userId1 !== session.user.id && userId2 !== session.user.id) {
    redirect("/dashboard");
  }

  return (
    <div className="relative no-scrollbar flex h-full w-full flex-col items-center">
      <Header userId={userId1} />
      <div className="w-full flex-1 px-2">
        <WebRTCPlayer userId1={userId1} chatId={chatId} user={session.user} />
      </div>
    </div>
  );
};

export default Page;
