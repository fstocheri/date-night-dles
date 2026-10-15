# 🍿 Date Night Dles

A hand-picked collection of daily guessing games ("dles"), built to play together. The landing page shows tonight's lineup and which games you've already played today.

**Play:** https://fstocheri.github.io/date-night-dles/

## The games

| Game | Path | You guess… | Bonus round |
|---|---|---|---|
| 📺 **Channel Surf** | `/tv/` | the TV show, from one episode | which season the episode is from |
| 🎬 **Final Cut** | `/movies/` | the movie, from a single frame | its worldwide box-office bracket |
| 🎧 **Needle Drop** | `/songs/` | the song, from a clip that grows 1s → 16s | — |
| 🧠 **Date Night Dozen** | `/trivia/` | 12 multiple-choice trivia questions in 3 rounds (1/2/3 pts), 20s each, from [Open Trivia DB](https://opentdb.com/) | — |
| 🤘 **Mosh Pit** | `/rock/` | Needle Drop, but only emo, pop punk, alternative, and rock | — |
| 🎤 **Headliner** | `/artists/` | the artist, from a blurred photo and clues | their Deezer fan count bracket |

**Our other dles:** the landing page also has a section for links to outside games. Use **+ Add a dle** to add one (link, name, and the site's icon or an emoji); the ✎ button edits or deletes it. Links are saved in the browser, so each device keeps its own list.

All games share one engine:

- **Six guesses.** A blurred image sharpens (or the audio clip gets longer) with each miss, and a new text clue unlocks.
- **Guess feedback.** Each wrong guess is compared to the answer: 8 tiles per game (year, genres, cast overlap, and game-specific ones like network or director). Green = match, yellow = close/partial, arrows point toward the answer.
- **Weekday difficulty.** Answers come from the 1,000 most popular titles (TMDB votes, Deezer rank/fans). Monday draws from the top ~150; each day digs deeper, and Sunday (Expert) draws from ranks 700–1000.
- **Hard mode.** Text clues stay hidden. Locks in at your first guess; adds `*` to your share result.
- **Stats and streaks** per game, stored in the browser.

## How it works

The site is fully static (Vite + React + TypeScript, multi-page, on GitHub Pages). The browser never calls TMDB.

```
GitHub Action (daily 00:05 UTC, on push, or manual)
  └─ scripts/generate.mjs ── TMDB API (key from repo secret), Deezer + MusicBrainz (no key)
       for each game in scripts/games/:
       ├─ public/data/<game>/catalog.json          ~3,000 titles for autocomplete + feedback, refreshed weekly
       ├─ public/data/<game>/puzzles/<date>.json   today's + tomorrow's puzzle (UTC); answers stored as hashes
       └─ data/<game>-history.json                 past answers, so nothing repeats within a year
  └─ commits that data, builds, and deploys to Pages
```

Puzzles are only generated one day ahead, because anything in `public/` is publicly readable.

```
scripts/lib/common.mjs     TMDB client, redaction, difficulty, the daily loop
scripts/games/<id>.mjs     per-game catalog + puzzle builder
src/shared/                game engine, components, storage, styles
src/games/<id>/config.ts   per-game feedback tiles + bonus round
src/games/registry.ts      the collection shown on the landing page
src/landing/               landing page
```

### Adding a game

1. `scripts/games/<id>.mjs` exporting `id`, `buildCatalog()`, `buildPuzzle(date, entry)`; register it in `scripts/generate.mjs`.
2. `src/games/<id>/config.ts` + `main.tsx`, and `<id>/index.html`.
3. Add the page to `vite.config.ts` inputs and the game to `src/games/registry.ts`.

## Local development

```bash
npm install
cp .env.example .env      # then paste your TMDB key into .env
npm run generate          # all games (or: npm run generate -- movies)
npm run dev               # http://localhost:5173/date-night-dles/
```

Get a TMDB key at https://www.themoviedb.org/settings/api. Either the v3 API key or the v4 read access token works.

## Music data

- **Mosh Pit** uses its own catalog: rock/alt/emo editorial playlists plus a hand-picked list of ~90 scene bands' top tracks (`SONG_SOURCES.rock` in `scripts/lib/music.mjs`; add bands there). Non-rock genres and the last two years of playlist songs are dropped.
- **Songs** come from Deezer's editorial playlists (decades, genres, charts), ranked by Deezer popularity. Puzzles store only a Deezer track id: preview links expire, so the browser fetches a fresh 30-second preview via JSONP when you play.
- **Artist facts** (country, solo/group, active/ended, debut album year) come from MusicBrainz, which allows 1 request per second. Lookups are cached in `data/musicbrainz-cache.json` and committed, so only new artists are looked up on later runs.
- Using Deezer previews in a game is a licensing gray area. That's fine for a private project; revisit before making this public.

## Sync (Supabase)

Progress, stats, "other dles" links, and settings sync across devices through one shared account (☁ chip in the header). Browser storage stays the local cache, so everything still works offline or signed out.

- **Schema:** `supabase/migrations/`, applied with `npm run db:migrate` (needs `VITE_SUPABASE_URL` and `SUPABASE_ACCESS_TOKEN` in `.env`). Row-level security keeps each account's rows private.
- **Sign-ups are closed** (`npm run db:migrate -- --close-signups`). To add an account later, reopen them in the Supabase dashboard (Authentication → Sign In / Providers), sign up, and close them again.
- **Build config:** the public URL and publishable key live in the repo variables `SUPABASE_URL` and `SUPABASE_KEY`. Without them the site builds without sync.
- **Keep-alive:** free projects pause after 7 idle days, so the daily workflow pings the database.
- **Merging:** a day's guesses only grow, so when devices disagree the copy that's further along wins. Stats are computed from saved games.

## Attribution

Movie and TV data and images are from [TMDB](https://www.themoviedb.org/); music data, artwork, and previews from [Deezer](https://www.deezer.com/); artist facts from [MusicBrainz](https://musicbrainz.org/). This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB's free API is for non-commercial use; adding ads or payments needs a commercial license.
