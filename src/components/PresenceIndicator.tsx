import { PresenceState } from "@/hooks/useUserPresence";

interface PresenceIndicatorProps {
  state: PresenceState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PresenceIndicator({ state, size = 'sm', className = '' }: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const stateClasses = {
    active: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400'
  };

  return (
    <div
      className={`${sizeClasses[size]} ${stateClasses[state]} rounded-full ${className}`}
      title={state === 'active' ? 'Active' : state === 'away' ? 'Away' : 'Offline'}
    />
  );
}

interface PresenceBadgeProps {
  state: PresenceState;
  userName: string;
  userImage?: string;
  showText?: boolean;
}

export function PresenceBadge({ state, userName, userImage, showText = false }: PresenceBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {userImage ? (
          <img
            src={userImage}
            alt={userName}
            className="w-8 h-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white font-medium">
            {userName?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <PresenceIndicator
          state={state}
          size="md"
          className="absolute -bottom-0.5 -right-0.5 border-2 border-white"
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{userName}</span>
          <span className="text-xs text-gray-500 capitalize">{state}</span>
        </div>
      )}
    </div>
  );
}