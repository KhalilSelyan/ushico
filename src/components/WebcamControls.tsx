"use client";

import { FC } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Camera } from "lucide-react";

interface WebcamControlsProps {
  isJoined: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  participantCount: number;
  isConnecting?: boolean;
  onJoinWithVideo: () => void;
  onJoinAudioOnly: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onLeave: () => void;
}

const WebcamControls: FC<WebcamControlsProps> = ({
  isJoined,
  isVideoEnabled,
  isAudioEnabled,
  participantCount,
  isConnecting,
  onJoinWithVideo,
  onJoinAudioOnly,
  onToggleVideo,
  onToggleAudio,
  onLeave,
}) => {
  if (!isJoined) {
    return (
      <div className="flex flex-col gap-2 p-3 border-t border-gray-200">
        <div className="text-sm text-gray-500 text-center mb-1">
          {participantCount > 0
            ? `${participantCount} participant${participantCount > 1 ? "s" : ""} in webcam`
            : "No one in webcam yet"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onJoinWithVideo}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            {isConnecting ? "Joining..." : "Join with Video"}
          </button>
          <button
            onClick={onJoinAudioOnly}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Mic className="w-4 h-4" />
            {isConnecting ? "Joining..." : "Audio Only"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 p-3 border-t border-gray-200">
      <button
        onClick={onToggleVideo}
        className={`p-3 rounded-full transition-colors ${
          isVideoEnabled
            ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
            : "bg-red-100 hover:bg-red-200 text-red-600"
        }`}
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </button>

      <button
        onClick={onToggleAudio}
        className={`p-3 rounded-full transition-colors ${
          isAudioEnabled
            ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
            : "bg-red-100 hover:bg-red-200 text-red-600"
        }`}
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </button>

      <button
        onClick={onLeave}
        className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
        title="Leave webcam"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
};

export default WebcamControls;
