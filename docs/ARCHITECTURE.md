# Architecture

词径 is a static Vite + React + TypeScript app. Dexie stores the library in IndexedDB. `ts-fsrs` schedules reviews. `vite-plugin-pwa` emits the manifest and a Workbox service worker that precaches the built assets. There is no backend.

UI copy is Simplified Chinese because the learner is. Card content stays in the language the author wrote, normally English with a Chinese gloss.

## Layout

- `src/domain` — types, ids, time, labels. No I/O.
- `src/services/db` — Dexie schema version 1 and preset seeding.
- `src/services/import` — parse, plan, commit, rollback. This folder does not import React or `ts-fsrs`.
- `src/services/srs` — FSRS adapter and the functions that write a schedule. Content tables are not updated here.
- `src/services/library` — create and edit cards, collections, settings, and the snapshot the UI reads.
- `src/services/study` — pure queue builder.
- `src/services/stats` — dashboard numbers and the calendar, both derived from records and logs.
- `src/services/exercises` — exercise registry. Adding a type means a new builder plus a label; the session UI is shared.
- `src/services/backup` — full export and replace.
- `src/pages` — the five sections, plus import, settings and practice.

Routes use `HashRouter`. A refresh on GitHub Pages, Cloudflare Pages or Netlify then always requests the already cached `index.html`, so no host-specific rewrite is required. Set `VITE_BASE` when the site is not served from `/`.

## Data

Separate object stores: `cards`, `blocks`, `collections`, `tags`, `cardCollections`, `cardTags`, `srsRecords`, `reviewLogs`, `importBatches`, `settings`.

An SRS row id is `${cardId}:${skill}`. Skills are `recognition`, `recall`, `application` and `fluency`. The flashcard Again / Hard / Good / Easy buttons write `recall`. Recognition exercises write `recognition`. Cloze, translation, paraphrase and sentence exercises write `application`. Fluency is reserved and unused.

Mastery on the dashboard counts only `recall` records whose state is Review and whose FSRS stability is at least 21 days. A correct recognition answer cannot mark a card mastered. One Easy on a new card is also not enough: the default scheduler graduates it with a stability under 21 days, so it stays “learning”.

Fuzz is off. The interval printed on the rating button is the interval that will be saved. Learning steps stay on, so Again / Hard / Good on a new card come back in minutes, and Easy jumps further ahead.

A study round is a snapshot taken when it starts. A card you just rated Again is not pushed back into the same round; it waits until it is due and you start again. That avoids a loop of one-minute learning steps. Review-only mode drops new cards. Programme mode adds new cards up to the daily limit, counting cards whose first recall rating happened today, then offers a few productive exercises on what you just saw. Those exercises are skipped when the daily exercise limit is 0. Recognition is available under 专项练习 only.

New cards are not assigned to future dates. The calendar shows them on today, up to the remaining daily slots. Other days show real due dates and the reviews that were actually logged.

Import and backup writes run inside Dexie transactions. A failed validation throws before any write. Rolling back an import is also one transaction.

The next schema change should be a new `this.version(2)` with an `upgrade` callback in `src/services/db/db.ts`. Settings fields added later are filled by `normalizeSettings`, so a missing number falls back to the default.

## Not built

Cloud sync, accounts, multi-device merge and in-app model calls are intentionally absent. A later sync layer can sit beside the import service and the backup file; it should not read API keys from the client. Exercise types can grow without a new scheduler. A new skill would be another value on the existing SRS key.
