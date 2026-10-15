// Your own links to outside dles, shown in their own section of the landing page.
// Cached in the browser and synced to the database when signed in.

import { pushLinks } from '../shared/cloud';
import { readLinks, writeLinks, type CustomLink } from '../shared/local';

export type { CustomLink } from '../shared/local';

export const loadLinks = readLinks;

export function saveLinks(links: CustomLink[]) {
  writeLinks(links);
  void pushLinks(links);
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
