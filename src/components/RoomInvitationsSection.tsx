"use client";

import { RoomInvitation, Room } from "@/db/schema";
import { User } from "better-auth";
import { Mail, Check, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RoomInvitationsSectionProps {
  invitations: (RoomInvitation & {
    room: Room & { host: User };
    inviter: User;
  })[];
  onRespond: (invitationId: string, status: "accepted" | "declined") => void;
}

export default function RoomInvitationsSection({
  invitations,
  onRespond,
}: RoomInvitationsSectionProps) {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Room Invitations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={invitation.inviter.image || undefined} />
                  <AvatarFallback>
                    {invitation.inviter.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h4 className="font-medium">{invitation.room.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invitation.inviter.name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Users className="h-3 w-3" />
                    Host: {invitation.room.host.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRespond(invitation.id, "declined")}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => onRespond(invitation.id, "accepted")}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
