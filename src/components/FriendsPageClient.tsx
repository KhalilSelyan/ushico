/* eslint-disable @next/next/no-img-element */
"use client";

import { User } from "better-auth";
import { MessageSquare, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { hrefChatConstructor } from "@/lib/utils";
import RemoveFriendButton from "@/components/RemoveFriendButton";
import { getWebSocketService } from "@/lib/websocket";
import axios from "axios";
import { useRouter } from "next/navigation";

interface FriendsPageClientProps {
  initialFriends: User[];
  initialFriendRequests: Array<{
    senderId: string;
    senderEmail: string;
    senderName: string;
    senderImage: string;
  }>;
  userId: string;
  user: User;
}

const FriendsPageClient = ({
  initialFriends,
  initialFriendRequests,
  userId,
  user,
}: FriendsPageClientProps) => {
  const [friends, setFriends] = useState<User[]>(initialFriends);
  const [friendRequests, setFriendRequests] = useState(initialFriendRequests);
  const router = useRouter();

  useEffect(() => {
    const friendsChannel = `user:${userId}:friends`;
    const incomingFriendRequestsChannel = `user:${userId}:incoming_friend_requests`;
    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeRequests: (() => void) | undefined;

    const setupSubscriptions = async () => {
      const wsService = getWebSocketService(userId);

      // Subscribe to friend removal events
      unsubscribeFriends = await wsService.subscribe(
        friendsChannel,
        "friend_removed",
        (data: { userId: string }) => {
          setFriends((prev) =>
            prev.filter((friend) => friend.id !== data.userId)
          );
        }
      );

      // Subscribe to new friend request events
      unsubscribeRequests = await wsService.subscribe(
        incomingFriendRequestsChannel,
        "incoming_friend_request",
        (data: {
          senderId: string;
          senderEmail: string;
          senderName: string;
          senderImage: string;
        }) => {
          setFriendRequests((prev) => [...prev, data]);
        }
      );
    };

    void setupSubscriptions();

    return () => {
      unsubscribeFriends?.();
      unsubscribeRequests?.();
    };
  }, [userId]);

  const acceptFriendRequest = async (senderId: string) => {
    try {
      await axios.post("/api/friends/accept", { id: senderId });

      setFriendRequests((prev) =>
        prev.filter((request) => request.senderId !== senderId)
      );

      // Send WebSocket message to notify the sender
      const wsService = getWebSocketService(user.id);
      await wsService.send(
        `user:${senderId}:friends`,
        "friend_request_accepted",
        {
          userId,
          timestamp: new Date().toISOString(),
        }
      );

      // Force a router refresh to update the friends list
      router.refresh();
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  const denyFriendRequest = async (senderId: string) => {
    try {
      await axios.post("/api/friends/deny", { id: senderId });

      setFriendRequests((prev) =>
        prev.filter((request) => request.senderId !== senderId)
      );

      // Send WebSocket message to notify the sender
      const wsService = getWebSocketService(user.id);
      await wsService.send(
        `user:${senderId}:friends`,
        "friend_request_denied",
        {
          userId,
          timestamp: new Date().toISOString(),
        }
      );

      router.refresh();
    } catch (error) {
      console.error("Error denying friend request:", error);
    }
  };

  return (
    <div className="container py-12">
      <h1 className="font-bold text-5xl mb-8">Friends</h1>

      {/* Friend Requests Section */}
      {friendRequests.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Friend Requests</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {friendRequests.map((request) => (
              <div
                key={request.senderId}
                className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <img
                  src={request.senderImage || ""}
                  alt={request.senderName}
                  className="w-20 h-20 rounded-full mb-4"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {request.senderName}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {request.senderEmail}
                </p>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => acceptFriendRequest(request.senderId)}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => denyFriendRequest(request.senderId)}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Friends</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You don&apos;t have any friends yet. Add some friends to get
            started!
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <img
                  src={friend.image || ""}
                  alt={friend.name}
                  className="w-20 h-20 rounded-full mb-4"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {friend.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{friend.email}</p>
                <div className="flex gap-2 mt-auto">
                  <Link
                    href={`/dashboard/chat/${hrefChatConstructor(
                      userId,
                      friend.id
                    )}`}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </Link>
                  <RemoveFriendButton friend={friend} userId={userId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPageClient;
