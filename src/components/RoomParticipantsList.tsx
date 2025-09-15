"use client";

import { User } from "better-auth";
import { Crown, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/ButtonOld";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RoomParticipantsListProps {
  participants: (User & { role: string })[];
  currentUserId: string;
  isHost: boolean;
  roomId: string;
  onHostTransfer?: (newHostId: string) => void;
  onParticipantRemove?: (userId: string) => void;
}

export default function RoomParticipantsList({
  participants,
  currentUserId,
  isHost,
  roomId,
  onHostTransfer,
  onParticipantRemove,
}: RoomParticipantsListProps) {
  const handleTransferHost = async (newHostId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/transfer-host`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newHostId }),
      });

      if (!response.ok) {
        throw new Error("Failed to transfer host");
      }

      onHostTransfer?.(newHostId);
    } catch (error) {
      console.error("Transfer host error:", error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      // This would need to be implemented in the API
      // For now, we'll just call the callback
      onParticipantRemove?.(userId);
    } catch (error) {
      console.error("Remove participant error:", error);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Participants ({participants.length})
      </h3>

      <div className="space-y-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={participant.image || undefined} />
                <AvatarFallback>
                  {participant.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {participant.name}
                  {participant.id === currentUserId && " (You)"}
                </span>

                {participant.role === "host" && (
                  <Crown className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>

            {/* Host controls */}
            {isHost && participant.id !== currentUserId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {participant.role !== "host" && (
                    <DropdownMenuItem
                      onClick={() => handleTransferHost(participant.id)}
                    >
                      Make Host
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="text-destructive"
                  >
                    Remove from Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
