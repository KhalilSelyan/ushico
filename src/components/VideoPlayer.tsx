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
} from "lucide-react";
import { getWebSocketService, RoomSyncData, ErrorResponse } from "@/lib/websocket";
import { nanoid } from "nanoid";

/* Interfaces and types */

interface VideoPlayerProps {
  roomId: string;           // Changed from chatId
  userRole: "host" | "viewer";
  participants: (User & { role: string })[];
  user: User;
  initialUrl?: string;
  className?: string;
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

const VideoPlayer = ({ roomId, userRole, participants, user, initialUrl, className }: VideoPlayerProps) => {
  // Initialize WebSocket service with userID
  const wsService = getWebSocketService(user.id);

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

  const sourceRef = useRef<HTMLVideoElement>(null);
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
            participants: participants.map(p => ({
              userId: p.id,
              role: p.role
            }))
          });
        } else {
          // Join existing room as viewer
          await wsService.send(`room-${roomId}`, "join_room", {
            roomId,
            userId: user.id
          });
        }
      } catch (error) {
        console.error("Failed to sync room state:", error);
        setError("Failed to establish room connection");
      }
    };

    void syncRoomState();
  }, [roomId, user.id, userRole, participants]);

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

      // Subscribe to error responses
      unsubscribe2 = await wsService.subscribe(channel, "error_response", (errorData: ErrorResponse) => {
        console.error("WebSocket error:", errorData);
        setError(`${errorData.error}: ${errorData.message}`);
        setIsSynced(false);
      });

      // Note: participant_joined, participant_left, host_transferred events
      // would be handled by parent components that manage participant lists
    };

    void setupSubscription();

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
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

  // Periodic sync effect
  useEffect(() => {
    if (type !== "host") return;
    void batchedSync();
    syncTimeoutRef.current = setInterval(batchedSync, SYNC_INTERVAL);
    return () => clearInterval(syncTimeoutRef.current);
  }, [SYNC_INTERVAL, batchedSync, type]);

  const toggleCustomFullscreen = useCallback(() => {
    setIsCustomFullscreen((prev) => {
      const newState = !prev;
      setShowInterface(!newState);
      return newState;
    });
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isCustomFullscreen) {
        setIsCustomFullscreen(false);
        setShowInterface(true);
      }
    };

    const handleFKey = (event: KeyboardEvent) => {
      if (event.key === "f") {
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
      } else {
        await sourceRef.current.pause();
        setIsPlaying(false);
      }
      // Sync the new state immediately
      await batchedSync();
    } catch (err) {
      console.error("Error toggling play state:", err);
      setError("Failed to toggle play state");
    }
  }, [type, batchedSync]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!sourceRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    sourceRef.current.volume = clampedVolume;
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

      {/* URL input */}
      <URLInput
        url={url}
        updateUrl={updateUrl}
        isSynced={isSynced}
        showInterface={showInterface}
        isHost={type === "host"}
      />

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
        onPointerDown={type === "host" ? async () => await togglePlay() : undefined}
      >
        {/* Video Element */}
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
