
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRelativeDate(offsetHours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  
  // Format: "Oct 28, 19:30"
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function isMatchOutdated(matchDateStr: string): boolean {
    // This is a simple parser for the mock format "Oct 28, 19:30"
    // In a real app, use ISO strings!
    const currentYear = new Date().getFullYear();
    const [monthDay, time] = matchDateStr.split(", ");
    const dateStr = time ? `${monthDay}, ${currentYear} ${time}` : `${matchDateStr}, ${currentYear}`;
    const matchDate = new Date(dateStr);
    
    // If match date is invalid (e.g. "Live 35'"), it's not outdated
    if (isNaN(matchDate.getTime())) return false;

    const now = new Date();
    // Allow 2 hours duration
    const matchEndTime = new Date(matchDate.getTime() + 2 * 60 * 60 * 1000);
    
    return now > matchEndTime;
}
