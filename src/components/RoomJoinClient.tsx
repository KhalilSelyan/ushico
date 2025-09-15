"use client";

import { User } from "better-auth";
import { Room } from "@/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Video, Clock, Key } from "lucide-react";

interface RoomJoinClientProps {
  room: Room & {
    host: User;
    participants: any[];
  };
  user: User;
}

export default function RoomJoinClient({ room, user }: RoomJoinClientProps) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinMethod, setJoinMethod] = useState<"request" | "code">("request");

  const handleRequestJoin = async () => {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "request" }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.requiresApproval) {
          alert("Join request sent! The host will review your request.");
          router.push("/dashboard");
        } else {
          router.push(`/watch/room/${room.id}`);
        }
      } else {
        throw new Error("Failed to join room");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCodeJoin = async () => {
    if (!roomCode.trim()) {
      alert("Please enter a room code");
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch(`/api/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "code",
          roomCode: roomCode.trim()
        }),
      });

      if (response.ok) {
        router.push(`/watch/room/${room.id}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Invalid room code");
      }
    } catch (error) {
      console.error("Error joining with code:", error);
      alert("Invalid room code or failed to join.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Room Info Card */}
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Video className="h-6 w-6 text-indigo-600" />
          </div>
          <CardTitle className="text-xl">{room.name}</CardTitle>
          <CardDescription>
            Join this watch party to watch together with friends
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>Host: {room.host.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{room.participants.length} participants</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Created {new Date(room.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Join Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How would you like to join?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Request to Join */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="request"
                name="joinMethod"
                value="request"
                checked={joinMethod === "request"}
                onChange={(e) => setJoinMethod(e.target.value as "request")}
                className="text-indigo-600"
              />
              <Label htmlFor="request" className="flex-1">
                Request to join (host will be notified)
              </Label>
            </div>
            {joinMethod === "request" && (
              <Button
                onClick={handleRequestJoin}
                disabled={isJoining}
                className="w-full"
              >
                {isJoining ? "Joining..." : "Request to Join"}
              </Button>
            )}
          </div>

          {/* Room Code */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="code"
                name="joinMethod"
                value="code"
                checked={joinMethod === "code"}
                onChange={(e) => setJoinMethod(e.target.value as "code")}
                className="text-indigo-600"
              />
              <Label htmlFor="code" className="flex-1">
                I have a room code
              </Label>
            </div>
            {joinMethod === "code" && (
              <div className="space-y-3">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="pl-10"
                    maxLength={20}
                  />
                </div>
                <Button
                  onClick={handleCodeJoin}
                  disabled={isJoining || !roomCode.trim()}
                  className="w-full"
                >
                  {isJoining ? "Joining..." : "Join with Code"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => router.push("/dashboard")}
        className="w-full"
      >
        Back to Dashboard
      </Button>
    </div>
  );
}