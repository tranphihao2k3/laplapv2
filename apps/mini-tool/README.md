# LapLap Mini Tool

Portable Electron desktop tool that runs from USB and pushes hardware /
benchmark / test data back to [laplapcantho.store](https://laplapcantho.store)
via the `/api/v1/mini-tool/*` endpoints.

This sub-app is part of the monorepo at `apps/mini-tool/` of the
[laplap-laptop](https://github.com/laplapcantho/laplap-laptop) repository. It
shares no source code with the Next.js web app at this stage — components and
styling tokens are copy-mirrored.

See [`MINI_TOOL_PLAN.md`](../../MINI_TOOL_PLAN.md) at the repo root for the
full architecture / schema / API plan.

## Tech stack

- Electron 33 + Vite + React 19 + TypeScript (strict)
- Tailwind CSS 3 + Radix UI primitives (shadcn-style clone)
- `systeminformation` for hardware scanning
- `electron-store` for local session persistence
- PowerShell (spawned) for OS-level operations
- `electron-builder --win portable` for single-file portable `.exe`

## Scripts

| Command                  | What it does                                             |
| ------------------------ | -------------------------------------------------------- |
| `npm install`            | Install deps (use `--legacy-peer-deps` if React 19 complains) |
| `npm run dev`            | Launch Electron + Vite dev server (HMR renderer)         |
| `npm run typecheck`      | `tsc --noEmit -p .`                                      |
| `npm run build`          | `electron-vite build` → `dist/{main,preload,renderer}`   |
| `npm run build:portable` | Build + `electron-builder --win portable` → `release/*.exe` |
| `npm run start`          | Preview the built app (Electron loads local files)       |

## Layout

```
apps/mini-tool/
├── electron.vite.config.ts   # Three entries: main, preload, renderer
├── tailwind.config.ts        # Tokens mirror the web project
├── package.json              # electron-builder portable config lives here
├── scripts/                  # PowerShell scripts + .secret.example
├── src/
│   ├── main/                 # Electron main process (Node)
│   │   ├── index.ts          # BrowserWindow + portable userData
│   │   ├── ipc.ts            # All `ipcMain.handle` channels
│   │   ├── hardware.ts       # systeminformation wrapper
│   │   ├── powershell.ts     # spawn powershell.exe wrapper
│   │   ├── crypto.ts         # HMAC-SHA256 signer
│   │   ├── session.ts        # electron-store for storedSession
│   │   ├── upload.ts         # Build payload + POST /upload
│   │   ├── clipboard.ts      # Electron clipboard bridge
│   │   └── benchmark.ts      # FurMark detection
│   ├── preload/              # contextBridge → window.lap
│   │   ├── index.ts
│   │   └── api.d.ts          # Window.lap type for renderer
│   └── renderer/             # React UI (Worker D fills in real tabs)
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.html
│       ├── index.css         # Tailwind + shadcn tokens
│       ├── components/ui/    # Copied shadcn primitives
│       └── lib/              # cn + window.lap typing
```

## Shared secret

Sign every upload with HMAC-SHA256 using a shared secret kept in
`scripts/.secret.example` (rename to `.secret` at runtime). In production the
secret is also injected via `LAPLAP_MINI_TOOL_SECRET` env var. See
`MINI_TOOL_PLAN.md` §7.2.

## Security notes

- `contextIsolation: true`, `nodeIntegration: false`
- CSP set in `src/renderer/index.html`
- External URLs always go through `shell.openExternal`