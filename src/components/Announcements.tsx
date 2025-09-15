interface AnnouncementProps {
  announcements: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export function Announcements({ announcements }: AnnouncementProps) {
  return (
    <div className="space-y-2">
      {announcements.map(announcement => (
        <div
          key={announcement.id}
          className="text-center text-sm text-gray-600 bg-gray-100 rounded-lg py-1 px-3 animate-in slide-in-from-top duration-300"
        >
          {announcement.message}
        </div>
      ))}
    </div>
  );
}