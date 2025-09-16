import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import format from "date-fns/format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPusherKey(key: string) {
  return key.replace(/:/g, "__");
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

