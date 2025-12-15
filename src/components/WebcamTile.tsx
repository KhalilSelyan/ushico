"use client";

import { FC, useEffect, useRef } from "react";
import { MicOff, VideoOff, Volume2, VolumeX } from "lucide-react";

interface WebcamTileProps {
  stream: MediaStream | null;
  participantName: string;
  participantImage?: string;
  isSelf: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isLocallyMuted: boolean;
  onToggleLocalMute?: () => void;
}

const WebcamTile: FC<WebcamTileProps> = ({
  stream,
  participantName,
  participantImage,
  isSelf,
  isAudioMuted,
  isVideoOff,
  isLocallyMuted,
  onToggleLocalMute,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isVideoOff;

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf || isLocallyMuted}
          className={`w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          {participantImage ? (
            <img
              src={participantImage}
              alt={participantName}
              className="w-16 h-16 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-semibold">
              {participantName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
        <span className="text-white text-sm truncate max-w-[100px]">
          {isSelf ? "You" : participantName}
        </span>
        {isAudioMuted && (
          <MicOff className="w-3.5 h-3.5 text-red-400" />
        )}
        {isVideoOff && (
          <VideoOff className="w-3.5 h-3.5 text-red-400" />
        )}
      </div>

      {/* Local mute button (for others, not self) */}
      {!isSelf && onToggleLocalMute && (
        <button
          onClick={onToggleLocalMute}
          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
          title={isLocallyMuted ? "Unmute for me" : "Mute for me"}
        >
          {isLocallyMuted ? (
            <VolumeX className="w-4 h-4 text-red-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>
      )}
    </div>
  );
};

export default WebcamTile;
