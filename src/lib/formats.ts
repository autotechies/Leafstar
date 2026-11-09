/*
  Normalising and checking the small formats used across the app (AGENTS.md §6).
  Pure functions with no imports, so the same rules run in the browser, on the server and in tests.
*/

/**
 * Phone numbers are stored as digits only, with the country code.
 * A 10-digit Indian number gets "91"; a leading trunk "0" is replaced by "91".
 * Returns null when what is left cannot be a phone number (fewer than 11 or more than 13 digits).
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`;
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 13 ? digits : null;
}

/** "919876543210" → "+91 98765 43210" for display; anything else is shown with a plus sign only. */
export function formatPhone(digits: string): string {
  if (/^91\d{10}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-11" (or an ISO timestamp) → "11 Nov 2026" (DESIGN.md §6). Anything else is returned unchanged. */
export function formatDay(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : value;
}

/** Indian GSTIN: 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character. */
export function normalizeGstin(input: string): string | null {
  const value = input.replace(/\s/g, "").toUpperCase();
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value) ? value : null;
}

/**
 * Instagram handle without "@", from "@name", "name" or a profile link.
 * Instagram allows letters, digits, "." and "_", up to 30 characters.
 */
export function normalizeInstagram(input: string): string | null {
  let value = input.trim();
  const fromUrl = value.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(value) ? value.toLowerCase() : null;
}

/**
 * Facebook page name or number (what comes after facebook.com/), from a profile link, "profile.php?id=…" link or the bare value.
 * Letters, digits, "." and "-" only, 5 to 60 characters.
 */
export function normalizeFacebook(input: string): string | null {
  let value = input.trim();
  const byId = value.match(/facebook\.com\/profile\.php\?(?:[^#\s]*&)?id=(\d+)/i);
  if (byId) value = byId[1];
  else {
    const fromUrl = value.match(/facebook\.com\/([^/?#\s]+)/i);
    if (fromUrl) value = fromUrl[1];
  }
  value = value.replace(/^@/, "");
  return /^[A-Za-z0-9.-]{5,60}$/.test(value) ? value : null;
}

/**
 * Where to send someone after login: only a path inside the admin, never another site
 * ("//evil.example" and "https://…" are refused), so a crafted link cannot misuse our login page.
 */
export function safeAdminPath(next: string | null | undefined, fallback = "/admin"): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/^\/admin\/(login|forgot-password)(\/|$|\?)/.test(next)) return fallback;
  return next;
}
