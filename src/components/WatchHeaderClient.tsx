"use client";

import { Users } from "lucide-react";
import { PresenceBadge } from "@/components/PresenceIndicator";
import { User } from "better-auth";
import { PresenceState } from "@/hooks/useUserPresence";

interface WatchHeaderClientProps {
  hostName: string;
  roomName?: string;
  participantCount?: number;
  participants?: (User & { role: string })[];
  presence?: { [userId: string]: { state: PresenceState; timestamp: string; userName: string } };
}

const WatchHeaderClient = ({
  hostName,
  roomName,
  participantCount,
  participants,
  presence
}: WatchHeaderClientProps) => {
  return (
    <div className="flex w-full items-center justify-between space-x-4 px-4">
      <div className="flex-1 text-center">
        {roomName && (
          <h1 className="text-2xl font-bold mb-1">{roomName}</h1>
        )}
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Host: {hostName}</span>
          {participantCount && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {participants && presence && (
        <div className="flex items-center gap-2">
          {participants.slice(0, 5).map((participant) => {
            const userPresence = presence[participant.id];

            // Consider users offline if no presence data or timestamp is too old (5 minutes)
            let presenceState: PresenceState = 'offline';
            if (userPresence) {
              const lastUpdate = new Date(userPresence.timestamp);
              const now = new Date();
              const timeDiff = now.getTime() - lastUpdate.getTime();
              const fiveMinutesInMs = 5 * 60 * 1000;

              // Only consider them active/away if timestamp is recent
              if (timeDiff < fiveMinutesInMs) {
                presenceState = userPresence.state;
              }
            }

            return (
              <PresenceBadge
                key={participant.id}
                state={presenceState}
                userName={participant.name || 'Unknown'}
                userImage={participant.image || undefined}
                showText={false}
              />
            );
          })}
          {participants.length > 5 && (
            <div className="text-xs text-muted-foreground">
              +{participants.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchHeaderClient;