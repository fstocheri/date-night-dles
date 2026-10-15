// Optional Supabase sync. With VITE_SUPABASE_URL and VITE_SUPABASE_KEY set at build time and
// someone signed in, local changes are written through to the database and each page load
// pulls the latest. Without them (or signed out) the site runs on browser storage alone.

import { createClient, type Session } from '@supabase/supabase-js';
import {
  allGames,
  isAhead,
  read,
  readGame,
  readHardPref,
  readLinks,
  write,
  writeGame,
  writeHardPref,
  writeLinks,
  type CustomLink,
  type GameRecord,
} from './local';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined; // publishable (anon) key: safe in the browser

export const cloudEnabled = Boolean(url && key);
const supabase = cloudEnabled ? createClient(url!, key!) : null;

export type SyncState = 'off' | 'syncing' | 'synced' | 'error';

let session: Session | null = null;
let syncState: SyncState = 'off';
const listeners = new Set<() => void>();

export const getUser = () => session?.user ?? null;
export const getSyncState = () => syncState;
export function onCloudChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function setSyncState(state: SyncState) {
  syncState = state;
  listeners.forEach((fn) => fn());
}

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

/** Restores the session and pulls the latest data. Call before first render; never throws. */
export async function initCloud() {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    supabase.auth.onAuthStateChange((_event, next) => {
      session = next;
      if (!next) setSyncState('off');
    });
    // Don't hold the page hostage to a slow network: render from local data after 3s.
    if (session) await withTimeout(pull(), 3000);
  } catch {
    setSyncState('error');
  }
}

// ---------- auth ----------

export async function signIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Returns true if the account needs its email confirmed before signing in. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) throw error;
  return !data.session;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

// ---------- pull: database -> this device ----------

interface GameRow {
  game_id: string;
  date: string;
  guesses: GameRecord['guesses'];
  hard: boolean;
  bonus_guesses: number[];
  outcome: 'won' | 'lost' | null;
}

const toRecord = (r: GameRow): GameRecord => ({
  guesses: r.guesses,
  hard: r.hard,
  bonusGuesses: r.bonus_guesses,
  ...(r.outcome ? { outcome: r.outcome } : {}),
});

const toRow = (userId: string, gameId: string, date: string, g: GameRecord) => ({
  user_id: userId,
  game_id: gameId,
  date,
  guesses: g.guesses,
  hard: g.hard,
  bonus_guesses: g.bonusGuesses,
  outcome: g.outcome ?? null,
  updated_at: new Date().toISOString(),
});

/** Merges the database with this device: whichever copy of each game is further along wins. */
export async function pull() {
  if (!supabase || !session) return;
  const userId = session.user.id;
  setSyncState('syncing');
  try {
    const [games, links, settings] = await Promise.all([
      supabase.from('game_records').select('game_id, date, guesses, hard, bonus_guesses, outcome'),
      supabase.from('links').select('id, name, url, icon').order('position'),
      supabase.from('settings').select('hard').maybeSingle(),
    ]);
    if (games.error) throw games.error;
    if (links.error) throw links.error;
    if (settings.error) throw settings.error;

    // Games
    const remoteKeys = new Set<string>();
    const toPush = [];
    for (const row of games.data as GameRow[]) {
      remoteKeys.add(`${row.game_id}:${row.date}`);
      const remote = toRecord(row);
      const local = readGame(row.game_id, row.date);
      if (!local || isAhead(remote, local)) writeGame(row.game_id, row.date, remote);
      else if (isAhead(local, remote)) toPush.push(toRow(userId, row.game_id, row.date, local));
    }
    for (const { gameId, date, record } of allGames()) {
      if (!remoteKeys.has(`${gameId}:${date}`)) toPush.push(toRow(userId, gameId, date, record));
    }
    if (toPush.length) {
      const { error } = await supabase.from('game_records').upsert(toPush);
      if (error) throw error;
    }

    // Links: the first time this device syncs with this account, keep links from both;
    // after that the database is the source of truth.
    const syncedKey = 'dnd:links-synced-for';
    const remoteLinks = links.data as CustomLink[];
    if (read<string | null>(syncedKey, null) !== userId) {
      const merged = [...remoteLinks, ...readLinks().filter((l) => !remoteLinks.some((r) => r.id === l.id))];
      writeLinks(merged);
      if (merged.length !== remoteLinks.length) await pushLinks(merged);
      write(syncedKey, userId);
    } else {
      writeLinks(remoteLinks);
    }

    // Settings
    if (settings.data) writeHardPref(settings.data.hard);
    else await pushSettings(readHardPref());

    setSyncState('synced');
  } catch (err) {
    console.warn('Sync failed', err);
    setSyncState('error');
  }
}

// ---------- push: this device -> database ----------
// Fire-and-forget: if a write fails, the next pull reconciles (local copies that are
// further along get pushed then).

async function attempt(write: () => PromiseLike<{ error: unknown }>) {
  if (!supabase || !session) return;
  setSyncState('syncing');
  const { error } = await write();
  setSyncState(error ? 'error' : 'synced');
  if (error) console.warn('Sync failed', error);
}

export function pushGame(gameId: string, date: string, record: GameRecord) {
  if (!supabase || !session) return;
  const row = toRow(session.user.id, gameId, date, record);
  void attempt(() => supabase.from('game_records').upsert(row));
}

export async function pushLinks(links: CustomLink[]) {
  if (!supabase || !session) return;
  const userId = session.user.id;
  await attempt(async () => {
    const rows = links.map((l, position) => ({ ...l, user_id: userId, position }));
    if (rows.length) {
      const { error } = await supabase.from('links').upsert(rows);
      if (error) return { error };
    }
    const removed = supabase.from('links').delete().eq('user_id', userId);
    return links.length ? removed.not('id', 'in', `(${links.map((l) => l.id).join(',')})`) : removed;
  });
}

export function pushSettings(hard: boolean) {
  if (!supabase || !session) return Promise.resolve();
  const row = { user_id: session.user.id, hard, updated_at: new Date().toISOString() };
  return attempt(() => supabase.from('settings').upsert(row));
}
