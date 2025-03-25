"use client";

import { wsService } from "@/lib/websocket";
import { FC, useEffect, useState } from "react";

interface FriendRequestBadgeProps {
  initialUnseenRequestCount: number;
  sessionId: string;
}

const FriendRequestBadge: FC<FriendRequestBadgeProps> = ({
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

    let unsubscribeFunctions: (() => void)[] = [];

    const setupSubscriptions = async () => {
      // Subscribe to new friend requests
      const unsubscribeFriendRequests = await wsService.subscribe(
        incomingFriendRequestsChannel,
        "incoming_friend_request",
        (message: any) => {
          setUnseenRequestCount((prev) => prev + 1);
        }
      );

      // Subscribe to friend request denials
      const unsubscribeFriendsDenied = await wsService.subscribe(
        friendRequestDeniedChannel,
        "friend_request_denied",
        () => {
          setUnseenRequestCount((prev) => Math.max(0, prev - 1));
        }
      );

      // Subscribe to friend request acceptances
      const unsubscribeFriendsAccepted = await wsService.subscribe(
        friendRequestAcceptedChannel,
        "friend_request_accepted",
        () => {
          // Directly set to 0 when a request is accepted
          setUnseenRequestCount((prev) => Math.max(0, prev - 1));
        }
      );

      unsubscribeFunctions = [
        unsubscribeFriendRequests,
        unsubscribeFriendsDenied,
        unsubscribeFriendsAccepted,
      ];
    };

    void setupSubscriptions();

    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }, [sessionId]);

  // Also update the initial count when it changes from props
  useEffect(() => {
    setUnseenRequestCount(initialUnseenRequestCount);
  }, [initialUnseenRequestCount]);

  if (unseenRequestCount < 1) return null;

  return (
    <span className="flex h-5 w-5 text-xs items-center justify-center rounded-full bg-indigo-600 text-white">
      {unseenRequestCount}
    </span>
  );
};

export default FriendRequestBadge;
