"use client";
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
import { wsService } from "@/lib/websocket";

/* Interfaces and Types */

interface WebRTCPlayerProps {
  chatId: string;
  user: User;
  userId1: string;
}

interface SyncData {
  timestamp: number;
  chatId: string;
  state: "playing" | "paused";
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
  updateUrl: (newUrl: File | null) => void;
  isSynced: boolean;
  showInterface: boolean;
}

const URLInput: React.FC<URLInputProps> = ({
  url,
  updateUrl,
  isSynced,
  showInterface,
}) => {
  return (
    <>
      {showInterface && (
        <div
          className={`flex w-full items-center justify-center space-x-4 divide-x-2 rounded-lg bg-zinc-400 p-2 md:w-2/3`}
        >
          <span className="ml-2 text-sm font-bold text-white">
            Select Video File:
          </span>
          <input
            type="file"
            accept="video/*"
            className="h-full w-full border-none bg-transparent px-4 text-white placeholder:text-white focus:outline-none"
            onChange={(e) => updateUrl(e.target.files?.[0] || null)}
          />
          {!isSynced && (
            <span className="pl-2 text-xs font-bold text-yellow-200">
              Reconnecting...
            </span>
          )}
        </div>
      )}
    </>
  );
};

interface VideoElementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  url: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  syncVideoState: () => Promise<void>;
  isCustomFullscreen: boolean;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  type: "host" | "watcher";
}

