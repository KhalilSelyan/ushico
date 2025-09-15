"use client";

import { useState } from "react";
import { User } from "better-auth";
import { Room } from "@/db/schema";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface RoomInviteModalProps {
  room: Room;
  friends: User[];
  isOpen: boolean;
  onClose: () => void;
}

export default function RoomInviteModal({
  room,
  friends,
  isOpen,
  onClose,
}: RoomInviteModalProps) {
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const roomLink = typeof window !== 'undefined'
    ? `${window.location.origin}/watch/room/${room.id}`
    : `/watch/room/${room.id}`;

  const handleCopyLink = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(roomLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleInviteFriends = async () => {
    if (selectedFriends.length === 0) return;

    setIsInviting(true);

    try {
      const response = await fetch(`/api/rooms/${room.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds: selectedFriends,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invitations");
      }

      setInviteSuccess(true);
      setSelectedFriends([]);
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch (error) {
      console.error("Invite friends error:", error);
    } finally {
      setIsInviting(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {room.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Room Link */}
          <div className="space-y-2">
            <Label>Share Room Link</Label>
            <div className="flex items-center space-x-2">
              <Input value={roomLink} readOnly className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Room Code */}
          {room.roomCode && (
            <div className="space-y-2">
              <Label>Room Code</Label>
              <div className="p-3 bg-muted rounded-lg text-center">
                <span className="text-lg font-mono font-bold">
                  {room.roomCode}
                </span>
              </div>
            </div>
          )}

          {/* Friend Invitations */}
          {friends.length > 0 && (
            <div className="space-y-3">
              <Label>Invite Friends</Label>

              <div className="max-h-40 overflow-y-auto space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={friend.id}
                      checked={selectedFriends.includes(friend.id)}
                      onCheckedChange={() => toggleFriendSelection(friend.id)}
                      disabled={isInviting}
                    />
                    <Label
                      htmlFor={friend.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {friend.name}
                    </Label>
                  </div>
                ))}
              </div>

              {selectedFriends.length > 0 && (
                <Button
                  onClick={handleInviteFriends}
                  disabled={isInviting}
                  className="w-full"
                >
                  {isInviting
                    ? "Sending Invites..."
                    : `Invite ${selectedFriends.length} Friend${
                        selectedFriends.length > 1 ? "s" : ""
                      }`}
                </Button>
              )}

              {inviteSuccess && (
                <div className="text-sm text-green-600 text-center">
                  Invitations sent successfully!
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
