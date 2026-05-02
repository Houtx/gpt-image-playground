# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GPT Image Playground — an AI image generation/editing workbench that runs as both a **web app** (Next.js) and an **Android APK** (Capacitor static export). Uses OpenAI's GPT Image models (`gpt-image-1`, `gpt-image-1-mini`, `gpt-image-1.5`, `gpt-image-2`). UI is in Chinese (zh locale).

## Commands

```bash
npm run dev          # Dev server with Turbopack (localhost:3000)
npm run dev:lan      # Dev server bound to 0.0.0.0 for LAN access
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint on src/
npm run format       # Prettier on src/**/*.{ts,tsx}
npm run cap:sync     # Build static export + sync to Capacitor Android
npm run apk:debug    # Full APK build (cap:sync + gradlew assembleDebug)
```

No test framework is configured.

## Architecture

### Dual-target design

The app has two runtime modes with different API strategies:

- **Web mode**: Next.js with server-side API routes (`src/app/api/`). The `OPENAI_API_KEY` stays server-side. Images stored to `./generated-images/` (fs mode) or browser IndexedDB.
- **APK mode**: Capacitor static export (`output: 'export'`). No server routes — all API calls go directly from the browser using `src/lib/native-openai.ts` with `dangerouslyAllowBrowser: true`. API key configured in-app and stored on device.

The Capacitor build script (`scripts/build-capacitor-web.mjs`) temporarily removes `src/app/api/` before building, then restores it. `next.config.ts` switches to static export when `CAPACITOR_BUILD=1`.

### Storage modes

Controlled by `NEXT_PUBLIC_IMAGE_STORAGE_MODE` (`fs` | `indexeddb`). Auto-detected: defaults to `fs` locally, `indexeddb` on Vercel or Capacitor. The Dexie database (`src/lib/db.ts`) stores image blobs in IndexedDB with filename as primary key.

### Key source layout

- `src/app/page.tsx` — Main page: all state management, form orchestration, API calling, history tracking. Single large client component.
- `src/app/api/images/route.ts` — Web-mode image generation/editing API route. Supports streaming with partial image events.
- `src/lib/native-openai.ts` — APK-mode direct OpenAI client calls (bypasses Next.js API routes).
- `src/lib/cost-utils.ts` — Token-based cost estimation for all 4 models.
- `src/lib/size-utils.ts` — Dimension validation for `gpt-image-2` custom sizes (pixel constraints, aspect ratio, edge multiples).
- `src/components/generation-form.tsx` — Text-to-image form.
- `src/components/editing-form.tsx` — Image editing with mask support.
- `src/components/image-output.tsx` — Image display, zoom, download, share.
- `src/components/history-panel.tsx` — History with cost breakdown.
- `src/components/request-inspector.tsx` — Debug panel showing request lifecycle.
- `src/components/ui/` — shadcn/ui components (new-york style).

### UI framework

- **shadcn/ui** (new-york style) with Radix primitives, configured in `components.json`
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin and `tw-animate-css`
- **next-themes** for dark/light mode (`ThemeProvider` in layout)
- **Lucide React** for icons

## Code Style

- **Prettier**: 4-space indent, single quotes, JSX single quotes, 120 char print width, no trailing commas, import sorting via `@trivago/prettier-plugin-sort-imports` + `prettier-plugin-tailwindcss`
- **ESLint**: `next/core-web-vitals` + `next/typescript`
- **TypeScript strict mode** enabled
- **Path alias**: `@/*` maps to `./src/*`

## Environment Variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Server-side API key (web mode only) |
| `OPENAI_API_BASE_URL` | Custom/compatible API base URL (server-side) |
| `APP_PASSWORD` | Optional web access password |
| `NEXT_PUBLIC_IMAGE_STORAGE_MODE` | `fs` or `indexeddb` |
| `NEXT_PUBLIC_APP_RUNTIME` | Set to `capacitor` in APK builds |
| `NEXT_PUBLIC_OPENAI_API_BASE_URL` | Client-side base URL for APK mode |

## Capacitor / APK Notes

- `capacitor.config.ts` sets `webDir: 'out'` (Next.js static export output)
- APK builds require `CAPACITOR_BUILD=1`, `NEXT_PUBLIC_APP_RUNTIME=capacitor`, `NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb`
- Android project lives in `android/`; requires Android Studio / SDK / JDK 17
