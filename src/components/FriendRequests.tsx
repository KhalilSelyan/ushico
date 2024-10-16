"use client";
import { pusherClient } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import axios from "axios";
import { Check, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FC, useEffect, useState } from "react";

interface FriendRequestsProps {
  initialFriendRequests: IncomingFriendRequest[];
  sessionId: string;
}

const FriendRequests: FC<FriendRequestsProps> = ({
  initialFriendRequests,
  sessionId,
}) => {
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<
    IncomingFriendRequest[]
  >(initialFriendRequests);
  const router = useRouter();
  const acceptFriendRequest = async (senderId: string) => {
    await axios.post("/api/friends/accept", {
      id: senderId,
    });

    setIncomingFriendRequests((prev) =>
      prev.filter((request) => request.senderId !== senderId)
    );

    router.refresh();
  };
  const denyFriendRequest = async (senderId: string) => {
    await axios.post("/api/friends/deny", {
      id: senderId,
    });

    setIncomingFriendRequests((prev) =>
      prev.filter((request) => request.senderId !== senderId)
    );

    router.refresh();
  };

  useEffect(() => {
    pusherClient.subscribe(
      toPusherKey(`unstorage:user:${sessionId}:incoming_friend_requests`)
    );

    const friendRequestHandler = (data: IncomingFriendRequest) => {
      setIncomingFriendRequests((prev) => [...prev, data]);
    };

    pusherClient.bind("incoming_friend_request", friendRequestHandler);

    return () => {
      pusherClient.unsubscribe(
        toPusherKey(`unstorage:user:${sessionId}:incoming_friend_requests`)
      );
      pusherClient.unbind("incoming_friend_request", friendRequestHandler);
    };
  }, [sessionId]);

  return (
    <>
      {incomingFriendRequests.length === 0 ? (
        <p className="text-xl">No friend requests</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {incomingFriendRequests.map((friendRequest) => (
            <li key={friendRequest.senderId}>
              <div className="flex gap-4 items-center">
                <UserPlus className="text-black" />
                <p className="text-lg font-medium">
                  {friendRequest.senderEmail}
                </p>
                <button
                  onClick={() => acceptFriendRequest(friendRequest.senderId)}
                  aria-label="accept friend"
                  className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 grid place-items-center rounded-full transition hover:shadow-md"
                >
                  <Check className="font-semibold text-white w-3/4 h-3/4" />
                </button>

                <button
                  onClick={() => denyFriendRequest(friendRequest.senderId)}
                  aria-label="deny friend"
                  className="w-8 h-8 bg-red-600 hover:bg-red-700 grid place-items-center rounded-full transition hover:shadow-md"
                >
                  <X className="font-semibold text-white w-3/4 h-3/4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default FriendRequests;
