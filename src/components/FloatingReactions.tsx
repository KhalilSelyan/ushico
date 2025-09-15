import { useState, useEffect } from 'react';

interface Reaction {
  id: string;
  emoji: string;
  userName: string;
  videoTimestamp: number;
  x: number;
  y: number;
}

interface FloatingReactionsProps {
  reactions: Reaction[];
  currentVideoTime: number;
}

export function FloatingReactions({ reactions, currentVideoTime }: FloatingReactionsProps) {
  const [visibleReactions, setVisibleReactions] = useState<(Reaction & { opacity: number; startTime: number })[]>([]);
  const [processedReactionIds, setProcessedReactionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();

    // Add new reactions that haven't been processed yet
    const newReactions = reactions
      .filter(r => !processedReactionIds.has(r.id))
      .map(r => ({ ...r, opacity: 1, startTime: now }));

    if (newReactions.length > 0) {
      setVisibleReactions(prev => [...prev, ...newReactions]);
      setProcessedReactionIds(prev => {
        const newSet = new Set(prev);
        newReactions.forEach(r => newSet.add(r.id));
        return newSet;
      });
    }

    // Remove old reactions (older than 2 seconds)
    setVisibleReactions(prev =>
      prev.filter(r => now - r.startTime < 2000)
    );
  }, [reactions, processedReactionIds]);

  // Clean up old reactions and processed IDs every 100ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Remove old visible reactions
      setVisibleReactions(prev =>
        prev.filter(r => now - r.startTime < 2000)
      );

      // Clean up processed reaction IDs older than 5 seconds to prevent memory leaks
      setProcessedReactionIds(prev => {
        const newSet = new Set(prev);
        const cutoffTime = now - 5000;

        // Remove IDs that are no longer in the reactions array and are old
        reactions.forEach(r => {
          if (!reactions.find(reaction => reaction.id === r.id)) {
            newSet.delete(r.id);
          }
        });

        return newSet;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [reactions]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visibleReactions.map(reaction => {
        const age = Date.now() - reaction.startTime;
        const opacity = Math.max(0, 1 - (age / 2000)); // Fade out over 2 seconds

        return (
          <div
            key={reaction.id}
            className="absolute text-3xl animate-bounce"
            style={{
              left: `${reaction.x}%`,
              top: `${reaction.y}%`,
              opacity: opacity,
              transition: 'opacity 0.1s ease-out',
              transform: `translateY(${-age / 40}px)` // Float upward as they age
            }}
          >
            {reaction.emoji}
          </div>
        );
      })}
    </div>
  );
}