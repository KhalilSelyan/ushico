import { useState, useEffect, useRef, useCallback } from 'react';
import { sendPresenceUpdate, requestRoomPresence, getWebSocketService } from '@/lib/websocket';

export type PresenceState = 'active' | 'away' | 'offline';

interface PresenceData {
  [userId: string]: {
    state: PresenceState;
    timestamp: string;
    userName: string;
  };
}

export function useUserPresence(roomId: string, userId: string, userName: string, participants?: any[]) {
  const [presence, setPresence] = useState<PresenceData>({});
  const isInitializedRef = useRef(false);
  const hasRequestedInitialPresence = useRef(false);

  // Send presence update to server - let server be source of truth
  const updatePresence = useCallback((state: PresenceState) => {
    sendPresenceUpdate(roomId, userId, userName, state);
  }, [roomId, userId, userName]);

  // Get current user's state from server data - no default, let server decide
  const currentState = presence[userId]?.state;

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      updatePresence('away');
    } else {
      updatePresence('active');
    }
  }, [updatePresence]);

  // Handle beforeunload (user leaving)
  const handleBeforeUnload = useCallback(() => {
    sendPresenceUpdate(roomId, userId, userName, 'offline');
  }, [roomId, userId, userName]);

  // Set up WebSocket listeners for presence updates
  useEffect(() => {
    if (!roomId || !userId) return;

    const wsService = getWebSocketService(userId);
    const roomChannel = `room-${roomId}`;
    let unsubscribes: (() => void)[] = [];

    const setupSubscriptions = async () => {
      // Listen for presence updates from ALL users on room channel (including ourselves)
      const unsubPresenceUpdate = await wsService.subscribe(
        roomChannel,
        "user_presence_updated",
        (data: any) => {
          setPresence(prev => ({
            ...prev,
            [data.userId]: {
              state: data.presenceState,
              timestamp: data.timestamp,
              userName: data.userName
            }
          }));
        }
      );
      unsubscribes.push(unsubPresenceUpdate);

      // Listen for room presence status on user channel (server's bulk response)
      const unsubPresenceStatus = await wsService.subscribe(
        `user-${userId}`,
        "room_presence_status",
        (data: any) => {
          if (data.presence && data.roomId === roomId) {
            // Convert server format to our format - ONLY include users who are actually present
            const formattedPresence: PresenceData = {};
            Object.entries(data.presence).forEach(([participantId, presenceInfo]: [string, any]) => {
              const participant = participants?.find(p => p.id === participantId);

              // If server sends timestamp, check if it's recent (within 2 minutes)
              let isRecent = true;
              if (presenceInfo.timestamp || data.timestamp) {
                const timestamp = presenceInfo.timestamp || data.timestamp;
                const lastUpdate = new Date(timestamp);
                const now = new Date();
                const timeDiff = now.getTime() - lastUpdate.getTime();
                const twoMinutesInMs = 2 * 60 * 1000;
                isRecent = timeDiff < twoMinutesInMs;
              }

              // Only include if state is not offline AND timestamp is recent
              const state = typeof presenceInfo === 'string' ? presenceInfo : presenceInfo.state;
              if (state !== 'offline' && isRecent) {
                formattedPresence[participantId] = {
                  state: state as PresenceState,
                  timestamp: presenceInfo.timestamp || data.timestamp || new Date().toISOString(),
                  userName: participant?.name || participantId
                };
              }
            });

            // Replace entire presence state with filtered server data
            setPresence(formattedPresence);
          }
        }
      );
      unsubscribes.push(unsubPresenceStatus);
    };

    void setupSubscriptions();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [roomId, userId, participants]);

  // Single initialization effect
  useEffect(() => {
    if (!roomId || !userId || isInitializedRef.current) return;

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Send initial presence update to server
    sendPresenceUpdate(roomId, userId, userName, 'active');

    // Request initial presence data from server only once
    if (!hasRequestedInitialPresence.current) {
      requestRoomPresence(roomId, userId);
      hasRequestedInitialPresence.current = true;
    }

    isInitializedRef.current = true;

    return () => {
      // Cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Send offline status when component unmounts
      sendPresenceUpdate(roomId, userId, userName, 'offline');
    };
  }, [roomId, userId, userName, handleVisibilityChange, handleBeforeUnload]);

  return {
    presence,
    currentState,
    updatePresence
  };
}