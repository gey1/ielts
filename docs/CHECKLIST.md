# Checklist

## Completed

- Phase 0: Vite + React + TypeScript PWA, Dexie schema, import service kept separate from FSRS and from the UI, docs for schema, architecture and content generation.
- Phase 1: create, edit, delete and search cards; preset topics plus custom collections and tags; JSON import with validation, preview, duplicate hints, history and rollback; stable ids that update content without touching schedules; FSRS Again/Hard/Good/Easy; programme vs review-only; daily new-card limit; manual reschedule and reset; dashboard and progress; full backup and restore; persistent-storage request; device-data warning; offline service worker; GitHub Pages workflow.
- Phase 2: month calendar from real due dates, completed reviews and today’s introduction quota. Tapping a day lists those cards.
- Phase 3: recognition, recall from a definition or gloss, cloze, Chinese-to-English, paraphrasing and sentence writing. Objective items show right/wrong. All of them then ask for a confidence rating. Recognition and application do not count as mastery.
- Phase 4: the learning programme appends a short productive exercise set after the flashcards (cloze, translation, paraphrase or a sentence). Recognition stays out of that set. The exercise list is a registry, so another type can be added without a new screen.

## In progress

- Nothing inside this pass.

## Outstanding

- A pass on a physical iPad: Add to Home Screen, safe areas, the Files share sheet for JSON export, and whether Safari actually grants persistent storage.
- Cloud sync, accounts and multi-device merge.
- Any model call. Content is generated outside the app with `docs/CONTENT_PROMPT.md`.
- Fluency as a scheduled skill. The record key exists; nothing writes it yet.
- Splitting the main bundle. The production chunk is about 565 kB minified because FSRS, Dexie and the UI ship together. It is cached by the service worker after the first load.

## Known bugs

- None found by Vitest or by Playwright on Chromium and WebKit after the fixes in this pass. iOS-only behaviour is untested on hardware.

## Architecture decisions

- Vite rather than Next.js, and plain CSS rather than a component library, because the app is a static offline PWA and the requested stack was React, TypeScript and CSS.
- Hash routing so one build works on GitHub Pages, Cloudflare Pages and Netlify without rewrite rules.
- Simplified Chinese chrome. The learner’s English is the card content, not the menus.
- Card ids are explicit when the file provides them, otherwise a hash of type + normalised front. Re-import updates that row and leaves the recall schedule in place.
- Mastery is recall-only: Review state and stability of at least 21 days. Recognition is a different SRS row.
- FSRS fuzz is disabled so the interval on the button is the interval that is stored.
- A study round does not requeue a card that becomes due again in one minute. The next round will.
- New cards are not painted onto future calendar days. Only today’s remaining quota is shown, because that is the real rule.
- Imports and backups are single transactions. Only the latest applied import batch can be rolled back, so an older snapshot cannot overwrite a newer edit by accident.
- Preset topic names stay fixed so “Environment” and “环境” keep joining `topic-environment`.
- Content renders as text. The importer rejects unknown JSON keys and does not parse HTML.

## Phase notes

Phase 0 locked the stores, the import boundary and the skill key before the screens existed. Phase 1 was tested with fake IndexedDB (update keeps FSRS reps; rollback deletes only cards that batch created; a bad file writes nothing) and then in the browser. Phases 2–4 were added after that suite was green: the calendar reads the same records, and exercises call the same `applyReview` with a different skill. WebKit at an iPad size passed create, review, import and an offline reload.
