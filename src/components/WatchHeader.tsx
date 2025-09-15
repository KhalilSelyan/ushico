import { getSpecificUserById } from "@/helpers/getfriendsbyid";
import { Users } from "lucide-react";

interface HeaderProps {
  userId: string;
  roomName?: string;
  participantCount?: number;
}

// components/Header.tsx
const Header = async ({ userId, roomName, participantCount }: HeaderProps) => {
  const user1 = await getSpecificUserById(userId);

  return (
    <div className="flex w-full items-center justify-center space-x-4">
      <div className="text-center">
        {roomName && (
          <h1 className="text-2xl font-bold mb-1">{roomName}</h1>
        )}
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Host: {user1?.name ?? "Loading..."}</span>
          {participantCount && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
