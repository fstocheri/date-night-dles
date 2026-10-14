# 📺 Channel Surf

A daily TV-show guessing game. Each day you get a blurred still from one episode of a mystery show and six guesses to name the show. The still gets sharper and a new clue unlocks with every miss. Each wrong guess is also compared to the answer on premiere year, network, genres, and season count.

**Play:** https://ftocheri.github.io/channel-surf/

## How it works

The site is fully static (Vite + React + TypeScript on GitHub Pages). The browser never calls TMDB.

```
GitHub Action (daily 00:05 UTC, on push, or manual)
  └─ scripts/generate.mjs  ── TMDB API (key from repo secret)
       ├─ public/data/shows.json           catalog (~900 shows) for autocomplete + feedback, refreshed weekly
       ├─ public/data/puzzles/<date>.json  today's and tomorrow's puzzle (UTC); answer stored only as a hash
       └─ data/history.json                answer history, so a show doesn't repeat within a year
  └─ commits that data, builds, and deploys to Pages
```

Puzzles are only generated one day ahead, because anything in `public/` is publicly readable.

## Local development

```bash
npm install
cp .env.example .env      # then paste your TMDB key into .env
npm run generate          # writes the catalog + today's/tomorrow's puzzle
npm run dev               # http://localhost:5173/channel-surf/
```

Get a TMDB key at https://www.themoviedb.org/settings/api. Either the v3 API key or the v4 read access token works.

## Deployment setup (one time)

1. Add the key as a repo secret: `gh secret set TMDB_API_KEY`
2. Settings → Pages → Source: **GitHub Actions**
3. Run the workflow: `gh workflow run daily.yml`

## Attribution

Data and images are from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB's free API is for non-commercial use; adding ads or payments needs a commercial license.
