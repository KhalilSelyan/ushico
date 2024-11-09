"use client";

import { wsService } from "@/lib/websocket";
import { User } from "lucide-react";
import Link from "next/link";
import { FC, useEffect, useState } from "react";

interface FriendsRequestSidebarOptionProps {
  initialUnseenRequestCount: number;
  sessionId: string;
}

const FriendsRequestSidebarOption: FC<FriendsRequestSidebarOptionProps> = ({
  initialUnseenRequestCount,
  sessionId,
}) => {
  const [unseenRequestCount, setUnseenRequestCount] = useState<number>(
    initialUnseenRequestCount
  );

  useEffect(() => {
    const incomingFriendRequestsChannel = `user:${sessionId}:incoming_friend_requests`;
    const friendRequestDeniedChannel = `user:${sessionId}:friend_request_denied`;
    const friendRequestAcceptedChannel = `user:${sessionId}:friend_request_accepted`;
    const friendsChannel = `user:${sessionId}:friends`;

    console.log(
      "Subscribing to channels:",
      incomingFriendRequestsChannel,
      friendsChannel
    );

    const unsubscribeFriendRequests = wsService.subscribe(
      incomingFriendRequestsChannel,
      (message: any) => {
        console.log("Received WebSocket message:", message);
        setUnseenRequestCount((prev) => prev + 1);
      }
    );

    const unsubscribeFriends = wsService.subscribe(
      friendsChannel,
      (message: any) => {
        console.log("Received WebSocket message:", message);
        setUnseenRequestCount((prev) => prev - 1);
      }
    );
    const unsubscribeFriendsDenied = wsService.subscribe(
      friendRequestDeniedChannel,
      (message: any) => {
        console.log("Received WebSocket message:", message);
        setUnseenRequestCount((prev) => prev - 1);
      }
    );
    const unsubscribeFriendsAccepted = wsService.subscribe(
      friendRequestAcceptedChannel,
      (message: any) => {
        console.log("Received WebSocket message:", message);
        setUnseenRequestCount((prev) => prev - 1);
      }
    );

    return () => {
      console.log(
        "Unsubscribing from channels:",
        incomingFriendRequestsChannel,
        friendsChannel
      );
      unsubscribeFriendRequests();
      unsubscribeFriends();
      unsubscribeFriendsDenied();
      unsubscribeFriendsAccepted();
    };
  }, []);

  return (
    <Link
      href="/dashboard/requests"
      className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
    >
      <div className="text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white">
        <User className="h-4 w-4" />
      </div>
      <span className="truncate">Friend Requests</span>
      {unseenRequestCount > 0 ? (
        <span className="flex h-5 w-5 text-xs items-center justify-center rounded-full bg-indigo-600 text-white">
          {unseenRequestCount}
        </span>
      ) : null}
    </Link>
  );
};

export default FriendsRequestSidebarOption;
