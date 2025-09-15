"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle } from "lucide-react";

interface ChatIdMigrationModalProps {
  chatId: string;
  onMigrate: (roomId: string) => void;
  onCancel: () => void;
}

export default function ChatIdMigrationModal({
  chatId,
  onMigrate,
  onCancel,
}: ChatIdMigrationModalProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);

    try {
      const [userId1, userId2] = chatId.split("--");

      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Watch Party",
          inviteUserIds: [userId2], // Invite the other person
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      const data = await response.json();
      onMigrate(data.room.id);
    } catch (error) {
      console.error("Migration error:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinueDirectChat = () => {
    router.push(`/dashboard/chat/${chatId}`);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watch Party System Updated</DialogTitle>
          <DialogDescription>
            We&apos;ve upgraded our watch party system! You can now create rooms
            with multiple people and better controls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Users className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">
                  {isCreating ? "Creating Room..." : "Create Watch Party Room"}
                </div>
                <div className="text-xs opacity-75">
                  Watch videos together with enhanced features
                </div>
              </div>
            </Button>

            <Button
              onClick={handleContinueDirectChat}
              variant="outline"
              className="flex items-center gap-2 h-auto p-4"
            >
              <MessageCircle className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Continue Direct Chat</div>
                <div className="text-xs opacity-75">
                  Go to regular messaging without watch party
                </div>
              </div>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Note: Old watch party URLs now redirect to the new room system
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
