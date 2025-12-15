"use client";

import { User } from "better-auth";
import { FC, useState, useEffect, useCallback } from "react";
import WebcamTile from "./WebcamTile";
import WebcamControls from "./WebcamControls";
import {
  participantWebRTC,
  WebcamParticipant,
  WebcamConnectionState,
} from "@/lib/participant-webrtc";
import {
  getWebSocketService,
  sendWebcamJoin,
  sendWebcamLeave,
  sendWebcamToggle,
} from "@/lib/websocket";

interface WebcamPanelProps {
  roomId: string;
  user: User;
  participants: (User & { role: string })[];
}

const WebcamPanel: FC<WebcamPanelProps> = ({ roomId, user }) => {
  const [connectionState, setConnectionState] = useState<WebcamConnectionState>("idle");
  const [webcamParticipants, setWebcamParticipants] = useState<WebcamParticipant[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [locallyMutedUsers, setLocallyMutedUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Initialize service and subscribe to webcam events
  useEffect(() => {
    participantWebRTC.init(roomId, {
      odparticipantId: user.id,
      participantName: user.name || "Anonymous",
      participantImage: user.image || undefined,
    }, {
      onConnectionStateChange: setConnectionState,
      onParticipantJoined: (participant) => {
        setWebcamParticipants((prev) => {
          const exists = prev.some((p) => p.odparticipantId === participant.odparticipantId);
          if (exists) {
            return prev.map((p) =>
              p.odparticipantId === participant.odparticipantId ? participant : p
            );
          }
          return [...prev, participant];
        });
      },
      onParticipantLeft: (participantId) => {
        setWebcamParticipants((prev) =>
          prev.filter((p) => p.odparticipantId !== participantId)
        );
      },
      onParticipantUpdated: (participant) => {
        setWebcamParticipants((prev) =>
          prev.map((p) =>
            p.odparticipantId === participant.odparticipantId ? participant : p
          )
        );
      },
      onError: (err) => {
        setError(err);
        setTimeout(() => setError(null), 5000);
      },
      onHubStatusChange: (isHub) => {
        console.log("[WebcamPanel] Hub status changed:", isHub);
      },
    });

    // Subscribe to WebSocket webcam events for out-of-band notifications
    const wsService = getWebSocketService(user.id);
    const channel = `room-${roomId}`;
    const unsubscribes: (() => void)[] = [];

    const setupSubscriptions = async () => {
      const unsubJoin = await wsService.subscribe(channel, "webcam_join", (data: any) => {
        console.log("[WebcamPanel] WebSocket webcam_join:", data);
      });
      unsubscribes.push(unsubJoin);

      const unsubLeave = await wsService.subscribe(channel, "webcam_leave", (data: any) => {
        console.log("[WebcamPanel] WebSocket webcam_leave:", data);
      });
      unsubscribes.push(unsubLeave);

      const unsubToggle = await wsService.subscribe(channel, "webcam_toggle", (data: any) => {
        console.log("[WebcamPanel] WebSocket webcam_toggle:", data);
      });
      unsubscribes.push(unsubToggle);
    };

    void setupSubscriptions();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      participantWebRTC.cleanup();
    };
  }, [roomId, user.id, user.name, user.image]);

  const handleJoinWithVideo = useCallback(async () => {
    setError(null);
    try {
      await participantWebRTC.joinWebcam({ video: true, audio: true });
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);

      // Notify via WebSocket
      sendWebcamJoin(
        roomId,
        user.id,
        user.name || "Anonymous",
        user.image || undefined,
        true,
        true,
        participantWebRTC.isHub()
      );
    } catch (err) {
      console.error("[WebcamPanel] Failed to join with video:", err);
    }
  }, [roomId, user.id, user.name, user.image]);

  const handleJoinAudioOnly = useCallback(async () => {
    setError(null);
    try {
      await participantWebRTC.joinWebcam({ video: false, audio: true });
      setIsVideoEnabled(false);
      setIsAudioEnabled(true);

      // Notify via WebSocket
      sendWebcamJoin(
        roomId,
        user.id,
        user.name || "Anonymous",
        user.image || undefined,
        true,
        false,
        participantWebRTC.isHub()
      );
    } catch (err) {
      console.error("[WebcamPanel] Failed to join audio only:", err);
    }
  }, [roomId, user.id, user.name, user.image]);

  const handleToggleVideo = useCallback(() => {
    const newState = participantWebRTC.toggleVideo();
    setIsVideoEnabled(newState);
    sendWebcamToggle(roomId, user.id, undefined, newState);
  }, [roomId, user.id]);

  const handleToggleAudio = useCallback(() => {
    const newState = participantWebRTC.toggleAudio();
    setIsAudioEnabled(newState);
    sendWebcamToggle(roomId, user.id, newState, undefined);
  }, [roomId, user.id]);

  const handleLeave = useCallback(() => {
    participantWebRTC.leaveWebcam();
    setWebcamParticipants([]);
    sendWebcamLeave(roomId, user.id);
  }, [roomId, user.id]);

  const toggleLocalMute = useCallback((participantId: string) => {
    setLocallyMutedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  }, []);

  const isJoined = participantWebRTC.isInWebcamSession();
  const isConnecting = connectionState === "connecting" || connectionState === "reconnecting";

  // Calculate grid layout
  const participantCount = webcamParticipants.length;
  const gridCols =
    participantCount === 1
      ? "grid-cols-1"
      : participantCount <= 4
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <div className="flex flex-col h-full">
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Connection status */}
      {connectionState === "connecting" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 text-sm text-center flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Connecting to webcam session...
        </div>
      )}

      {connectionState === "reconnecting" && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 text-sm text-center flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          Reconnecting...
        </div>
      )}

      {connectionState === "disconnected" && isJoined && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 text-sm text-center">
          Disconnected from webcam session. Attempting to reconnect...
        </div>
      )}

      {connectionState === "failed" && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 text-sm text-center">
          Connection failed. Try leaving and rejoining.
        </div>
      )}

      {/* Webcam grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {webcamParticipants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">No webcams active</p>
            <p className="text-xs mt-1">Join to start sharing your camera</p>
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-2`}>
            {webcamParticipants.map((participant) => (
              <WebcamTile
                key={participant.odparticipantId}
                stream={participant.stream}
                participantName={participant.participantName}
                participantImage={participant.participantImage}
                isSelf={participant.isSelf}
                isAudioMuted={!participant.audioEnabled}
                isVideoOff={!participant.videoEnabled}
                isLocallyMuted={locallyMutedUsers.has(participant.odparticipantId)}
                onToggleLocalMute={
                  participant.isSelf
                    ? undefined
                    : () => toggleLocalMute(participant.odparticipantId)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <WebcamControls
        isJoined={isJoined}
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        participantCount={webcamParticipants.filter((p) => !p.isSelf).length}
        isConnecting={isConnecting}
        onJoinWithVideo={handleJoinWithVideo}
        onJoinAudioOnly={handleJoinAudioOnly}
        onToggleVideo={handleToggleVideo}
        onToggleAudio={handleToggleAudio}
        onLeave={handleLeave}
      />
    </div>
  );
};

export default WebcamPanel;
