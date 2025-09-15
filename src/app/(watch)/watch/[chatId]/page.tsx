import { auth } from "@/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LegacyWatchClient from "@/components/LegacyWatchClient";

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

  // Check if chatId is old format (user1--user2)
  if (chatId.includes("--")) {
    const [userId1, userId2] = chatId.split("--");

    // Validate user access
    if (userId1 !== session.user.id && userId2 !== session.user.id) {
      redirect("/dashboard");
    }

    // Show migration modal
    return <LegacyWatchClient chatId={chatId} user={session.user} />;
  }

  // If not old format, redirect to dashboard
  redirect("/dashboard");
};

export default Page;
