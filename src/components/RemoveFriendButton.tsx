"use client";

import { User } from "better-auth";
import { UserMinus } from "lucide-react";
import { FC } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { wsService } from "@/lib/websocket";

interface RemoveFriendButtonProps {
  friend: User;
  userId: string;
}

const RemoveFriendButton: FC<RemoveFriendButtonProps> = ({
  friend,
  userId,
}) => {
  const removeFriend = async () => {
    try {
      await axios.post("/api/friends/remove", {
        friendId: friend.id,
      });

      // Send WebSocket notification to the removed friend
      await wsService.send(`user:${friend.id}:friends`, "friend_removed", {
        userId,
        timestamp: new Date().toISOString(),
      });

      toast.success("Friend removed successfully");
    } catch (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend. Please try again.");
    }
  };

  return (
    <button
      onClick={removeFriend}
      className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
    >
      <UserMinus className="w-4 h-4" />
      Remove
    </button>
  );
};

export default RemoveFriendButton;
