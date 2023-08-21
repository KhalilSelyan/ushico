import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import format from "date-fns/format";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPusherKey(key: string) {
  return key.replace(/:/g, "__");
}

export function hrefChatConstructor(id1: string, id2: string) {
  const sortedIds = [id1, id2].sort();
  return `${sortedIds[0]}--${sortedIds[1]}`;
}

export function distanceFromDate(date: Date | number) {
  const now = new Date();
  const dateToCompare = new Date(date);
  const diff = now.getTime() - dateToCompare.getTime();
  const diffInDays = diff / (1000 * 3600 * 24);
  if (diffInDays < 1) {
    return "today";
  } else if (diffInDays < 2) {
    return "yesterday";
  } else if (diffInDays < 7) {
    return `${Math.floor(diffInDays)} days ago`;
  } else {
    return format(dateToCompare, "dd/MM/yyyy");
  }
}

export function distanceFromDateInHours(date: Date | number) {
  const now = new Date();
  const dateToCompare = new Date(date);
  const diff = now.getTime() - dateToCompare.getTime();
  const diffInHours = diff / (1000 * 3600);
  if (diffInHours < 1) {
    return "less than an hour ago";
  }
  return `${Math.floor(diffInHours)} hours ago`;
}
