"use client";

import { useEffect } from "react";
import { User } from "better-auth";
import { getWebSocketService, RoomParticipantData, HostTransferData } from "@/lib/websocket";

interface RoomEventListenerProps {
  roomId: string;
  user: User;
  onParticipantJoined?: (data: RoomParticipantData) => void;
  onParticipantLeft?: (data: RoomParticipantData) => void;
  onHostTransferred?: (data: HostTransferData) => void;
}

export default function RoomEventListener({
  roomId,
  user,
  onParticipantJoined,
  onParticipantLeft,
  onHostTransferred,
}: RoomEventListenerProps) {
  useEffect(() => {
    if (!roomId || !user.id) return;

    const wsService = getWebSocketService(user.id);
    const channel = `room-${roomId}`;
    let unsubscribes: (() => void)[] = [];

    const setupSubscriptions = async () => {
      // Participant joined
      if (onParticipantJoined) {
        const unsubscribe = await wsService.subscribe(
          channel,
          "participant_joined",
          onParticipantJoined
        );
        unsubscribes.push(unsubscribe);
      }

      // Participant left
      if (onParticipantLeft) {
        const unsubscribe = await wsService.subscribe(
          channel,
          "participant_left",
          onParticipantLeft
        );
        unsubscribes.push(unsubscribe);
      }

      // Host transferred
      if (onHostTransferred) {
        const unsubscribe = await wsService.subscribe(
          channel,
          "host_transferred",
          onHostTransferred
        );
        unsubscribes.push(unsubscribe);
      }
    };

    void setupSubscriptions();

    return () => {
      unsubscribes.forEach(fn => fn());
    };
  }, [roomId, user.id, onParticipantJoined, onParticipantLeft, onHostTransferred]);

  return null; // This component only handles events
}