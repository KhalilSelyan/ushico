import { useState, useCallback } from 'react';

interface Reaction {
  id: string;
  emoji: string;
  userName: string;
  videoTimestamp: number;
  x: number;
  y: number;
}

export function useVideoReactions(roomId: string) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const handleVideoReaction = useCallback((data: any) => {
    const newReaction: Reaction = {
      id: data.reactionId,
      emoji: data.emoji,
      userName: data.userName,
      videoTimestamp: data.videoTimestamp,
      x: Math.random() * 80 + 10, // Random position 10-90%
      y: Math.random() * 80 + 10
    };

    setReactions(prev => [...prev, newReaction]);

    // Remove reaction after 3 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  }, []);

  return {
    reactions,
    handleVideoReaction
  };
}