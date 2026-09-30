# Lumen Project Memory & Architecture Guide

This document serves as the persistent memory for AI agents working on **Lumen**. Read this to immediately understand the architecture, file layout, patterns, and conventions without performing exhaustive codebase analyses.

---

## 1. Project Overview & Tech Stack
- **Application**: Lumen — Apple TV / Netflix style streaming web application with Movies, TV Series, Anime (AniList/Anikoto), Manga (MangaDex), Live TV / Sports, and Lord (protected adult section).
- **Core Stack**: React 18, TypeScript, Vite, Vanilla CSS (`src/App.css`).
- **Backend / Serverless**: Vercel Serverless Functions (`api/hub.ts`, `api/_lib/`), routed via `vercel.json`.
- **Database / Auth**: Supabase REST config for profiles, watch history, accounts, devices, and Lord PIN.
- **Testing**: Vitest (`vitest run`).
  - **IMPORTANT (Windows Environment)**: Always run tests via `cmd.exe /c npm test`. Never run raw `npm test` in PowerShell due to execution policy restrictions.

---

## 2. Directory & Key File Map

| Path | Purpose & Contents |
| :--- | :--- |
| `src/App.tsx` | Main application hub (~17k lines). Handles navigation, routing, modal states, player embeds, continue watching rails, and section views. |
| `src/App.css` | Complete application design system (~22k lines). Glassmorphism, animations, media queries, dark mode theme. |
| `src/tmdb.ts` | TMDB API client, stream provider definitions (`streamProviderOptions`), and stream URL builder (`buildStreamUrl`). |
| `src/omdb.ts` | OMDb API client, title search, detail normalization (`normalizeMovie`), and embed sanitization (`sanitizeMovieEmbed`). |
| `src/profiles-api.ts` | Profile CRUD, watch history sync, device management, and Lord PIN verification/saving. |
| `src/jav-api.ts` | JAV streaming integration, catalog search, and detail normalization. |
| `api/hub.ts` | Unified Vercel serverless proxy (`/api/hub?kind=...`) for external APIs with edge caching (`Cache-Control: s-maxage=...`). |
| `api/_lib/` | Serverless core business logic (Supabase, TMDB, AniList, Manga, LiveTV, streaming resolvers). |
| `vite.config.ts` | Vite dev server configuration with built-in mock/proxy middlewares matching `api/hub.ts`. |
| `vercel.json` | Vercel rewrite rules routing `/api/<endpoint>` to `/api/hub?kind=<endpoint>`. |

---

## 3. Streaming Providers & Media Architecture

### Mainstream Content (Apple TV & Netflix UI)
- Providers: `rivestream`, `vidrift`, `filmu`, `superembed`.
- Anime Providers: `filmu`, `nhdapi`, `clickhost`, `megaplay`, `megabuzz`, `megavid`.
- Built via `buildStreamUrl(movie, providerId, season?, episode?)`.

### Lord Section (Protected 18+ Profile)
- Protected by `LordPinModal` (Default PINs: `4719`, `1408` or remote PIN via `verifyRemoteLordPin`).
- Fast verification animation: 360ms orbit, 160ms screw-down, 220ms success transition.
- **Strict Separation**: Mainstream movies must NEVER be recognized as Lord adult content:
  - `isLordAdultMovie`, `isPhub1Movie`, `isPhub2Movie`, `isPhub3Movie`, `isJavMovie`, `isHentaiMovie` must return `false` for TMDB/OMDb titles.
- **Adult Providers & Tabs**:
  - **Active Tabs**: **Hentai**, **PHub 2**, **PHub 3**, **JAV** (PHub 1 removed from active UI navigation).
  - **PHub 2** (`serverMode='xvidapi'`): Cached in `xvidApiCache`, initial videos `INITIAL_XVID_VIDEOS`. Always query with `pagesize=24` (never query without `pagesize` as it returns 1,000 items).
  - **PHub 3** (`serverMode='eporner'`): Cached in `epornerApiCache`, initial videos `EPORNER_INITIAL_VIDEOS`.
  - **JAV**: Provider `apijav`.
  - **Hentai**: Provider `oceanplay` (HentaiOcean).

---

## 4. Performance & Caching Rules
1. **Zero-Delay Renders (Stale-While-Revalidate)**:
   - Components like `LordPhubSection` must immediately initialize with fallback/bundled videos so the user sees cards on frame 1 (0ms load).
   - Never replace the screen with a full-page loading spinner if items already exist (`loading && displayVideos.length === 0`).
2. **Network Timeouts & Caching**:
   - Direct adult API fetches (PornApi, Eporner, Xvid) can be blocked by regional ISPs. Always use `AbortController` with short timeouts (1500–2500ms) and race endpoints via `Promise.any`.
   - Cache results in module-level `Map` instances (`pornApiCache`, `xvidApiCache`, `epornerApiCache`).
3. **Edge Proxying**:
   - Proxy requests through `/api/hub?kind=...` with `s-maxage=1800` so Vercel edge CDN serves responses in ~50ms.

---

## 5. Testing & Verification Runbook
- To run tests:
  ```bash
  cmd.exe /c npm test
  ```
- Important test files:
  - `src/lord-separation.test.ts`: Validates adult content is isolated from mainstream profiles.
  - `src/hentaiocean.test.ts`: Validates adult providers and categorization.
  - `src/phub-refresh.test.ts`: Validates seed synchronization and profile isolation.
  - `src/stream-resolver.test.ts`: Validates video stream URL builders.
