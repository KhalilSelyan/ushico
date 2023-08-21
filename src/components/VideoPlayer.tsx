"use client";
import { pusherClient } from "@/lib/pusher";
import axios from "axios";
import { User } from "next-auth";
import { useCallback, useEffect, useRef, useState } from "react";

// components/VideoPlayer.tsx
const VideoPlayer = ({
  chatId,
  user,
  userId1,
}: {
  chatId: string;
  user: User;
  userId1: string;
}) => {
  const [type, setType] = useState<"host" | "watcher">("watcher");
  const [url, setUrl] = useState("");

  // whoever has the id1 is the host
  useEffect(() => {
    if (user!.id === userId1) {
      setType("host");
    } else {
      setType("watcher");
    }
  }, [user, userId1]);

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  // create a debounced function to update the url
  const updateUrl = debounce((url: string) => {
    setUrl(url);
  }, 500);

  useEffect(() => {
    const oldUrl = sourceRef.current?.src;

    if (url !== oldUrl && sourceRef.current && url) {
      sourceRef.current.src = url;
      sourceRef.current.load();
    }
  }, [type, url]);

  const syncFunction = useCallback(async () => {
    if (sourceRef.current && url && sourceRef.current.currentTime > 0) {
      const currentTime = sourceRef.current.currentTime;
      await axios.post("/api/watchSync", {
        chatId: chatId,
        timestamp: currentTime,
        url: url,
        state: sourceRef.current.paused ? "paused" : "playing",
      });
    }
  }, [chatId, url]);

  useEffect(() => {
    console.log(url);
    console.log(sourceRef.current?.src);
  }, [url]);

  useEffect(() => {
    pusherClient.subscribe(`sync-${chatId}`);
    const syncHandler = (data: {
      timestamp: number;
      url: string;
      state: string;
    }) => {
      console.log(data);
      if (sourceRef.current && type === "watcher") {
        if (sourceRef.current.currentTime !== data.timestamp) {
          const difference = Math.abs(
            data.timestamp - sourceRef.current.currentTime
          );
          if (difference > 2.5) {
            // Only update if difference is more than 2 seconds
            if (data.url !== url) {
              setUrl(data.url);
            }
            sourceRef.current.currentTime = data.timestamp;
          }
        }
        if (data.state === "paused" && !sourceRef.current.paused) {
          sourceRef.current.pause();
        } else if (data.state === "playing" && sourceRef.current.paused) {
          sourceRef.current.play();
        }
      }
    };

    pusherClient.bind("sync", syncHandler);

    return () => {
      pusherClient.unsubscribe(`sync-${chatId}`);
      pusherClient.unbind("sync", syncHandler);
    };
  }, [chatId, setUrl, type, url]);

  useEffect(() => {
    const interval = setInterval(async () => {
      await syncFunction();
    }, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, [syncFunction]);

  const sourceRef = useRef<HTMLVideoElement>(null);

  return (
    <>
      {type === "host" ? (
        <div className="flex w-full  items-center justify-center space-x-4 divide-x-2 rounded-lg bg-zinc-400 p-2 md:w-2/3">
          <span className="ml-2 text-sm font-bold text-white">Url: </span>
          <input
            type="text"
            autoComplete="off"
            placeholder="Paste a url to an mp4 file"
            className="h-full w-full border-none bg-transparent px-4 text-white placeholder:text-white focus:outline-none "
            onChange={(e) => {
              updateUrl(e.target.value);
            }}
          />
          <span className="pl-2 text-xs font-bold text-white">
            {" "}
            Clicking on the room id will copy it to your clipboard
          </span>
        </div>
      ) : null}
      <div className="relative flex h-4/5 w-full items-center justify-center rounded-xl bg-gray-500/5 p-2">
        <video
          ref={sourceRef}
          className="h-full min-h-full w-auto min-w-full max-w-none  border-2 border-black portrait:h-2/5 portrait:w-full landscape:h-full landscape:w-3/5"
          controls
          autoPlay
          onPause={async () => {
            if (type === "host") {
              await syncFunction();
            }
          }}
          onPlay={async () => {
            if (type === "host") {
              await syncFunction();
            }
          }}
          onSeeking={async () => {
            if (type === "host") {
              await syncFunction();
            }
          }}
        >
          <source src={url} />
        </video>
      </div>
    </>
  );
};

export default VideoPlayer;
