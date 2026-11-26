# Smart Video Downloader – Embed URL Analyzer

A secure, dark-themed desktop application built with **Electron, React, TypeScript, Node.js, Tailwind CSS, and SQLite** that analyzes video embed URLs and direct video links, checks whether an unprotected and publicly accessible MP4 download source legitimately exists, and streams/validates verified MP4 files to disk.

---

## Core Design Principles

1. **Honest Inspection Over False Promises**: Never assumes an `<iframe>` or HTML embed page exposes a downloadable MP4. If an embed uses streaming-only protocols (HLS/DASH), DRM, anti-bot protections, authentication walls, or `controlsList="nodownload"`, downloading stays disabled and the exact reason is shown clearly.
2. **Real File Validation**: Downloads stream through a `.part` temporary file first. Before promoting to `.mp4` and reporting `Completed`, the engine checks HTTP status, byte completeness (`Content-Length`), and the binary ISO Base Media File Format (`ftyp`) header so HTML error pages or truncated payloads are rejected cleanly.
3. **Zero Circumvention**: Does not bypass DRM, crack tokens, scrape hidden obfuscated player internals, or defeat anti-bot / CAPTCHA gates.

---

## Project Structure

```text
smart-video-downloader/
├── electron/
│   ├── main.ts                      # Electron Main process, secure BrowserWindow, IPC handlers, ephemeral inspector
│   └── preload.ts                   # Strict contextBridge preload API (no Node primitives exposed to renderer)
├── src/
│   ├── main/
│   │   ├── analysis/
│   │   │   ├── htmlInspector.ts     # Safe HTML/JSON-LD/<video>/<source>/<a download> & protection signal inspection
│   │   │   ├── mp4Signature.ts      # Binary MP4 ISO BMFF ('ftyp') signature & corrupt/HTML error detection
│   │   │   └── urlAnalyzer.ts       # URL reachability, delivery detection, & candidate verification
│   │   ├── download/
│   │   │   └── downloadManager.ts   # Streaming HTTP reader + .part writer, progress/speed/ETA, cancel, verification
│   │   ├── security/
│   │   │   ├── pathGuard.ts         # Filename sanitization, .mp4 enforcement, & system directory protection
│   │   │   └── urlGuard.ts          # HTTP/HTTPS validation, DNS lookup, SSRF IPv4/IPv6 guard, redirect limits
│   │   └── storage/
│   │       └── sqliteStore.ts       # SQLite persistence for download history & application settings
│   ├── renderer/
│   │   ├── components/
│   │   │   ├── ActiveDownloadCard.tsx
│   │   │   ├── HistoryPanel.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── UrlAnalyzerBar.tsx
│   │   │   └── VideoInfoPanel.tsx
│   │   ├── utils/
│   │   │   └── format.ts
│   │   ├── App.tsx
│   │   ├── global.d.ts
│   │   ├── index.css
│   │   ├── index.html
│   │   └── main.tsx
│   └── shared/
│       └── types.ts                 # Shared IPC contracts, exact app statuses, & delivery format types
├── tests/
│   ├── helpers/
│   │   └── mockServer.ts
│   ├── downloadManager.test.ts
│   ├── securityAndPath.test.ts
│   ├── sqliteStore.test.ts
│   └── urlAnalyzer.test.ts
├── electron-builder.json
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Supported vs. Unsupported Video Sources

| Source / Format | Delivery Classification | Downloadable? | Behavior |
| :--- | :--- | :--- | :--- |
| Public unprotected `.mp4` link (`video/mp4` + valid `ftyp` header) | `Direct MP4` | **Yes** | Verifies header via bounded `GET` range probe, then enables `Download MP4` |
| Public HTML page exposing `<video src>`, `<source type="video/mp4">`, `og:video`, `JSON-LD contentUrl`, or `<a download>` leading to unprotected MP4 | `Direct MP4` | **Yes** | Extracts candidate, verifies `200`/`206` & binary MP4 header, enables download |
| HLS Playlist (`.m3u8` / `application/vnd.apple.mpegurl`) | `HLS` | **No** | Reports `Streaming-only source` + suggests authorized playback/official download |
| MPEG-DASH Manifest (`.mpd` / `application/dash+xml`) | `DASH` | **No** | Reports `Streaming-only source` |
| DRM-protected (`Widevine` / `PlayReady` / `FairPlay` / EME) | `Unknown` / `HLS` / `DASH` | **No** | Reports `Protected or restricted source`; never extracts keys or circumvents DRM |
| Anti-bot, CAPTCHA, DDoS-Guard, Login/Paywall (`401`/`403`/`429`), or `controlsList="nodownload"` | Varies | **No** | Reports `Protected or restricted source` without evasion |
| Malformed URL, non-HTTP scheme (`file:`, `ftp:`, `javascript:`), or private/loopback/metadata IP | `Unknown` | **No** | Blocked immediately with `Unsupported URL` (SSRF defense) |
| **CineSrc Test Case** (`https://cinesrc.st/embed/movie/1084242`) | `Unknown` | **No** | Serves a Next.js client shell behind `ddos-guard` without any public MP4 link; displays: *"No permitted direct MP4 download source was found. This embed may be streaming-only or restricted."* |

---

## Installation

Prerequisites: **Node.js 22+** and **npm 10+**.

```bash
cd smart-video-downloader
npm install
```

*(On Windows PowerShell environments with script execution restrictions, run npm commands via `cmd.exe /c npm ...`.)*

---

## Development & Production Commands

### Typecheck & Automated Tests
```bash
npm run typecheck
npm test
```

### Run Desktop App in Development Mode (Vite HMR + Electron)
```bash
npm run dev
```

### Build & Run Production Desktop App
```bash
npm run build
npm start
```

### Build for Windows (Installer & Portable Executable)
```bash
# Generates unpacked Windows app directory (fast verification)
npm run package:win:dir

# Generates NSIS installer and portable .exe in release/
npm run package:win
```

*(Note: Packaging Windows `.exe` artifacts requires `electron-builder` to fetch Windows/NSIS/winCodeSign tooling if not already cached, and code signing requires a certificate for SmartScreen trust in production distribution.)*

---

## Security Controls Implemented

- **Context Isolation & Sandboxing**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all Electron `BrowserWindow`s. Navigation and popups (`will-navigate`, `setWindowOpenHandler`) are locked down on the main UI shell.
- **SSRF & Redirect Protection**: Validates URL syntax (`http:`/`https:` only, rejects embedded credentials), resolves DNS A/AAAA records via `dns.lookup(..., { all: true })` to block loopback, RFC1918 private networks, CGNAT, link-local, and cloud metadata IPs, and re-validates every HTTP redirect hop (max 5).
- **Safe File Paths**: Sanitizes filenames, rejects null bytes/control characters/Windows device names (`CON`, `NUL`, etc.), blocks writes into Windows system directories, enforces `.mp4` only after container validation, and writes atomically via `.part` staging.
- **Minimal Data Persistence**: SQLite persists only `downloads_history` and `settings`. No passwords, cookies, or auth tokens are stored.
