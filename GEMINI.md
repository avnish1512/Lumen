# Lumen Project Memory & Architecture Guide

See [AGENTS.md](file:///f:/Lumen/AGENTS.md) for full architecture reference.

## Quick Cheat Sheet for Instant Task Execution

### 1. Key Locations
- **Main App & Logic**: [App.tsx](file:///f:/Lumen/src/App.tsx)
- **Styles & Themes**: [App.css](file:///f:/Lumen/src/App.css)
- **Streaming & Providers**: [tmdb.ts](file:///f:/Lumen/src/tmdb.ts)
- **Serverless Hub Proxy**: [hub.ts](file:///f:/Lumen/api/hub.ts)
- **Local Dev Server**: [vite.config.ts](file:///f:/Lumen/vite.config.ts)
- **Vercel Routing**: [vercel.json](file:///f:/Lumen/vercel.json)

### 2. Execution Constraints
- Always run terminal test commands with `cmd.exe /c npm test`.
- Mainstream movies must remain isolated from the Lord adult profile (`isLordAdultMovie` separation).
- External API calls in adult sections must have short `AbortController` timeouts (1500–2500ms), map-based memory caching, and instant fallback rendering.
- For PHub 2 (`xvidapi`), always keep `pagesize=24`.
