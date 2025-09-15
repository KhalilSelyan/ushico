interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map(u => u.userName);
  const text = names.length === 1
    ? `${names[0]} is typing...`
    : names.length === 2
    ? `${names[0]} and ${names[1]} are typing...`
    : `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;

  return (
    <div className="text-sm text-gray-500 italic px-3 py-1">
      {text}
      <span className="ml-1 animate-pulse">●●●</span>
    </div>
  );
}