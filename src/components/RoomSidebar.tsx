"use client";

import { User } from "better-auth";
import { FC, useState, useEffect } from "react";
import { MessageSquare, Camera } from "lucide-react";
import RoomChat from "./RoomChat";
import WebcamPanel from "./WebcamPanel";
import { getWebSocketService } from "@/lib/websocket";

interface RoomSidebarProps {
  roomId: string;
  user: User;
  participants: (User & { role: string })[];
  videoRef: React.RefObject<HTMLVideoElement>;
  className?: string;
}

type TabType = "chat" | "webcams";

interface WebcamUser {
  odparticipantId: string;
  participantName: string;
}

const RoomSidebar: FC<RoomSidebarProps> = ({
  roomId,
  user,
  participants,
  videoRef,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [webcamUsers, setWebcamUsers] = useState<Map<string, WebcamUser>>(new Map());

  // Track webcam participants via WebSocket events
  useEffect(() => {
    const wsService = getWebSocketService(user.id);
    const channel = `room-${roomId}`;
    const unsubscribes: (() => void)[] = [];

    const setupSubscriptions = async () => {
      const unsubJoin = await wsService.subscribe(channel, "webcam_join", (data: any) => {
        setWebcamUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId, {
            odparticipantId: data.userId,
            participantName: data.userName,
          });
          return next;
        });
      });
      unsubscribes.push(unsubJoin);

      const unsubLeave = await wsService.subscribe(channel, "webcam_leave", (data: any) => {
        setWebcamUsers((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      });
      unsubscribes.push(unsubLeave);
    };

    void setupSubscriptions();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [roomId, user.id]);

  const webcamCount = webcamUsers.size;

  return (
    <div
      className={`flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden ${
        className || ""
      }`}
    >
      {/* Tab Header */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("webcams")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === "webcams"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Camera className="w-4 h-4" />
          Webcams
          {webcamCount > 0 && (
            <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">
              {webcamCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <RoomChat
            roomId={roomId}
            user={user}
            participants={participants}
            videoRef={videoRef}
            className="h-full"
          />
        ) : (
          <WebcamPanel
            roomId={roomId}
            user={user}
            participants={participants}
          />
        )}
      </div>
    </div>
  );
};

export default RoomSidebar;
