# Next.js Integration Guide - UX Features

## Overview

This guide provides ready-to-use code for integrating the new WebSocket UX features into your Next.js watch party app.

## 🎯 **1. Typing Indicators**

### WebSocket Events

```typescript
// Add to your WebSocket service types
export type WebSocketEvent =
  // ... existing events
  | "user_typing"
  | "user_stopped_typing";

// Add to your WebSocket service
export function sendTypingIndicator(roomId: string, userId: string, userName: string) {
  sendMessage({
    channel: `room-${roomId}`,
    event: 'user_typing',
    data: {
      roomId,
      userId,
      userName
    }
  });
}

export function sendStoppedTyping(roomId: string, userId: string, userName: string) {
  sendMessage({
    channel: `room-${roomId}`,
    event: 'user_stopped_typing',
    data: {
      roomId,
      userId,
      userName
    }
  });
}
```

### React Hook for Typing

```typescript
// hooks/useTypingIndicator.ts
import { useEffect, useRef, useState } from 'react';

interface TypingUser {
  userId: string;
  userName: string;
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

  return {
    typingUsers,
    handleUserTyping,
    handleUserStoppedTyping
  };
}
```

### Chat Input Component

```typescript
// components/ChatInput.tsx
import { useState, useRef } from 'react';

interface ChatInputProps {
  roomId: string;
  onSendMessage: (text: string) => void;
  currentUser: { id: string; name: string };
}

export function ChatInput({ roomId, onSendMessage, currentUser }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(roomId, currentUser.id, currentUser.name);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send stopped typing after 1 second of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendStoppedTyping(roomId, currentUser.id, currentUser.name);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    onSendMessage(message);
    setMessage('');

    // Clear typing state
    if (isTyping) {
      setIsTyping(false);
      sendStoppedTyping(roomId, currentUser.id, currentUser.name);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={handleInputChange}
        placeholder="Type a message..."
        className="flex-1 px-3 py-2 border rounded-md"
      />
      <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md">
        Send
      </button>
    </form>
  );
}
```

### Typing Indicator Display

