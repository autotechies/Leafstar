/* Times as the owner reads them: India time, with "Today" and "Yesterday", and how long a returning visitor was away. */

const TZ = "Asia/Kolkata";

/** "2026-11-09" for the India calendar day of this moment. */
export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

const dayNumber = (isoDate: string) => Math.floor(Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000);

/** Whole calendar days from `from` to `to` (India days). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(istDate(to)) - dayNumber(istDate(from));
}

/** "Today", "Yesterday", or "Sat, 8 Nov 2026". */
export function dayLabel(iso: string, now: string = new Date().toISOString()): string {
  const ago = daysBetween(iso, now);
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: TZ });
  const rest = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
  return `${weekday}, ${rest}`;
}

/** "3:42 pm" */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).replace(/\s?([AP])M$/i, (_m, c: string) => ` ${c.toLowerCase()}m`);
}

/** What to say where a visitor came back: "Came back the next day", "Came back after 3 days". */
export function cameBackLabel(previousIso: string, nextIso: string): string {
  const days = daysBetween(previousIso, nextIso);
  if (days <= 0) return "Came back later the same day";
  if (days === 1) return "Came back the next day";
  if (days < 14) return `Came back after ${days} days`;
  if (days < 60) return `Came back after ${Math.round(days / 7)} weeks`;
  return `Came back after ${Math.round(days / 30)} months`;
}
