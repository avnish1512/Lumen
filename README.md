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

## Deploy

This project is set up for Vercel-style deployment:

- Build command: `npm run build`
- Output directory: `dist`
- Runtime env var: `OMDB_API_KEY`
- API route: `api/omdb.ts`

Set `OMDB_API_KEY` in the deployment platform environment variables. Do not expose it as `VITE_OMDB_API_KEY`, because Vite client env vars are bundled into the frontend.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