const VideoElement: React.FC<VideoElementProps> = ({
  videoRef,
  url,
  setError,
  syncVideoState,
  isCustomFullscreen,
  setCurrentTime,
  setDuration,
  setIsPlaying,
  type,
}) => {
  useEffect(() => {
    if (!videoRef.current || !url) return;

    const videoElement = videoRef.current;
    // Only set src for host, watcher gets stream via WebRTC
    if (type === "host" && url) {
      videoElement.src = url;
    }
    // Reset video state when URL changes
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);

    const handleWaiting = () => {
      if (type === "watcher") {
        setError("Buffering... Please wait");
      }
    };

    const handleSeeking = () => {
      if (type === "watcher") {
        setError("Syncing...");
      }
    };

    const handleSeeked = () => {
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

      // Cleanup
      if (type === "host") {
        videoElement.src = "";
        videoElement.load();
      } else {
        // For watcher, clean up the media stream
        const stream = videoElement.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        videoElement.srcObject = null;
      }
    };
  }, [
    url,
    videoRef,
    setError,
    setIsPlaying,
    type,
    syncVideoState,
    setCurrentTime,
    setDuration,
  ]);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (type === "host") {
        void syncVideoState();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
    };
  }, [
    videoRef,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    type,
    syncVideoState,
  ]);

  return (
    <video
      ref={videoRef}
      className={`${
        isCustomFullscreen
          ? "h-full w-full object-contain"
          : "h-full min-h-full w-auto min-w-full max-w-none border-2 border-black portrait:h-2/5 portrait:w-full landscape:h-full landscape:w-3/5"
      }`}
      preload="auto"
      playsInline
      //   autoPlay
      onPause={syncVideoState}
      onPlay={syncVideoState}
      onSeeking={syncVideoState}
      onError={() => setError("Failed to load video")}
    >
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

/* Main WebRTCPlayer Component */

const WebRTCPlayer = ({ chatId, user, userId1 }: WebRTCPlayerProps) => {
  // State variables and refs
  const [type, setType] = useState<"host" | "watcher">("watcher");
  const [url, setUrl] = useState<string | null>(null);
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
  const [connectionState, setConnectionState] = useState("new");

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const lastSyncTime = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastKnownState = useRef<SyncData | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const progressRef = useRef<HTMLDivElement>(null);
  const blobUrl = useRef<string | null>(null);

  // Constants
  const SYNC_INTERVAL = 1000 * 60 * 5; // 5 minutes
  const TIME_SYNC_THRESHOLD = 2.5; // seconds
  const SYNC_RETRY_INTERVAL = 5000; // 5 seconds
  const CONTROLS_HIDE_DELAY = 2000;

  // Handle reconnection
  const handleReconnect = useCallback(async () => {
    if (type === "host" && peerConnection.current && localStream.current) {
      try {
        // Clear existing tracks
        const senders = peerConnection.current.getSenders();
        senders.forEach((sender) =>
          peerConnection.current?.removeTrack(sender)
        );

        // Re-add tracks
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, localStream.current!);
        });

        // Create new offer
        const offer = await peerConnection.current.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true,
        });

        await peerConnection.current.setLocalDescription(offer);
        wsService.send(`${chatId}`, "sync-offer", { sdp: offer });

        console.log("Reconnection attempt completed");
      } catch (err) {
        console.error("Reconnection failed:", err);
        setError("Connection failed. Please try refreshing the page.");
      }
    }
  }, [chatId, type]);

  useEffect(() => {
    setType(user.id === userId1 ? "host" : "watcher");
    wsService.setUserId(user.id);
  }, [user, userId1]);

  // Initialize WebRTC peer connection
  useEffect(() => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    };

    peerConnection.current = new RTCPeerConnection(configuration);

    // Connection state changes
    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState || "new";
      setConnectionState(state);
      console.log("Connection state changed:", state);

      if (state === "failed" || state === "disconnected") {
        console.error(
          "Connection failed or disconnected, attempting reconnect..."
        );
        handleReconnect();
      }
    };

    // ICE connection state changes
    peerConnection.current.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        peerConnection.current?.iceConnectionState
      );
    };

    // Signaling state changes
    peerConnection.current.onsignalingstatechange = () => {
      console.log("Signaling state:", peerConnection.current?.signalingState);
    };

    // ICE gathering state changes
    peerConnection.current.onicegatheringstatechange = () => {
      console.log(
        "ICE gathering state:",
        peerConnection.current?.iceGatheringState
      );
    };

    // ICE candidate errors
    peerConnection.current.onicecandidateerror = (
      event: RTCPeerConnectionIceErrorEvent
    ) => {
      console.error("ICE candidate error:", event);
    };

    // Host and client handle ICE candidates
    peerConnection.current.onicecandidate = (event) => {
      console.log({ event });
      if (event.candidate) {
        wsService.send(`${chatId}`, "sync-ice-candidate", {
          candidate: event.candidate,
        });
      }
    };

    // Client receives the video stream from the host
    if (type === "watcher") {
      peerConnection.current.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        const [remoteStream] = event.streams;
        if (videoRef.current && remoteStream) {
          console.log("Setting remote stream to video element");
          videoRef.current.srcObject = remoteStream;

          console.log({ remoteStream });
          // Attempt to play the video
          videoRef.current.play().catch((err) => {
            console.error("Error playing remote stream:", err);
            setError("Failed to play remote stream");
          });
        }
      };
    }
    return () => {
      // Clean up
      if (blobUrl.current) {
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = null;
      }

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }

      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [chatId, handleReconnect, type]);

  /* --- WebSocket Signaling Logic --- */
  useEffect(() => {
    // Handlers for WebSocket signaling
    const handleOffer = async (data: any) => {
      console.log("Received offer");
      if (type === "watcher" && peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
          console.log("Set remote description from offer");

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          console.log("Created and set local answer");

          wsService.send(`${chatId}`, "sync-answer", { sdp: answer });
          console.log("Sent answer");
        } catch (err) {
          console.error("Error handling offer:", err);
          setError("Failed to establish connection");
        }
      }
    };

    const handleAnswer = async (data: any) => {
      console.log("Received answer");
      if (type === "host" && peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
          console.log("Set remote description from answer");
        } catch (err) {
          console.error("Error handling answer:", err);
          setError("Failed to establish connection");
        }
      }
    };

    const handleIceCandidate = async (data: any) => {
      console.log(`Received ICE candidate `);
      console.log({ data });
      try {
        const candidate = new RTCIceCandidate(data.candidate);
        console.log({ candidate });
        await peerConnection.current?.addIceCandidate(candidate);
        console.log("Added ICE candidate");
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };
    // Subscribe to WebSocket events for signaling

    const unsubscribeOffer = wsService.subscribe(
      chatId,
      "sync-offer",
      handleOffer
    );
    const unsubscribeAnswer = wsService.subscribe(
      chatId,
      "sync-answer",
      handleAnswer
    );
    const unsubscribeIceCandidate = wsService.subscribe(
      chatId,
      "sync-ice-candidate",
      handleIceCandidate
    );

    return () => {
      unsubscribeOffer();
      unsubscribeAnswer();
      unsubscribeIceCandidate();
    };
  }, [chatId, type]);

  // Sync video state to server
  const syncVideoState = useCallback(async () => {
    if (!videoRef.current || type !== "host") return;

    const now = Date.now();
    if (now - lastSyncTime.current < 500) return; // Throttle syncs to every 500ms
    lastSyncTime.current = now;

    const currentState: SyncData = {
      timestamp:
        videoRef.current.currentTime < 0 ? 0 : videoRef.current.currentTime,

      chatId,
      state: videoRef.current.paused ? "paused" : "playing",
    };

    // Only sync if state has changed
    if (
      JSON.stringify(currentState) === JSON.stringify(lastKnownState.current)
    ) {
      return;
    }

    try {
      wsService.send(`sync-${chatId}`, "sync", currentState);
      setIsSynced(true);
      lastKnownState.current = currentState;
    } catch (err) {
      console.error("Error syncing video state:", err);
      setIsSynced(false);
    }
  }, [chatId, type]);

  /* --- Host: Stream Setup and Offer Creation --- */
  const updateUrl = useCallback(
    async (file: File | null) => {
      if (!file || type !== "host") return;

      try {
        // Clean up previous blob URL
        if (blobUrl.current) {
          URL.revokeObjectURL(blobUrl.current);
        }

        // Create new blob URL
        blobUrl.current = URL.createObjectURL(file);
        setUrl(blobUrl.current);

        if (type === "host" && peerConnection.current) {
          console.log("Starting host stream setup");

          try {
            // Remove existing tracks
            const senders = peerConnection.current.getSenders();
            senders.forEach((sender) =>
              peerConnection.current?.removeTrack(sender)
            );
            console.log("Removed existing tracks");

            localStream.current = await fileToMediaStream(file);
            console.log("Created media stream from file");

            localStream.current.getTracks().forEach((track) => {
              console.log("Adding track:", track.kind);
              peerConnection.current?.addTrack(track, localStream.current!);
            });

            const offer = await peerConnection.current.createOffer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true,
            });

            await peerConnection.current.setLocalDescription(offer);
            console.log("Created and set local offer");

            wsService.send(`${chatId}`, "sync-offer", { sdp: offer });
            console.log("Sent offer");

            await syncVideoState();
          } catch (err) {
            setError("Failed to initialize video stream");
            console.error("Error setting up host stream:", err);
          }
        }
      } catch (err) {
        setError("Invalid video format or file is corrupted");
        console.error("Error processing video file:", err);
      }
    },
    [chatId, type, syncVideoState]
  );

  // Modified fileToMediaStream function with better error handling
  const fileToMediaStream = async (file: File): Promise<MediaStream> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const blobUrl = URL.createObjectURL(file);
      video.src = blobUrl;
      video.muted = true;

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(blobUrl); // Clean up blob URL after metadata loads

        if ("captureStream" in video) {
          try {
            // @ts-expect-error -- captureStream may not be in types
            const stream = video.captureStream();
            resolve(stream);
          } catch (err) {
            reject(new Error("Failed to capture stream from video"));
          }
        } else {
          // Canvas fallback
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Failed to get canvas context");
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const drawFrame = () => {
              if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(drawFrame);
              }
            };

            video
              .play()
              .then(() => {
                const stream = canvas.captureStream();
                drawFrame();
                resolve(stream);
              })
              .catch((err) =>
                reject(new Error(`Failed to play video: ${err}`))
              );
          } catch (err) {
            reject(new Error(`Canvas fallback failed: ${err}`));
          }
        }
      };

      video.onerror = () => reject(new Error("Failed to load video"));
    });
  };

  // Subscribe to sync messages
  useEffect(() => {
    if (!chatId) return;

    const channel = `sync-${chatId}`;
    const unsubscribe = wsService.subscribe(channel, "sync", (data) => {
      if (type !== "watcher" || !videoRef.current) return;

      // Update last known state
      lastKnownState.current = data as SyncData;
      const syncData = data as SyncData;

      const timeDifference = Math.abs(
        syncData.timestamp - videoRef.current.currentTime
      );

      const syncActions = async () => {
        if (timeDifference > TIME_SYNC_THRESHOLD) {
          videoRef.current!.currentTime = syncData.timestamp;
        }

        try {
          if (syncData.state === "paused" && !videoRef.current!.paused) {
            await videoRef.current!.pause();
          } else if (syncData.state === "playing" && videoRef.current!.paused) {
            await videoRef.current!.play();
          }
          setIsSynced(true);
        } catch (err) {
          console.error("Video state sync error:", err);
          setIsSynced(false);
        }
      };

      void syncActions();
    });

    return () => {
      unsubscribe();
    };
  }, [chatId, type, url]);

  // Periodic sync effect
  useEffect(() => {
    if (type !== "host") return;
    void syncVideoState();
    syncTimeoutRef.current = setInterval(syncVideoState, SYNC_INTERVAL);
    return () => {
      if (syncTimeoutRef.current) clearInterval(syncTimeoutRef.current);
    };
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
    if (!videoRef.current) return;

    const handleFullscreenChange = (event: Event) => {
      event.preventDefault();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        setIsCustomFullscreen(true);
        setShowInterface(false);
      }
    };

    videoRef.current.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      videoRef.current?.removeEventListener(
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
    if (!videoRef.current) return;

    try {
      if (videoRef.current.paused) {
        await videoRef.current.play();
        setIsPlaying(true);
      } else {
        await videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Error toggling play state:", err);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!videoRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clampedVolume;
    setVolume(clampedVolume);
  }, []);

  const handleSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!videoRef.current || !progressRef.current) return;

      const rect = progressRef.current.getBoundingClientRect();
      const pos = (event.clientX - rect.left) / rect.width;
      const newTime = pos * duration;

      videoRef.current.currentTime = newTime;
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

  // Add cleanup in the main component's useEffect:
  useEffect(() => {
    return () => {
      // Cleanup object URL when component unmounts
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

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
      {type === "watcher" && connectionState !== "connected" && (
        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
          Connection Status: {connectionState}
        </div>
      )}

      {/* Error and sync status notifications */}
      <ErrorAndSyncNotifications
        error={error}
        isSynced={isSynced}
        type={type}
        isCustomFullscreen={isCustomFullscreen}
      />

      {/* URL input for host */}
      {type === "host" && (
        <URLInput
          url={url || ""}
          updateUrl={updateUrl}
          isSynced={isSynced}
          showInterface={showInterface}
        />
      )}

      {/* Video container */}
      <div
        className={`relative flex items-center justify-center rounded-xl ${
          isCustomFullscreen ? "w-full h-full" : "h-4/5 w-full bg-gray-500/5"
        }`}
        onPointerDown={async () => await togglePlay()}
      >
        {/* Video Element */}
        <VideoElement
          videoRef={videoRef}
          url={type === "host" ? url : null}
          setError={setError}
          syncVideoState={syncVideoState}
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
        />
      </div>
    </div>
  );
};

export default WebRTCPlayer;
