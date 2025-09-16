"use client";

import { useState, useEffect } from "react";
import { User } from "better-auth";
import { Room } from "@/db/schema";
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

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
  friends: User[];
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onRoomCreated,
  friends,
}: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate room name and select friends when modal opens
  useEffect(() => {
    if (isOpen && friends.length === 1) {
      // Single friend selected - this is a quick watch party
      setRoomName(`Watch Party with ${friends[0].name}`);
      setSelectedFriends([friends[0].id]);
    } else if (isOpen && friends.length === 0) {
      // No friends pre-selected - regular room creation
      setRoomName("");
      setSelectedFriends([]);
    }
  }, [isOpen, friends]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName.trim(),
          inviteUserIds: selectedFriends,
          isEphemeral,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      const data = await response.json();
      onRoomCreated(data.room);

      // Reset form
      setRoomName("");
      setSelectedFriends([]);
      setIsEphemeral(false);
      onClose();
    } catch (error) {
      console.error("Create room error:", error);
      setError("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
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
          <DialogTitle>Create Watch Party</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              type="text"
              placeholder="Enter room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {friends.length > 0 && (
            <div className="space-y-2">
              <Label>Invite Friends</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={friend.id}
                      checked={selectedFriends.includes(friend.id)}
                      onCheckedChange={() => toggleFriendSelection(friend.id)}
                      disabled={isCreating}
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
              <p className="text-xs text-muted-foreground">
                {selectedFriends.length} friend(s) selected
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ephemeral"
                checked={isEphemeral}
                onCheckedChange={(checked) =>
                  setIsEphemeral(checked === "indeterminate" ? false : checked)
                }
                disabled={isCreating}
              />
              <Label
                htmlFor="ephemeral"
                className="text-sm font-normal cursor-pointer"
              >
                Ephemeral room (auto-delete end of day)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ephemeral rooms are automatically deleted at the end of the day to
              keep your watch history clean
            </p>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !roomName.trim()}>
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
