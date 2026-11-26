# 词径

词径 is a local-first PWA for a Chinese-speaking learner preparing IELTS Speaking and Writing vocabulary. Cards, collections, FSRS scheduling and review history stay in IndexedDB on the device. There is no account, server or model call.

The interface is Simplified Chinese. The study material is English, with Chinese glosses.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123 . Production preview:

```bash
npm run build
npm run preview
```

Preview listens on http://127.0.0.1:43124 .

```bash
npm test          # Vitest: import, FSRS, queue, backup
npm run test:e2e  # Playwright: Chromium and WebKit (iPad), including offline
```

`test:e2e` expects a production build already in `dist/` and will start the preview server.

## Install on iPad

1. Deploy the `dist/` folder, or open the dev machine from the iPad if you are only trying it.
2. In **Safari** (not an in-app browser), open the site.
3. Tap Share, then **添加到主屏幕**.
4. Open 词径 from the home screen. After the first successful load, study, editing, review, import and export work offline.

The app asks the browser to persist storage. Safari can still drop site data. Export a backup from **设置与备份** and keep the JSON in the Files app.

## Data

Everything is stored in this browser’s IndexedDB database `cijing`. Clearing site data, using a private window, or moving to another device starts from empty. A home-screen icon is only a launcher; the data remains in the browser that created it.

- **导入 JSON** adds or updates card content. The same card id on a later import updates the text and leaves FSRS state and review history alone.
- **导出完整备份** downloads cards, schedules, logs, imports and settings. Restore replaces the data on this device.

## Deploy

Hash routes (`/#/study`) are used so GitHub Pages, Cloudflare Pages and Netlify can host the static build without a single-page rewrite. `npm run build` writes `dist/`.

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`, and can also be run by hand. In the repository settings, set Pages → Build and deployment → Source to **GitHub Actions**.

The workflow builds with `VITE_BASE=/ielts/` so assets load under the project site [https://gey1.github.io/ielts/](https://gey1.github.io/ielts/). For Cloudflare or Netlify at the domain root, leave `VITE_BASE` unset.

### Cloudflare Pages or Netlify

- Build command: `npm run build`
- Output directory: `dist`
- Do not set `VITE_BASE` unless the site is served from a subpath.

## Content

- `examples/template.json` — small schema example, including the deteriorate card.
- `examples/ielts-starter.json` — a short original starter pack. The in-app button **载入示例词库** loads it through the same preview and confirm flow.
- `docs/SCHEMA.md` — the import and backup formats.
- `docs/CONTENT_PROMPT.md` — instructions you can hand to an external model so it emits importable JSON. Do not put API keys in this app.
- `docs/ARCHITECTURE.md` — data, scheduling and extension points.
- `docs/CHECKLIST.md` — what is done, what is not, and why decisions were made.

## What a real iPad still needs

Playwright’s WebKit project (iPad-sized) covered create, review, import, reload and offline reload. That is not a physical iPad. Still worth checking by hand: Add to Home Screen, the status-bar safe area, the iOS file share sheet when exporting JSON, and whether Safari grants persistent storage.
