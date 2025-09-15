import { useEffect, useRef, useState } from 'react';

interface TypingUser {
  userId: string;
  userName: string;
  userImage?: string;
}

export function useTypingIndicator(roomId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handleUserTyping = (data: TypingUser) => {
    if (data.userId === currentUserId) return; // Don't show own typing

    setTypingUsers(prev => {
      const exists = prev.find(u => u.userId === data.userId);
      if (!exists) {
        return [...prev, data];
      }
      return prev;
    });

    // Clear existing timeout
    if (typingTimeoutRef.current[data.userId]) {
      clearTimeout(typingTimeoutRef.current[data.userId]);
    }

    // Auto-remove after 3 seconds
    typingTimeoutRef.current[data.userId] = setTimeout(() => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      delete typingTimeoutRef.current[data.userId];
    }, 3000);
  };

  const handleUserStoppedTyping = (data: TypingUser) => {
    setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    if (typingTimeoutRef.current[data.userId]) {
      clearTimeout(typingTimeoutRef.current[data.userId]);
      delete typingTimeoutRef.current[data.userId];
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  return {
    typingUsers,
    handleUserTyping,
    handleUserStoppedTyping
  };
}