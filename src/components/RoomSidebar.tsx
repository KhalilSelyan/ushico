"use client";

import { User } from "better-auth";
import { FC, useState } from "react";
import { MessageSquare, Camera } from "lucide-react";
import RoomChat from "./RoomChat";
import WebcamPanel from "./WebcamPanel";

interface RoomSidebarProps {
  roomId: string;
  user: User;
  participants: (User & { role: string })[];
  videoRef: React.RefObject<HTMLVideoElement>;
  className?: string;
}

type TabType = "chat" | "webcams";

const RoomSidebar: FC<RoomSidebarProps> = ({
  roomId,
  user,
  participants,
  videoRef,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [webcamCount, setWebcamCount] = useState(0);

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
