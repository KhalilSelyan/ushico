"use client";

import { Room } from "@/db/schema";
import { Plus, Users, Play, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

interface UserRoomsSectionProps {
  rooms: Room[];
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}

export default function UserRoomsSection({
  rooms,
  onCreateRoom,
  onJoinRoom,
}: UserRoomsSectionProps) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  const handleJoinByCode = async () => {
    if (!roomCode.trim()) return;

    setIsJoining(true);
    try {
      // First, find the room by code
      const findResponse = await fetch(`/api/rooms/find-by-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: roomCode.trim().toUpperCase() }),
      });

      if (!findResponse.ok) {
        alert("Room not found. Please check the code and try again.");
        return;
      }

      const { roomId } = await findResponse.json();

      // Now join the room using the room code method
      const joinResponse = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "code",
          roomCode: roomCode.trim().toUpperCase(),
        }),
      });

      if (joinResponse.ok) {
        // Successfully joined, navigate to room
        router.push(`/watch/room/${roomId}`);
      } else {
        alert("Failed to join room. Please try again.");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsJoining(false);
      setRoomCode("");
      setShowJoinInput(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Watch Parties
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowJoinInput(!showJoinInput)}
              size="sm"
              variant="outline"
            >
              <Hash className="h-4 w-4 mr-2" />
              Join Room
            </Button>
            <Button onClick={onCreateRoom} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Party
            </Button>
          </div>
        </div>

        {showJoinInput && (
          <div className="mt-4 flex items-center gap-2">
            <Input
              placeholder="Enter room code (e.g., ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === "Enter" && handleJoinByCode()}
              className="max-w-xs"
              disabled={isJoining}
            />
            <Button
              onClick={handleJoinByCode}
              disabled={!roomCode.trim() || isJoining}
              size="sm"
            >
              {isJoining ? "Joining..." : "Join"}
            </Button>
            <Button
              onClick={() => {
                setShowJoinInput(false);
                setRoomCode("");
              }}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              No Active Watch Parties
            </h3>
            <p className="text-muted-foreground mb-4">
              Create a watch party to start watching videos with friends
            </p>
            <Button onClick={onCreateRoom}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Party
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{room.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(room.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-1" />
                    Active
                  </div>
                  <Button size="sm" onClick={() => onJoinRoom(room.id)}>
                    Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
