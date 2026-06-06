# Movie Info App

Apple TV-inspired movie information app powered by OMDb.

## Features

- Real OMDb search and movie detail data
- Server-side `/api/omdb` proxy so the OMDb key is not shipped in the browser bundle
- Curated home screen, movie detail view, watch/info view, Discover search, and saved Library
- Saved movies persisted in `localStorage`
- Mobile-first UI ready for deployment

## Local Setup

Create `.env.local`:

```bash
OMDB_API_KEY=your_omdb_api_key
TMDB_API_KEY=your_tmdb_api_key
TMDB_API_READ_ACCESS_TOKEN=your_tmdb_api_read_access_token
```

Install and run:

```bash
npm install
npm run dev
```

Open:

```bash
http://127.0.0.1:5173/
```

## Deploy to Vercel

This project is ready for Vercel deployment. The included `vercel.json`
configures Vite, the static output folder, API functions, and SPA fallback
rewrites.

Use these Vercel project settings:

```bash
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Add these Environment Variables in Vercel:

```bash
OMDB_API_KEY=your_omdb_api_key
TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
```

`TMDB_API_KEY` can also be used, but the read access token is preferred. Do
not expose these as `VITE_*` variables because Vite client env vars are bundled
into the frontend.

Serverless API routes:

```bash
/api/omdb
/api/tmdb
```

After deploying, quick smoke checks:

```bash
https://your-project.vercel.app/api/omdb?id=tt1375666
https://your-project.vercel.app/api/tmdb?imdbId=tt1375666
```

The app itself uses hash routes, and `vercel.json` also includes a fallback to
`index.html` for direct page refreshes.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
