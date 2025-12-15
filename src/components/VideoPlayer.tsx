// videoplayer.tsx

"use client";
import { User } from "better-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Monitor,
  Video,
  FileVideo,
  Wifi,
  WifiOff,
  Link,
} from "lucide-react";
import {
  getWebSocketService,
  RoomSyncData,
  ErrorResponse,
  sendStreamModeChange,
} from "@/lib/websocket";
import { nanoid } from "nanoid";
import { useVideoReactions } from "@/hooks/useVideoReactions";
import { FloatingReactions } from "@/components/FloatingReactions";
import { createAnnouncements } from "@/utils/announcements";
import {
  RoomWebRTCService,
  ConnectionState,
  ConnectionQuality,
  ViewerInfo,
} from "@/lib/room-webrtc";

/* Interfaces and types */

type StreamMode = "url" | "webrtc";
type WebRTCSource = "screen" | "camera" | "file";

interface VideoPlayerProps {
  roomId: string; // Changed from chatId
  userRole: "host" | "viewer";
  participants: (User & { role: string })[];
  user: User;
  initialUrl?: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

// Use the server-aligned interface from websocket.ts
type SyncData = RoomSyncData;

interface OptimizedSyncData {
  type: "url" | "time" | "state";
  data: string | number | "playing" | "paused";
  timestamp: number;
}

/* Subcomponents */

interface ErrorAndSyncNotificationsProps {
  error: string | null;
  isSynced: boolean;
  type: "host" | "watcher";
  isCustomFullscreen: boolean;
}

const ErrorAndSyncNotifications: React.FC<ErrorAndSyncNotificationsProps> = ({
  error,
  isSynced,
  type,
  isCustomFullscreen,
}) => {
  return (
    <div
      className={`flex animate-pulse repeat-[5] flex-col gap-2 w-full md:w-2/3 ${
        isCustomFullscreen
          ? "absolute top-4 left-1/2 -translate-x-1/2 z-10"
          : ""
      }`}
    >
      {error && (
        <div className="p-2 bg-red-100 text-red-700 rounded-lgs">{error}</div>
      )}

      {!isSynced && type === "watcher" && (
        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
          Syncing with host...
        </div>
      )}
    </div>
  );
};

interface URLInputProps {
  url: string;
  updateUrl: (newUrl: string) => void;
  isSynced: boolean;
  showInterface: boolean;
  isHost: boolean;
}

const URLInput: React.FC<URLInputProps> = ({
  url,
  updateUrl,
  isSynced,
  showInterface,
  isHost,
}) => {
  return (
    <>
      {showInterface && (
        <div
          className={`flex w-full items-center justify-center space-x-4 divide-x-2 rounded-lg bg-zinc-400 p-2 md:w-2/3`}
        >
          <span className="ml-2 text-sm font-bold text-white">URL: </span>
          {isHost ? (
            <input
              type="text"
              autoComplete="off"
              placeholder="Paste a url to an mp4 file"
              className="h-full w-full border-none bg-transparent px-4 text-white placeholder:text-white focus:outline-none"
              onChange={(e) => updateUrl(e.target.value)}
              value={url || ""}
            />
          ) : (
            <div className="h-full w-full px-4 text-white">
              {url || "No video selected by host"}
            </div>
          )}
          {!isSynced && (
            <span className="pl-2 text-xs font-bold text-yellow-200">
              Reconnecting...
            </span>
          )}
        </div>
      )}
      {!isHost && showInterface && (
        <div className="text-sm text-muted-foreground text-center">
          Only the host can control video playback
        </div>
      )}
    </>
  );
};

/* Stream Mode Selector - Host only */
interface StreamModeSelectorProps {
  mode: StreamMode;
  onModeChange: (mode: StreamMode) => void;
  showInterface: boolean;
}

const StreamModeSelector: React.FC<StreamModeSelectorProps> = ({
  mode,
  onModeChange,
  showInterface,
}) => {
  if (!showInterface) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
      <span className="text-xs text-zinc-400">Mode:</span>
      <button
        onClick={() => onModeChange("url")}
        className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
          mode === "url"
            ? "bg-indigo-600 text-white"
            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
        }`}
      >
        <Link className="w-4 h-4" />
        URL
      </button>
      <button
        onClick={() => onModeChange("webrtc")}
        className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
          mode === "webrtc"
            ? "bg-indigo-600 text-white"
            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
        }`}
      >
        <Wifi className="w-4 h-4" />
        Stream
      </button>
    </div>
  );
};

