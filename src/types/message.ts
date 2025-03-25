import { Message as DbMessage } from "@/db/schema";

export interface FormattedMessage extends Omit<DbMessage, "timestamp"> {
  timestamp: number;
}

export function formatMessage(message: DbMessage): FormattedMessage {
  return {
    ...message,
    timestamp:
      message.timestamp instanceof Date
        ? message.timestamp.getTime()
        : message.timestamp,
  };
}
