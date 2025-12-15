import { sendVideoReaction } from "@/lib/websocket";

interface ReactionButtonsProps {
  roomId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  currentUser: { id: string; name: string };
}

const REACTIONS = ['😂', '❤️', '😮', '👏', '😢', '🔥', '💯', '👍', '👎', '😍'];

export function ReactionButtons({ roomId, videoRef, currentUser }: ReactionButtonsProps) {
  const handleReaction = (emoji: string) => {
    const videoTimestamp = videoRef.current?.currentTime || 0;
    sendVideoReaction(roomId, emoji, videoTimestamp, currentUser);
  };

  return (
    <div className="flex flex-wrap justify-center gap-1 p-2 bg-gray-50 rounded-lg max-w-full">
      {REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className="text-lg hover:scale-110 transition-transform active:scale-95 p-1 rounded hover:bg-gray-200"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}