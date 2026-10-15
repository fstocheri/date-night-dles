// Your own links to outside dles, shown in their own section of the landing page.
// Saved in this browser only (there's no server), so each device keeps its own list.

export interface CustomLink {
  id: string;
  name: string;
  url: string;
  /** An emoji, or 'favicon' to use the site's own icon. */
  icon: string;
}

const KEY = 'dnd:links';

export function loadLinks(): CustomLink[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLinks(links: CustomLink[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(links));
  } catch {
    // Storage unavailable (private mode); links last for this visit only.
  }
}

/** Accepts "framed.wtf" or a full URL; returns a normalized http(s) URL or null. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www[.]/, '');
  } catch {
    return url;
  }
};

/** "www.framed.wtf" -> "Framed": a sensible default name for a new link. */
export function nameFromUrl(url: string): string {
  const first = hostOf(url).split('.')[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}

export const faviconUrl = (url: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=128`;

export const newId = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