```typescript
// components/TypingIndicator.tsx
interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map(u => u.userName);
  const text = names.length === 1
    ? `${names[0]} is typing...`
    : names.length === 2
    ? `${names[0]} and ${names[1]} are typing...`
    : `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;

  return (
    <div className="text-sm text-gray-500 italic px-3 py-1">
      {text}
      <span className="ml-1 animate-pulse">●●●</span>
    </div>
  );
}
```

## 😂 **2. Video Emoji Reactions**

### WebSocket Events

```typescript
// Add to WebSocket service
export function sendVideoReaction(
  roomId: string,
  emoji: string,
  videoTimestamp: number,
  user: { id: string; name: string }
) {
  sendMessage({
    channel: `room-${roomId}`,
    event: 'video_reaction',
    data: {
      roomId,
      userId: user.id,
      userName: user.name,
      emoji,
      videoTimestamp,
      timestamp: new Date().toISOString(),
      reactionId: `${Date.now()}-${user.id}`
    }
  });
}
```

### Reaction Button Component

```typescript
// components/ReactionButtons.tsx
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
    <div className="flex gap-1 p-2 bg-gray-100 rounded-lg">
      {REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className="text-2xl hover:scale-110 transition-transform active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
```

### Floating Reactions Display

```typescript
// components/FloatingReactions.tsx
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
  const [visibleReactions, setVisibleReactions] = useState<(Reaction & { opacity: number })[]>([]);

  useEffect(() => {
    // Show reactions when video time matches their timestamp (±0.5 seconds)
    const newVisible = reactions
      .filter(r => Math.abs(r.videoTimestamp - currentVideoTime) < 0.5)
      .map(r => ({ ...r, opacity: 1 }));

    setVisibleReactions(prev => {
      // Add new reactions
      const updated = [...prev];
      newVisible.forEach(newR => {
        if (!updated.find(existing => existing.id === newR.id)) {
          updated.push(newR);
        }
      });
      return updated;
    });

    // Fade out reactions after 3 seconds
    setTimeout(() => {
      setVisibleReactions(prev =>
        prev.map(r => newVisible.find(n => n.id === r.id)
          ? { ...r, opacity: Math.max(0, r.opacity - 0.1) }
          : r
        ).filter(r => r.opacity > 0)
      );
    }, 3000);
  }, [reactions, currentVideoTime]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visibleReactions.map(reaction => (
        <div
          key={reaction.id}
          className="absolute text-3xl animate-bounce"
          style={{
            left: `${reaction.x}%`,
            top: `${reaction.y}%`,
            opacity: reaction.opacity,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
}
```

### React Hook for Reactions

```typescript
// hooks/useVideoReactions.ts
import { useState, useEffect } from 'react';

export function useVideoReactions(roomId: string) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const handleVideoReaction = (data: any) => {
    const newReaction: Reaction = {
      id: data.reactionId,
      emoji: data.emoji,
      userName: data.userName,
      videoTimestamp: data.videoTimestamp,
      x: Math.random() * 80 + 10, // Random position 10-90%
      y: Math.random() * 80 + 10
    };

    setReactions(prev => [...prev, newReaction]);

    // Remove reaction after 10 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 10000);
  };

  return {
    reactions,
    handleVideoReaction
  };
}
```

## 📢 **3. Activity Announcements**

### WebSocket Events

```typescript
// Add to WebSocket service
export function sendRoomAnnouncement(
  roomId: string,
  type: string,
  userName: string,
  message: string
) {
  sendMessage({
    channel: `room-${roomId}`,
    event: 'room_announcement',
    data: {
      roomId,
      type,
      userName,
      message,
      timestamp: new Date().toISOString(),
      announcementId: `${Date.now()}-${type}`
    }
  });
}
```

### Automatic Announcements

```typescript
// utils/announcements.ts
export function createAnnouncements(roomId: string) {
  return {
    userJoined: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'user_joined',
        userName,
        `${userName} joined the watch party 🎉`
      );
    },

    userLeft: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'user_left',
        userName,
        `${userName} left the watch party`
      );
    },

    videoChanged: (userName: string, videoTitle: string) => {
      sendRoomAnnouncement(
        roomId,
        'video_changed',
        userName,
        `${userName} changed the video to "${videoTitle}"`
      );
    },

    hostPaused: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_paused',
        userName,
        `${userName} paused the video ⏸️`
      );
    },

    hostResumed: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_resumed',
        userName,
        `${userName} resumed the video ▶️`
      );
    },

    hostTransferred: (oldHost: string, newHost: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_transferred',
        oldHost,
        `${oldHost} transferred host to ${newHost} 👑`
      );
    }
  };
}
```

### Announcement Display Component

```typescript
// components/Announcements.tsx
interface AnnouncementProps {
  announcements: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export function Announcements({ announcements }: AnnouncementProps) {
  return (
    <div className="space-y-2">
      {announcements.map(announcement => (
        <div
          key={announcement.id}
          className="text-center text-sm text-gray-600 bg-gray-100 rounded-lg py-1 px-3"
        >
          {announcement.message}
        </div>
      ))}
    </div>
  );
}
```

## 🔌 **4. Integration in Your Components**

### Messages Component Integration

```typescript
// In your Messages component
const { typingUsers, handleUserTyping, handleUserStoppedTyping } = useTypingIndicator(roomId, currentUserId);
const { reactions, handleVideoReaction } = useVideoReactions(roomId);
const [announcements, setAnnouncements] = useState([]);

// In your WebSocket message handler
useEffect(() => {
  if (lastMessage?.event === 'user_typing') {
    handleUserTyping(JSON.parse(lastMessage.data));
  } else if (lastMessage?.event === 'user_stopped_typing') {
    handleUserStoppedTyping(JSON.parse(lastMessage.data));
  } else if (lastMessage?.event === 'video_reaction') {
    handleVideoReaction(JSON.parse(lastMessage.data));
  } else if (lastMessage?.event === 'room_announcement') {
    const announcement = JSON.parse(lastMessage.data);
    setAnnouncements(prev => [...prev, announcement]);
  }
}, [lastMessage]);

// In your render
return (
  <div className="chat-container">
    <Announcements announcements={announcements} />
    {/* Your existing messages */}
    <TypingIndicator typingUsers={typingUsers} />
    <ChatInput roomId={roomId} onSendMessage={handleSendMessage} currentUser={currentUser} />
  </div>
);
```

### VideoPlayer Component Integration

```typescript
// In your VideoPlayer component
const { reactions, handleVideoReaction } = useVideoReactions(roomId);
const announcements = createAnnouncements(roomId);

// Add to your video event handlers
const handlePause = () => {
  if (userRole === 'host') {
    announcements.hostPaused(currentUser.name);
  }
};

const handlePlay = () => {
  if (userRole === 'host') {
    announcements.hostResumed(currentUser.name);
  }
};

// In your render
return (
  <div className="relative">
    <video ref={videoRef} onPause={handlePause} onPlay={handlePlay} />
    <FloatingReactions reactions={reactions} currentVideoTime={currentTime} />
    <ReactionButtons roomId={roomId} videoRef={videoRef} currentUser={currentUser} />
  </div>
);
```

## 🎨 **Styling Tips**

### CSS for Smooth Animations

```css
/* Typing indicator animation */
@keyframes typing {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 1; }
}

.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

/* Reaction animations */
@keyframes float-up {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-50px) scale(1.2); opacity: 0; }
}

.reaction-float {
  animation: float-up 3s ease-out forwards;
}

/* Announcement fade in */
@keyframes slide-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.announcement-enter {
  animation: slide-in 0.3s ease-out;
}
```

## 🚀 **Getting Started**

1. **Add the new event types** to your WebSocket service
2. **Install the hooks** in your components directory
3. **Update your Messages component** with typing indicators
4. **Add reaction buttons** to your VideoPlayer
5. **Integrate announcements** in appropriate event handlers

Your users will love these engaging, real-time features! 🎉
