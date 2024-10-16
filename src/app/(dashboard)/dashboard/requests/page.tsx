import FriendRequests from "@/components/FriendRequests";
import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

interface PageProps {}

const Page = async ({}: PageProps) => {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const incomingSenderIds = (await fetchRedis(
    "smembers",
    `unstorage:user:${session.user.id}:incoming_friend_requests`
  )) as string[];

  const incomingRequests = await Promise.allSettled(
    incomingSenderIds.map(async (senderId) => {
      const user = await fetchRedis("get", `unstorage:user:${senderId}`);
      const parsedUser = JSON.parse(user);
      return {
        senderId,
        senderEmail: parsedUser.email,
      };
    })
  );

  const failedRequests = incomingRequests.filter(
    (request) => request.status === "rejected"
  );
  const successfulRequests = incomingRequests
    .filter(
      (
        request
      ): request is PromiseFulfilledResult<{
        senderId: string;
        senderEmail: string;
      }> => request.status === "fulfilled"
    )
    .map((request) => request.value);

  return (
    <main className="pt-8">
      <h1 className="font-bold text-5xl mb-8">Add a friend</h1>
      <div className="flex flex-col gap-4">
        <FriendRequests
          sessionId={session.user.id}
          initialFriendRequests={successfulRequests}
        />
      </div>
    </main>
  );
};

export default Page;
