/* eslint-disable @next/next/no-img-element */
"use client";

import { User } from "better-auth";
import { UserMinus, UserPlus, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RemoveFriendButton from "@/components/RemoveFriendButton";
import { getWebSocketService } from "@/lib/websocket";
import axios from "axios";
import { Button } from "@/components/ui/button";
import CreateRoomModal from "@/components/CreateRoomModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addFriendValidator, type AddFriend } from "@/lib/validators/add-friend";
import { z } from "zod";

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
  const [isAddFriendDialogOpen, setIsAddFriendDialogOpen] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [selectedFriendForRoom, setSelectedFriendForRoom] = useState<User | null>(null);
  const [checkingRoomFor, setCheckingRoomFor] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    formState: { errors },
    setError,
    handleSubmit,
    reset,
  } = useForm<AddFriend>({
    resolver: zodResolver(addFriendValidator),
  });

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

  const handleCreateWatchPartyWithFriend = async (friend: User) => {
    setCheckingRoomFor(friend.id);

    try {
      // Check if there's already a 1-on-1 room with this friend
      const response = await fetch("/api/rooms/check-existing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          friendId: friend.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.hasExistingRoom) {
          // Redirect to existing room instead of creating new one
          router.push(`/watch/room/${data.existingRoom.id}`);
          return;
        }
      }

      // No existing room found, proceed with modal
      setSelectedFriendForRoom(friend);
      setIsCreateRoomModalOpen(true);
    } catch (error) {
      console.error("Error checking for existing room:", error);
      // If check fails, still allow creating new room
      setSelectedFriendForRoom(friend);
      setIsCreateRoomModalOpen(true);
    } finally {
      setCheckingRoomFor(null);
    }
  };

  const handleRoomCreated = (room: any) => {
    router.push(`/watch/room/${room.id}`);
  };

  const addFriend = async (email: string) => {
    try {
      const validatedEmail = addFriendValidator.parse({ email });

      const response = await axios.post("/api/friends/add", {
        email: validatedEmail.email,
      });

      const { request, receiver } = response.data;

      // Send WebSocket message to notify the receiver
      const wsService = getWebSocketService(user.id);
      const channel = `user:${receiver.id}:incoming_friend_requests`;
      await wsService.send(channel, "incoming_friend_request", {
        senderId: user.id,
        senderEmail: user.email,
        senderName: user.name,
        senderImage: user.image,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      });

      setShowSuccessState(true);
      reset();
      setTimeout(() => {
        setShowSuccessState(false);
        setIsAddFriendDialogOpen(false);
      }, 2000);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError("email", { message: err.message });
        return;
      }
      if (axios.isAxiosError(err)) {
        setError("email", {
          message: err.response?.data?.error || "Something went wrong",
        });
        return;
      }
      setError("email", { message: "Something went wrong" });
    }
  };

  const onAddFriendSubmit = async (data: AddFriend) => {
    await addFriend(data.email);
  };

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-bold text-5xl">Friends</h1>
        <Dialog open={isAddFriendDialogOpen} onOpenChange={setIsAddFriendDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Friend</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onAddFriendSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Friend&apos;s Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="friend@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
                {showSuccessState && (
                  <p className="text-sm text-green-600">
                    Friend request sent successfully!
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddFriendDialogOpen(false);
                    reset();
                    setShowSuccessState(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Send Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <button
                    onClick={() => handleCreateWatchPartyWithFriend(friend)}
                    disabled={checkingRoomFor === friend.id}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Video className="w-4 h-4" />
                    {checkingRoomFor === friend.id ? "Checking..." : "Watch Party"}
                  </button>
                  <RemoveFriendButton friend={friend} userId={userId} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Room Modal for Watch Parties */}
        {selectedFriendForRoom && (
          <CreateRoomModal
            isOpen={isCreateRoomModalOpen}
            onClose={() => {
              setIsCreateRoomModalOpen(false);
              setSelectedFriendForRoom(null);
            }}
            onRoomCreated={handleRoomCreated}
            friends={[selectedFriendForRoom]}
          />
        )}
      </div>
    </div>
  );
};

export default FriendsPageClient;
