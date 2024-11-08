"use client";
import { pusherClient } from "@/lib/pusher";
import axios from "axios";
import { User } from "next-auth";
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

interface VideoPlayerProps {
  chatId: string;
  user: User;
  userId1: string;
}

interface SyncData {
  timestamp: number;
  url: string;
  chatId: string;
  state: "playing" | "paused";
}

const VideoPlayer = ({ chatId, user, userId1 }: VideoPlayerProps) => {
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

  const sourceRef = useRef<HTMLVideoElement>(null);
  const lastSyncTime = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastKnownState = useRef<SyncData | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const progressRef = useRef<HTMLDivElement>(null);

  // Constants
  const SYNC_API_ENDPOINT = "/api/watchSync";
  const SYNC_INTERVAL = 1000 * 60 * 5; // 5 minutes
  const TIME_SYNC_THRESHOLD = 2.5; // seconds
  const SYNC_RETRY_INTERVAL = 5000; // 5 seconds
  const CONTROLS_HIDE_DELAY = 2000;

  useEffect(() => {
    setType(user?.id === userId1 ? "host" : "watcher");
  }, [user, userId1]);

  // Enhanced sync function with retry mechanism
  const syncUrl = useCallback(
    async (newUrl: string) => {
      if (type !== "host") return;

      try {
        await axios.post<void>(SYNC_API_ENDPOINT, {
          chatId,
          timestamp: 0,
          url: newUrl,
          state: "paused",
        });
        setIsSynced(true);
        lastKnownState.current = {
          timestamp: 0,
          url: newUrl,
          state: "paused",
          chatId,
        };
      } catch (err) {
        setIsSynced(false);
        // Start retry mechanism
        const retrySync = async () => {
          try {
            await axios.post<void>(SYNC_API_ENDPOINT, {
              chatId,
              timestamp: 0,
              url: newUrl,
              state: "paused",
            });
            setIsSynced(true);
          } catch {
            setTimeout(retrySync, SYNC_RETRY_INTERVAL);
          }
        };
        setTimeout(retrySync, SYNC_RETRY_INTERVAL);
      }
    },
    [chatId, type]
  );

  // Direct URL update without debounce
  const updateUrl = useCallback(
    (newUrl: string) => {
      try {
        new URL(newUrl); // Basic URL validation
        setUrl(newUrl);
        void syncUrl(newUrl);
        setError(null);
      } catch {
        setError("Please enter a valid URL");
      }
    },
    [syncUrl]
  );

  const syncVideoState = useCallback(async () => {
    if (!sourceRef.current || !url || type !== "host") return;

    const now = Date.now();
    if (now - lastSyncTime.current < 1000) return;
    lastSyncTime.current = now;

    const currentState: SyncData = {
      timestamp:
        sourceRef.current.currentTime < 0 ? 0 : sourceRef.current.currentTime,
      url,
      chatId,
      state: sourceRef.current.paused ? "paused" : "playing",
    };

    // Only sync if state has changed
    if (
      JSON.stringify(currentState) === JSON.stringify(lastKnownState.current)
    ) {
      return;
    }

    try {
      await axios.post<void>(SYNC_API_ENDPOINT, currentState);
      setIsSynced(true);
      lastKnownState.current = currentState;
    } catch (err) {
      setIsSynced(false);
      // Start retry mechanism
      const retrySync = async () => {
        try {
          await axios.post<void>(SYNC_API_ENDPOINT, currentState);
          setIsSynced(true);
        } catch {
          setTimeout(retrySync, SYNC_RETRY_INTERVAL);
        }
      };
      setTimeout(retrySync, SYNC_RETRY_INTERVAL);
    }
  }, [chatId, url, type]);

  // Video source update effect with play state handling
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

    const handleCanPlay = () => {
      setError(null);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);

    return () => {
      videoElement.removeEventListener("waiting", handleWaiting);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
    };
  }, [url, type]);

  // Pusher subscription effect with enhanced sync logic
  useEffect(() => {
    const channel = pusherClient.subscribe(`sync-${chatId}`);

    const syncHandler = (data: SyncData) => {
      if (type !== "watcher" || !sourceRef.current) return;

      // Update last known state
      lastKnownState.current = data;

      if (data.url !== url) {
        setUrl(data.url);
        return;
      }

      const timeDifference = Math.abs(
        data.timestamp - sourceRef.current.currentTime
      );

      const syncActions = async () => {
        if (timeDifference > TIME_SYNC_THRESHOLD) {
          sourceRef.current!.currentTime = data.timestamp;
        }

        try {
          if (data.state === "paused" && !sourceRef.current!.paused) {
            await sourceRef.current!.pause();
          } else if (data.state === "playing" && sourceRef.current!.paused) {
            await sourceRef.current!.play();
          }
          setIsSynced(true);
        } catch (err) {
          console.error("Video state sync error:", err);
          setIsSynced(false);
        }
      };

      void syncActions();
    };

    channel.bind("sync", syncHandler);

    return () => {
      channel.unbind("sync", syncHandler);
      pusherClient.unsubscribe(`sync-${chatId}`);
    };
  }, [chatId, type, url]);

  // Periodic sync effect
  useEffect(() => {
    if (type !== "host") return;
    void syncVideoState();
    syncTimeoutRef.current = setInterval(syncVideoState, SYNC_INTERVAL);
    return () => clearInterval(syncTimeoutRef.current);
  }, [SYNC_INTERVAL, syncVideoState, type]);

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
    if (!sourceRef.current) return;

    try {
      if (sourceRef.current.paused) {
        await sourceRef.current.play();
        setIsPlaying(true);
      } else {
        await sourceRef.current.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Error toggling play state:", err);
    }
  }, []);

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
  }, []);

  return (
    <div
      ref={playerContainerRef}
      className={`flex flex-col items-center gap-2 w-full transition-all duration-300 ease-in-out ${
        isCustomFullscreen
          ? "fixed md:absolute inset-0 z-50 bg-black p-4"
          : "relative"
      }`}
      onMouseMove={() => {
        setShowControls(true);
        setIsHovering(true);
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Error and sync status notifications */}
      <div
        className={`flex flex-col gap-2 w-full md:w-2/3 ${
          isCustomFullscreen
            ? "absolute top-4 left-1/2 -translate-x-1/2 z-10"
            : ""
        }`}
      >
        {error && (
          <div className="p-2 bg-red-100 text-red-700 rounded-lg">{error}</div>
        )}

        {!isSynced && type === "watcher" && (
          <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
            Syncing with host...
          </div>
        )}
      </div>

      {/* URL input for host */}
      {type === "host" && showInterface && (
        <div
          className={`flex w-full items-center justify-center space-x-4 divide-x-2 rounded-lg bg-zinc-400 p-2 md:w-2/3`}
        >
          <span className="ml-2 text-sm font-bold text-white">URL: </span>
          <input
            type="text"
            autoComplete="off"
            placeholder="Paste a url to an mp4 file"
            className="h-full w-full border-none bg-transparent px-4 text-white placeholder:text-white focus:outline-none"
            onChange={(e) => updateUrl(e.target.value)}
            value={url}
          />
          {!isSynced && (
            <span className="pl-2 text-xs font-bold text-yellow-200">
              Reconnecting...
            </span>
          )}
        </div>
      )}

      {/* Video container */}
      <div
        className={`relative flex items-center justify-center rounded-xl ${
          isCustomFullscreen ? "w-full h-full" : "h-4/5 w-full bg-gray-500/5"
        }`}
      >
        <video
          ref={sourceRef}
          className={`${
            isCustomFullscreen
              ? "h-full w-full object-contain"
              : "h-full min-h-full w-auto min-w-full max-w-none border-2 border-black portrait:h-2/5 portrait:w-full landscape:h-full landscape:w-3/5"
          }`}
          playsInline
          autoPlay
          onPause={syncVideoState}
          onPlay={syncVideoState}
          onSeeking={syncVideoState}
          onError={() => setError("Failed to load video")}
        >
          <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Custom controls overlay */}
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
              onClick={togglePlay}
              className="text-white hover:text-white/80 transition-colors"
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
              onClick={() => toggleCustomFullscreen()}
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
      </div>
    </div>
  );
};

export default VideoPlayer;
