"use client";

import { useRouter } from "next/navigation";
import { User } from "better-auth";
import ChatIdMigrationModal from "@/components/ChatIdMigrationModal";

interface LegacyWatchClientProps {
  chatId: string;
  user: User;
}

export default function LegacyWatchClient({
  chatId,
  user,
}: LegacyWatchClientProps) {
  const router = useRouter();

  const handleMigrate = (roomId: string) => {
    router.push(`/watch/room/${roomId}`);
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center">
      <ChatIdMigrationModal
        chatId={chatId}
        onMigrate={handleMigrate}
        onCancel={handleCancel}
      />
    </div>
  );
}