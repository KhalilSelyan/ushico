import { sendRoomAnnouncement } from "@/lib/websocket";

export function createAnnouncements(roomId: string) {
  return {
    userJoined: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'user_joined',
        userName,
        `${userName} joined the watch party 🎉`
      );
    },

    userLeft: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'user_left',
        userName,
        `${userName} left the watch party`
      );
    },

    videoChanged: (userName: string, videoTitle: string) => {
      sendRoomAnnouncement(
        roomId,
        'video_changed',
        userName,
        `${userName} changed the video to "${videoTitle}"`
      );
    },

    hostPaused: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_paused',
        userName,
        `${userName} paused the video ⏸️`
      );
    },

    hostResumed: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_resumed',
        userName,
        `${userName} resumed the video ▶️`
      );
    },

    hostTransferred: (oldHost: string, newHost: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_transferred',
        oldHost,
        `${oldHost} transferred host to ${newHost} 👑`
      );
    },

    hostStartedStreaming: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_started_streaming',
        userName,
        `${userName} started streaming 📺`
      );
    },

    hostStoppedStreaming: (userName: string) => {
      sendRoomAnnouncement(
        roomId,
        'host_stopped_streaming',
        userName,
        `${userName} stopped streaming`
      );
    }
  };
}