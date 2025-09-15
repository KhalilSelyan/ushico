interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string; userImage?: string }>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {/* User avatars */}
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map(user => (
          <div
            key={user.userId}
            className="relative w-6 h-6 rounded-full border-2 border-white bg-gray-300 overflow-hidden"
          >
            {user.userImage ? (
              <img
                src={user.userImage}
                alt={user.userName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-xs text-white font-medium">
                {user.userName?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
        ))}
        {typingUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-xs text-white font-medium">
            +{typingUsers.length - 3}
          </div>
        )}
      </div>

      {/* Typing text and animation */}
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500">
          {typingUsers.length === 1
            ? "is typing"
            : "are typing"}
        </span>
        <div className="flex gap-1">
          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    </div>
  );
}