/* WebRTC Source Selector - Host only when in webrtc mode */
interface WebRTCSourceSelectorProps {
  onSelectSource: (source: WebRTCSource, file?: File) => void;
  isStreaming: boolean;
  onStopStream: () => void;
  connectionState: ConnectionState;
  viewerCount: number;
  viewers: ViewerInfo[];
}

const WebRTCSourceSelector: React.FC<WebRTCSourceSelectorProps> = ({
  onSelectSource,
  isStreaming,
  onStopStream,
  connectionState,
  viewerCount,
  viewers,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectSource("file", file);
    }
  };

  // Count viewers by connection status
  const connectedViewers = viewers.filter(v => v.dataConnected && v.mediaConnected).length;
  const connectingViewers = viewers.filter(v => v.dataConnected && !v.mediaConnected).length;

  if (isStreaming) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-zinc-800 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-white">Streaming</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {connectedViewers > 0 && (
              <div className="flex items-center gap-1 text-green-400">
                <Wifi className="w-4 h-4" />
                {connectedViewers} connected
              </div>
            )}
            {connectingViewers > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                {connectingViewers} connecting
              </div>
            )}
            {viewerCount === 0 && (
              <span className="text-zinc-400">No viewers yet</span>
            )}
          </div>
          <button
            onClick={onStopStream}
            className="ml-auto px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        </div>
        {/* Viewer details */}
        {viewers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {viewers.map((viewer) => (
              <div
                key={viewer.peerId}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  viewer.mediaConnected
                    ? "bg-green-900/50 text-green-300"
                    : "bg-yellow-900/50 text-yellow-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    viewer.mediaConnected ? "bg-green-400" : "bg-yellow-400 animate-pulse"
                  }`}
                />
                <span>Viewer {viewer.peerId.slice(-4)}</span>
                {viewer.mediaConnected && viewer.rtt > 0 && (
                  <span className="text-zinc-400">{viewer.rtt}ms</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">Select stream source:</div>
        {viewerCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            {connectedViewers > 0 && (
              <span className="text-green-400">{connectedViewers} ready</span>
            )}
            {connectingViewers > 0 && (
              <span className="text-yellow-400">{connectingViewers} waiting</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onSelectSource("screen")}
          disabled={connectionState !== "connected"}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Monitor className="w-5 h-5" />
          Share Screen
        </button>
        <button
          onClick={() => onSelectSource("camera")}
          disabled={connectionState !== "connected"}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Video className="w-5 h-5" />
          Camera
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={connectionState !== "connected"}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileVideo className="w-5 h-5" />
          Video File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {connectionState !== "connected" && (
        <div className="text-xs text-yellow-500">
          Waiting for connection...
        </div>
      )}
    </div>
  );
};

/* WebRTC Connection Status - Viewer */
interface WebRTCViewerStatusProps {
  connectionState: ConnectionState;
  rtcQuality: ConnectionQuality;
  onReconnect?: () => void;
}

const WebRTCViewerStatus: React.FC<WebRTCViewerStatusProps> = ({
  connectionState,
  rtcQuality,
  onReconnect,
}) => {
  if (connectionState === "connected") {
    return (
      <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
        <Wifi
          className={`w-4 h-4 ${
            rtcQuality === "excellent"
              ? "text-green-500"
              : rtcQuality === "good"
              ? "text-yellow-500"
              : "text-red-500"
          }`}
        />
        <span className="text-sm text-zinc-300">Connected to host stream</span>
      </div>
    );
  }

  if (connectionState === "connecting") {
    return (
      <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
        <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-zinc-300">Connecting to host...</span>
      </div>
    );
  }

  if (connectionState === "disconnected" || connectionState === "failed") {
    return (
      <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
        <WifiOff className="w-4 h-4 text-red-500" />
        <span className="text-sm text-zinc-300">
          {connectionState === "failed"
            ? "Connection failed"
            : "Disconnected from host"}
        </span>
        {onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-2 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
      <span className="text-sm text-zinc-400">Waiting for host to stream...</span>
    </div>
  );
};

interface VideoElementProps {
  sourceRef: React.RefObject<HTMLVideoElement>;
  url: string;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  syncVideoState: () => Promise<void>;
  isCustomFullscreen: boolean;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  type: "host" | "watcher";
}

const VideoElement: React.FC<VideoElementProps> = ({
  sourceRef,
  url,
  setError,
  syncVideoState,
  isCustomFullscreen,
  setCurrentTime,
  setDuration,
  setIsPlaying,
  type,
}) => {
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (!sourceRef.current || !url) return;

    const videoElement = sourceRef.current;
    videoElement.src = url;
    videoElement.load();

    const handleWaiting = () => {
      if (type === "watcher") {
        setError("Buffering... Please wait");
      }
    };
    const handleSeeking = () => {
      setIsSeeking(true);
      if (type === "watcher") {
        setError("Syncing...");
      }
    };

    const handleSeeked = () => {
      setIsSeeking(false);
      setError(null);
      void syncVideoState();
    };

    const handleCanPlay = () => {
      setError(null);
      // Initial sync when video is ready
      if (type === "host") {
        void syncVideoState();
      }
    };

    const handleLoadedMetadata = () => {
      // Ensure video is ready to play
      void videoElement.play().catch(() => {
        // Autoplay may be blocked, that's okay
      });
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("seeking", handleSeeking);
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);

    return () => {
      videoElement.removeEventListener("waiting", handleWaiting);
      videoElement.removeEventListener("seeking", handleSeeking);
      videoElement.removeEventListener("seeked", handleSeeked);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
    };
  }, [url, sourceRef, setError, setIsPlaying, type, syncVideoState]);

  useEffect(() => {
    if (!sourceRef.current) return;

    const video = sourceRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
    };
  }, [sourceRef, setCurrentTime, setDuration, setIsPlaying]);

  return (
    <video
      ref={sourceRef}
      className={`${
        isCustomFullscreen
          ? "h-full w-full object-contain"
          : "h-full min-h-full w-auto min-w-full max-w-none border-2 border-black portrait:h-2/5 portrait:w-full landscape:h-full landscape:w-3/5"
      }`}
      preload="auto"
      playsInline
      autoPlay
      onPause={syncVideoState}
      onPlay={syncVideoState}
      onSeeking={syncVideoState}
      onError={async () => {
        setError("Failed to load video");
        await syncVideoState();
      }}
    >
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
};

interface VideoControlsProps {
  isPlaying: boolean;
  togglePlay: () => Promise<void>;
  currentTime: number;
  duration: number;
  formatTime: (timeInSeconds: number) => string;
  handleSeek: (event: React.MouseEvent<HTMLDivElement>) => void;
  progressRef: React.RefObject<HTMLDivElement>;
  volume: number;
  handleVolumeChange: (newVolume: number) => void;
  toggleCustomFullscreen: () => void;
  isCustomFullscreen: boolean;
  showControls: boolean;
  isHost: boolean;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  togglePlay,
  currentTime,
  duration,
  formatTime,
  handleSeek,
  progressRef,
  volume,
  handleVolumeChange,
  toggleCustomFullscreen,
  isCustomFullscreen,
  showControls,
  isHost,
}) => {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300 ${
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Progress bar */}
      <div
        ref={progressRef}
        className="w-full h-1 bg-white/30 rounded-full mb-4 cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-white rounded-full relative"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transform -translate-x-1/2" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={isHost ? togglePlay : undefined}
          className={`text-white transition-colors ${
            isHost
              ? "hover:text-white/80 cursor-pointer"
              : "opacity-50 cursor-not-allowed"
          }`}
          disabled={!isHost}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>

        {/* Time */}
        <div className="text-white text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
            className="text-white hover:text-white/80 transition-colors"
          >
            {volume === 0 ? (
              <VolumeX className="w-6 h-6" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 accent-white"
          />
        </div>

        <div className="flex-1" />

        {/* Fullscreen toggle */}
        <button
          onClick={toggleCustomFullscreen}
          className="text-white hover:text-white/80 transition-colors"
        >
          {isCustomFullscreen ? (
            <Minimize2 className="w-6 h-6" />
          ) : (
            <Maximize2 className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
};

/* Main VideoPlayer Component */

const VideoPlayer = ({
  roomId,
  userRole,
  participants,
  user,
  initialUrl,
  className,
  videoRef: externalVideoRef,
}: VideoPlayerProps) => {
  // Initialize WebSocket service with userID
  const wsService = getWebSocketService(user.id);

  // Video reactions hook
  const { reactions, handleVideoReaction } = useVideoReactions(roomId);

  // Announcements
  const announcements = createAnnouncements(roomId);

  // State variables and refs
  const [type, setType] = useState<"host" | "watcher">("watcher");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(true);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [showInterface, setShowInterface] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "poor">(
    "good"
  );
  const lastMessageTime = useRef<number>(0);
  const [currentVideoId, setCurrentVideoId] = useState<string>("");
  const lastKnownUrl = useRef<string>("");

  // WebRTC state
  const [streamMode, setStreamMode] = useState<StreamMode>("url");
  const [rtcConnectionState, setRtcConnectionState] = useState<ConnectionState>("idle");
  const [rtcQuality, setRtcQuality] = useState<ConnectionQuality>("excellent");
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const webrtcServiceRef = useRef<RoomWebRTCService | null>(null);
  const rtcVideoRef = useRef<HTMLVideoElement>(null);

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const sourceRef = externalVideoRef || internalVideoRef;
  const lastSyncTime = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastKnownState = useRef<SyncData | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const progressRef = useRef<HTMLDivElement>(null);

  // Constants
  const SYNC_INTERVAL = 1000 * 60 * 5; // 5 minutes
  const TIME_SYNC_THRESHOLD = 2.5; // seconds
  const SYNC_RETRY_INTERVAL = 5000; // 5 seconds
  const CONTROLS_HIDE_DELAY = 2000;

  useEffect(() => {
    setType(userRole === "host" ? "host" : "watcher");
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [userRole, initialUrl]);

  // Sync room state with WebSocket server when component mounts
  useEffect(() => {
    if (!roomId || !user.id || !userRole) return;

    const syncRoomState = async () => {
      try {
        if (userRole === "host") {
          // Tell WebSocket server about existing room and establish host permissions
          await wsService.send(`room-${roomId}`, "sync_room_state", {
            roomId,
            hostId: user.id,
            participants: participants.map((p) => ({
              userId: p.id,
              role: p.role,
            })),
          });
        } else {
          // Join existing room as viewer
          await wsService.send(`room-${roomId}`, "join_room", {
            roomId,
            userId: user.id,
          });
        }
      } catch (error) {
        console.error("Failed to sync room state:", error);
        setError("Failed to establish room connection");
      }
    };

    void syncRoomState();
  }, [roomId, user.id, userRole, participants]);

  // Initialize WebRTC when in stream mode
  // Uses cancelled flag to prevent state updates after unmount/mode change
  useEffect(() => {
    if (streamMode !== "webrtc") {
      // Cleanup WebRTC when switching away
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.cleanup();
        webrtcServiceRef.current = null;
        setRtcConnectionState("idle");
        setIsStreaming(false);
        setViewerCount(0);
      }
      return;
    }

    let cancelled = false;
    const service = new RoomWebRTCService();

    const initWebRTC = async () => {
      try {
        const isHost = userRole === "host";

        await service.init(roomId, isHost, {
          onConnectionStateChange: (state) => {
            if (cancelled) return;
            console.log("[VideoPlayer] RTC connection state:", state);
            setRtcConnectionState(state);
          },
          onRemoteStream: (stream) => {
            if (cancelled) return;
            console.log("[VideoPlayer] Received remote stream with tracks:", stream.getTracks().map(t => t.kind).join(", "));
            if (rtcVideoRef.current) {
              rtcVideoRef.current.srcObject = stream;
              rtcVideoRef.current.volume = volume; // Apply current volume setting
              rtcVideoRef.current.muted = false; // Ensure not muted for viewers
              rtcVideoRef.current.play().catch((err) => {
                // AbortError happens when a new play() interrupts a pending one
                // This is not a real error, just ignore it
                if (err.name === "AbortError") {
                  console.log("[VideoPlayer] Play request was interrupted, ignoring");
                  return;
                }
                if (cancelled) return;
                console.error("Error playing RTC stream:", err);
                setError("Failed to play stream. Click to retry.");
              });
            }
          },
          onConnectionQualityChange: (quality) => {
            if (cancelled) return;
            setRtcQuality(quality);
          },
          onError: (errorMsg) => {
            if (cancelled) return;
            console.error("[VideoPlayer] RTC error:", errorMsg);
            setError(errorMsg);
          },
          onViewerCountChange: (count) => {
            if (cancelled) return;
            setViewerCount(count);
          },
          onViewersChange: (viewerInfos) => {
            if (cancelled) return;
            setViewers(viewerInfos);
          },
        });

        // Only assign to ref if init completed and we weren't cancelled
        if (!cancelled) {
          webrtcServiceRef.current = service;
        } else {
          // Cleanup if cancelled during init
          service.cleanup();
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to initialize WebRTC:", err);
        setError("Failed to start stream connection");
      }
    };

    void initWebRTC();

    return () => {
      cancelled = true;
      service.cleanup();
      webrtcServiceRef.current = null;
    };
  }, [streamMode, roomId, userRole, volume]);

  // Handle stream source selection (host only)
  const handleSelectSource = useCallback(
    async (source: WebRTCSource, file?: File) => {
      if (!webrtcServiceRef.current || userRole !== "host") return;

      try {
        setError(null);
        let stream: MediaStream;

        switch (source) {
          case "screen":
            stream = await webrtcServiceRef.current.startScreenShare();
            break;
          case "camera":
            stream = await webrtcServiceRef.current.startCamera();
            break;
          case "file":
            if (!file) {
              setError("No file selected");
              return;
            }
            stream = await webrtcServiceRef.current.startFileStream(file);
            break;
          default:
            return;
        }

        // Show local preview
        if (rtcVideoRef.current) {
          rtcVideoRef.current.srcObject = stream;
          rtcVideoRef.current.muted = true; // Mute local preview
          await rtcVideoRef.current.play();
        }

        setIsStreaming(true);
        announcements.hostStartedStreaming?.(user.name || "Host");
      } catch (err) {
        console.error("Failed to start stream:", err);
        setError(
          source === "screen"
            ? "Screen share was cancelled or denied"
            : source === "camera"
            ? "Camera access denied"
            : "Failed to stream video file"
        );
      }
    },
    [userRole, announcements, user.name]
  );

  // Handle stop streaming (host only)
  const handleStopStream = useCallback(() => {
    if (!webrtcServiceRef.current) return;

    webrtcServiceRef.current.stopStream();
    setIsStreaming(false);

    if (rtcVideoRef.current) {
      rtcVideoRef.current.srcObject = null;
    }
  }, []);

  // Handle reconnection for viewers when connection fails
  const handleReconnect = useCallback(async () => {
    if (userRole === "host") return; // Only for viewers

    setError(null);
    setRtcConnectionState("connecting");

    // Cleanup existing service
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.cleanup();
      webrtcServiceRef.current = null;
    }

    // Clear video element
    if (rtcVideoRef.current) {
      rtcVideoRef.current.srcObject = null;
    }

    // Create new service and reinitialize
    const service = new RoomWebRTCService();

    try {
      await service.init(roomId, false, {
        onConnectionStateChange: (state) => {
          console.log("[VideoPlayer] Reconnect - RTC connection state:", state);
          setRtcConnectionState(state);
        },
        onRemoteStream: (stream) => {
          console.log("[VideoPlayer] Reconnect - Received remote stream");
          if (rtcVideoRef.current) {
            rtcVideoRef.current.srcObject = stream;
            rtcVideoRef.current.volume = volume;
            rtcVideoRef.current.muted = false;
            rtcVideoRef.current.play().catch((err) => {
              if (err.name === "AbortError") return;
              console.error("Error playing RTC stream:", err);
              setError("Failed to play stream. Click to retry.");
            });
          }
        },
        onConnectionQualityChange: (quality) => {
          setRtcQuality(quality);
        },
        onError: (errorMsg) => {
          console.error("[VideoPlayer] Reconnect - RTC error:", errorMsg);
          setError(errorMsg);
        },
        onViewerCountChange: (count) => {
          setViewerCount(count);
        },
      });

      webrtcServiceRef.current = service;
    } catch (err) {
      console.error("Failed to reconnect WebRTC:", err);
      setError("Reconnection failed. Try again.");
      setRtcConnectionState("failed");
    }
  }, [roomId, userRole, volume]);

  // Handle mode change (host only broadcasts)
  const handleModeChange = useCallback((mode: StreamMode) => {
    setStreamMode(mode);
    setError(null);

    // Broadcast mode change to other participants
    if (userRole === "host") {
      sendStreamModeChange(roomId, user.id, mode);
    }
  }, [userRole, roomId, user.id]);

  // Sync video state to server
  const batchedSync = useCallback(async () => {
    if (!sourceRef.current || !url || type !== "host") return;

    const now = Date.now();
    if (now - lastSyncTime.current < 500) return;
    lastSyncTime.current = now;

    const updates: OptimizedSyncData[] = [];

    // Collect all changes
    if (url !== lastKnownUrl.current) {
      updates.push({
        type: "url",
        data: url,
        timestamp: now,
      });
    }

    const timeDiff = Math.abs(
      sourceRef.current.currentTime - (lastKnownState.current?.timestamp ?? 0)
    );
    if (timeDiff > TIME_SYNC_THRESHOLD) {
      updates.push({
        type: "time",
        data: sourceRef.current.currentTime,
        timestamp: now,
      });
    }

    const currentState = sourceRef.current.paused ? "paused" : "playing";
    if (currentState !== lastKnownState.current?.state) {
      updates.push({
        type: "state",
        data: currentState,
        timestamp: now,
      });
    }

    // Send all updates in one message if there are any
    if (updates.length > 0) {
      const syncData: RoomSyncData = {
        timestamp: sourceRef.current.currentTime,
        url: url,
        roomId: roomId,
        state: currentState,
        videoId: currentVideoId,
      };
      await wsService.send(`room-${roomId}`, "host_sync", syncData);
    }

    lastKnownState.current = {
      url,
      timestamp: sourceRef.current.currentTime,
      state: currentState,
      roomId,
      videoId: currentVideoId,
    };
  }, [roomId, url, type]);

  // Update URL and sync with server
  const updateUrl = useCallback(
    (newUrl: string) => {
      try {
        // Don't update if the URL is empty and we already have a URL
        if (!newUrl && url) {
          return;
        }

        // If URL is empty and we don't have a URL, allow it
        if (!newUrl && !url) {
          setUrl("");
          return;
        }

        new URL(newUrl); // Basic URL validation
        const newVideoId = nanoid();
        setCurrentVideoId(newVideoId);
        lastKnownUrl.current = newUrl;
        setUrl(newUrl);
        if (type === "host") {
          announcements.videoChanged(user.name || "Host", newUrl);
          void batchedSync(); // Sync new URL immediately
        }
        setError(null);
      } catch {
        setError("Please enter a valid URL");
      }
    },
    [type, batchedSync, url]
  );

  // Subscribe to sync messages
  useEffect(() => {
    if (!roomId || !user.id) return;

    const channel = `room-${roomId}`;
    let unsubscribe1: (() => void) | undefined;
    let unsubscribe2: (() => void) | undefined;
    let unsubscribeReactions: (() => void) | undefined;
    let unsubscribeStreamMode: (() => void) | undefined;
    const setupSubscription = async () => {
      // Subscribe to sync events
      unsubscribe1 = await wsService.subscribe(channel, "host_sync", (data) => {
        const now = Date.now();
        const messageDelay = now - lastMessageTime.current;
        lastMessageTime.current = now;

        // Monitor message delay
        if (messageDelay > 1000) {
          setConnectionQuality("poor");
        } else {
          setConnectionQuality("good");
        }

        if (type !== "watcher" || !sourceRef.current) return;

        // Update last known state
        lastKnownState.current = data as SyncData;
        const syncData = data as SyncData;

        // Handle URL updates with video ID
        if (syncData.url && syncData.url !== lastKnownUrl.current) {
          lastKnownUrl.current = syncData.url;
          setUrl(syncData.url);
          setCurrentVideoId(syncData.videoId);
          return;
        }

        // Only process time and state updates if we're on the same video
        if (syncData.videoId && syncData.videoId !== currentVideoId) {
          return;
        }

        const timeDifference = Math.abs(
          syncData.timestamp - sourceRef.current.currentTime
        );

        const syncActions = async () => {
          if (timeDifference > TIME_SYNC_THRESHOLD) {
            sourceRef.current!.currentTime = syncData.timestamp;
          }

          try {
            if (syncData.state === "paused" && !sourceRef.current!.paused) {
              await sourceRef.current!.pause();
            } else if (
              syncData.state === "playing" &&
              sourceRef.current!.paused
            ) {
              await sourceRef.current!.play();
            }
            setIsSynced(true);
          } catch (err) {
            console.error("Video state sync error:", err);
            setIsSynced(false);
          }
        };

        void syncActions();
      });

      // Subscribe to video reactions

      unsubscribeReactions = await wsService.subscribe(
        channel,
        "video_reaction",
        handleVideoReaction
      );

      // Subscribe to error responses
      unsubscribe2 = await wsService.subscribe(
        channel,
        "error_response",
        (errorData: ErrorResponse) => {
          console.error("WebSocket error:", errorData);
          setError(`${errorData.error}: ${errorData.message}`);
          setIsSynced(false);
        }
      );

      // Subscribe to stream mode changes (viewers only)
      unsubscribeStreamMode = await wsService.subscribe(
        channel,
        "stream_mode_changed",
        (data: { roomId: string; userId: string; mode: StreamMode }) => {
          console.log("[VideoPlayer] Stream mode changed:", data.mode);
          // Only viewers should react to this
          if (type === "watcher") {
            setStreamMode(data.mode);
            setError(null);
          }
        }
      );

      // Note: participant_joined, participant_left, host_transferred events
      // would be handled by parent components that manage participant lists
    };

    void setupSubscription();

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
      unsubscribeReactions?.();
      unsubscribeStreamMode?.();
    };
  }, [roomId, type, url, user.id]);

  // Periodic sync effect
  useEffect(() => {
    if (type !== "host") return;

    const syncInterval =
      connectionQuality === "poor"
        ? SYNC_INTERVAL * 2 // Double the interval for poor connections
        : SYNC_INTERVAL;

    void batchedSync();
    syncTimeoutRef.current = setInterval(batchedSync, syncInterval);
    return () => {
      if (syncTimeoutRef.current) clearInterval(syncTimeoutRef.current);
    };
  }, [SYNC_INTERVAL, batchedSync, type, connectionQuality]);

  const toggleCustomFullscreen = useCallback(() => {
    setIsCustomFullscreen((prev) => {
      const newState = !prev;
      setShowInterface(!newState);
      return newState;
    });
  }, []);

  useEffect(() => {
    const isInputFocused = () => {
      const activeElement = document.activeElement;
      return (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.contentEditable === "true")
      );
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isCustomFullscreen) {
        setIsCustomFullscreen(false);
        setShowInterface(true);
      }
    };

    const handleFKey = (event: KeyboardEvent) => {
      if (event.key === "f" && !isInputFocused()) {
        toggleCustomFullscreen();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    document.addEventListener("keydown", handleFKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.removeEventListener("keydown", handleFKey);
    };
  }, [isCustomFullscreen, toggleCustomFullscreen]);

  useEffect(() => {
    if (!sourceRef.current) return;

    const handleFullscreenChange = (event: Event) => {
      event.preventDefault();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        setIsCustomFullscreen(true);
        setShowInterface(false);
      }
    };

    sourceRef.current.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );
    return () => {
      sourceRef.current?.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Format time helper
  const formatTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Video control functions

  const togglePlay = useCallback(async () => {
    if (type !== "host") return;
    if (!sourceRef.current) return;

    try {
      if (sourceRef.current.paused) {
        await sourceRef.current.play();
        setIsPlaying(true);
        announcements.hostResumed(user.name || "Host");
      } else {
        await sourceRef.current.pause();
        setIsPlaying(false);
        announcements.hostPaused(user.name || "Host");
      }
      // Sync the new state immediately
      await batchedSync();
    } catch (err) {
      console.error("Error toggling play state:", err);
      setError("Failed to toggle play state");
    }
  }, [type, batchedSync, announcements, user.name]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    // Apply volume to whichever video element is active
    if (sourceRef.current) {
      sourceRef.current.volume = clampedVolume;
    }
    if (rtcVideoRef.current) {
      rtcVideoRef.current.volume = clampedVolume;
    }
    setVolume(clampedVolume);
  }, []);

  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!sourceRef.current || !progressRef.current) return;

      const rect = progressRef.current.getBoundingClientRect();
      const pos = (event.clientX - rect.left) / rect.width;
      const newTime = pos * duration;

      sourceRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  useEffect(() => {
    const hideControls = () => {
      if (!isHovering && isPlaying) {
        setShowControls(false);
      }
    };

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (showControls) {
      controlsTimeoutRef.current = setTimeout(
        hideControls,
        CONTROLS_HIDE_DELAY
      );
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isHovering, isPlaying]);

  return (
    <div
      ref={playerContainerRef}
      className={`flex flex-col items-center gap-2 w-full transition-all duration-300 ease-in-out ${
        isCustomFullscreen
          ? "fixed md:absolute inset-0 z-50 bg-black p-4"
          : "relative"
      } ${className || ""}`}
      onMouseMove={() => {
        setShowControls(true);
        setIsHovering(true);
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Error and sync status notifications */}
      <ErrorAndSyncNotifications
        error={error}
        isSynced={isSynced}
        type={type}
        isCustomFullscreen={isCustomFullscreen}
      />

      {/* Mode selector - Host only */}
      {type === "host" && showInterface && (
        <StreamModeSelector
          mode={streamMode}
          onModeChange={handleModeChange}
          showInterface={showInterface}
        />
      )}

      {/* URL input - only in URL mode */}
      {streamMode === "url" && (
        <URLInput
          url={url}
          updateUrl={updateUrl}
          isSynced={isSynced}
          showInterface={showInterface}
          isHost={type === "host"}
        />
      )}

      {/* WebRTC controls - Host in stream mode */}
      {streamMode === "webrtc" && type === "host" && showInterface && (
        <WebRTCSourceSelector
          onSelectSource={handleSelectSource}
          isStreaming={isStreaming}
          onStopStream={handleStopStream}
          connectionState={rtcConnectionState}
          viewerCount={viewerCount}
          viewers={viewers}
        />
      )}

      {/* WebRTC status - Viewer in stream mode */}
      {streamMode === "webrtc" && type === "watcher" && showInterface && (
        <WebRTCViewerStatus
          connectionState={rtcConnectionState}
          rtcQuality={rtcQuality}
          onReconnect={handleReconnect}
        />
      )}

      {/* Participants */}
      {showInterface && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Watching with:</span>
          {participants.map((participant, index) => (
            <span key={participant.id} className="flex items-center gap-1">
              {participant.name}
              {participant.role === "host" && (
                <span className="text-xs bg-primary text-primary-foreground px-1 rounded">
                  HOST
                </span>
              )}
              {index < participants.length - 1 && ","}
            </span>
          ))}
        </div>
      )}

      {/* Video container */}
      <div
        className={`relative flex items-center justify-center rounded-xl ${
          isCustomFullscreen ? "w-full h-full" : "h-4/5 w-full bg-gray-500/5"
        }`}
        onPointerDown={
          type === "host" && streamMode === "url"
            ? async () => await togglePlay()
            : undefined
        }
      >
        {/* URL-based Video Element */}
        {streamMode === "url" && (
          <VideoElement
            sourceRef={sourceRef}
            url={url}
            setError={setError}
            syncVideoState={batchedSync}
            isCustomFullscreen={isCustomFullscreen}
            setCurrentTime={setCurrentTime}
            setDuration={setDuration}
            setIsPlaying={setIsPlaying}
            type={type}
          />
        )}

        {/* WebRTC Video Element */}
        {streamMode === "webrtc" && (
          <video
            ref={rtcVideoRef}
            className={`${
              isCustomFullscreen
                ? "h-full w-full object-contain"
                : "h-full min-h-full w-auto min-w-full max-w-none border-2 border-black portrait:h-2/5 portrait:w-full landscape:h-full landscape:w-3/5"
            }`}
            playsInline
            autoPlay
          />
        )}

        {/* Floating Reactions */}
        <FloatingReactions
          reactions={reactions}
          currentVideoTime={currentTime}
        />

        {/* Custom controls overlay */}
        <VideoControls
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          currentTime={currentTime}
          duration={duration}
          formatTime={formatTime}
          handleSeek={handleSeek}
          progressRef={progressRef}
          volume={volume}
          handleVolumeChange={handleVolumeChange}
          toggleCustomFullscreen={toggleCustomFullscreen}
          isCustomFullscreen={isCustomFullscreen}
          showControls={showControls}
          isHost={type === "host"}
        />

      </div>
    </div>
  );
};

export default VideoPlayer;
