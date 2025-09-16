"use client";

import { useEffect } from "react";

const LAST_CLEANUP_KEY = "lastEphemeralCleanup";

export function useDailyCleanup() {
  useEffect(() => {
    const performDailyCleanup = async () => {
      const today = new Date().toDateString();
      const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY);

      // Only run cleanup once per day
      if (lastCleanup === today) {
        return;
      }

      try {
        const response = await fetch("/api/rooms/cleanup", {
          method: "POST",
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Cleaned up ${data.cleanedRooms} ephemeral rooms`);
          localStorage.setItem(LAST_CLEANUP_KEY, today);
        }
      } catch (error) {
        console.error("Failed to cleanup ephemeral rooms:", error);
      }
    };

    // Run cleanup after a short delay to avoid blocking initial render
    const timer = setTimeout(performDailyCleanup, 2000);

    return () => clearTimeout(timer);
  }, []);
}