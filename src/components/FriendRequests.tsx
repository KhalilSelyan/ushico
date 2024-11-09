"use client";
import { wsService } from "@/lib/websocket";
import axios from "axios";
import { Check, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FC, useEffect, useState } from "react";
import { Session } from "next-auth";
type IncomingFriendRequest = {
  senderId: string;
  senderEmail: string;
};

interface FriendRequestsProps {
  initialFriendRequests: IncomingFriendRequest[];
  session: Session;
}

const FriendRequests: FC<FriendRequestsProps> = ({
  initialFriendRequests,
  session,
}) => {
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<
    IncomingFriendRequest[]
  >(initialFriendRequests);
  const router = useRouter();

  const acceptFriendRequest = async (senderId: string) => {
    try {
      await axios.post("/api/friends/accept", {
        id: senderId,
      });

      setIncomingFriendRequests((prev) =>
        prev.filter((request) => request.senderId !== senderId)
      );

      // Send WebSocket message to notify the sender
      if (session) {
        wsService.send(`user:${senderId}:friends`, "friend_request_accepted", {
          userId: session.user.id,
          userName: session.user.name,
          userEmail: session.user.email,
          userImage: session.user.image,
        });
      } else {
        console.error("User session not found.");
      }

      router.refresh();
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  const denyFriendRequest = async (senderId: string) => {
    try {
      await axios.post("/api/friends/deny", {
        id: senderId,
      });

      setIncomingFriendRequests((prev) =>
        prev.filter((request) => request.senderId !== senderId)
      );

      // Optionally, send a WebSocket message to notify the sender
      if (session) {
        wsService.send(`user:${senderId}:friends`, "friend_request_denied", {
          userId: session.user.id,
        });
      } else {
        console.error("User session not found.");
      }

      router.refresh();
    } catch (error) {
      console.error("Error denying friend request:", error);
    }
  };

  useEffect(() => {
    const incomingFriendRequestsChannel = `user:${session?.user.id}:incoming_friend_requests`;

    console.log("Subscribing to channel:", incomingFriendRequestsChannel);

    const unsubscribeFriendRequests = wsService.subscribe(
      incomingFriendRequestsChannel,
      (message: any) => {
        console.log("Received WebSocket message:", message);
        if (message.event === "incoming_friend_request") {
          const data = message.data as IncomingFriendRequest;
          setIncomingFriendRequests((prev) => [...prev, data]);
        }
      }
    );

    return () => {
      console.log("Unsubscribing from channel:", incomingFriendRequestsChannel);
      unsubscribeFriendRequests();
    };
  }, [session]);

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
