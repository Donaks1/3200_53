# OsteoMap Testing Strategy

Scope: the `osteomap/` app (React 19 + TS + Vite 8 + Dexie/IndexedDB + panzoom + vite-plugin-pwa).
Primary users: **mobile phone, portrait, often offline in the field.**
Nothing below has been implemented yet — this is the plan.

**Decisions**
- Unit/component: **Vitest + React Testing Library + fake-indexeddb**
- E2E/PWA: **Playwright**
- **CI: yes** — GitHub Actions on every PR (details in §1)
- **Mobile first** — phone viewports and real phones are the primary target; desktop is secondary (see §2.1)
- Issues found while reading the code are parked in §6 for later discussion

---

## 1. Framework choice

| | **Vitest + RTL** (recommended) | Jest + RTL | Vitest Browser Mode |
|---|---|---|---|
| Setup with Vite 8 | Reuses `vite.config.ts` as-is | Needs ts-jest/babel, ESM config, mocks for `?raw` SVG imports | Reuses config, but needs a browser |
| Speed | Fast (watch mode) | Slower | Slower |
| SVG / DOM realism | jsdom — no layout, no real touch | Same | Real browser |
| Verdict | **Default for unit + component** | Skip — more config for nothing | Optional later, only if jsdom can't handle an SVG test |

| E2E | **Playwright** (recommended) | Cypress |
|---|---|---|
| Mobile Safari (WebKit) | Yes | No (experimental only) |
| Phone emulation + touch | Built-in devices (`iPhone 13`, `Pixel 7`) | Viewport only |
| Offline / service worker | `context.setOffline(true)`, SW access | Weak |
| File upload / download | First-class | Workarounds |
| Verdict | **Use this** | Doesn't fit an offline mobile PWA |

**Toolchain**

- `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- `fake-indexeddb` — lets Dexie run inside Vitest (import `fake-indexeddb/auto` in the setup file)
- `@playwright/test` — E2E on Chromium (Pixel 7) + WebKit (iPhone 13)
- `@vitest/coverage-v8` — coverage report (aim for coverage on `src/db/` and pure logic, not a % target on pages)
- Keep existing ESLint + `tsc -b` as the first gate
- Manual checklist on **real phones** for touch, install, and offline (cannot be fully automated)

**CI (agreed):** one GitHub Actions workflow on every PR: `npm ci → lint → tsc -b → vitest run`. Run Playwright (mobile projects first) on PRs into `main`. The GitHub Pages deploy job should depend on this passing. The workflow file is added together with the test tooling setup — not before, since there are no test scripts yet.

---

## 2. Test layers

| Layer | Tool | What it covers | Where |
|---|---|---|---|
| **Unit** | Vitest | Pure logic: CSV escape/parse, case↔CSV row mapping, `boneLabel`, `withPaint`/`withoutPaint`, `computeUpdatedSegmentStates`, `searchOptionsFromSvg`, undo/redo stack logic | `src/**/*.test.ts` |
| **Data / integration** | Vitest + fake-indexeddb | `src/db/*` operations against a real Dexie instance: CRUD, cascade deletes, import → DB → export round-trip | `src/db/*.test.ts` |
| **Component** | Vitest + RTL | One component in isolation: `NotesPopup`, `Metadata`, `TextInputPopup`, toolbar buttons enabled/disabled, confirm dialogs | `src/components/*.test.tsx` |
| **Page integration** | Vitest + RTL + fake-indexeddb | A page wired to the DB: SkeletonPage loads a case and repaints saved states; click bone → DB updated; undo → DB reverted | `src/pages/*.test.tsx` |
| **E2E** | Playwright (Pixel 7 + iPhone 13) | Full user flows in a real browser: create case → paint → notes → export → import on a fresh profile | `e2e/*.spec.ts` |
| **PWA** | Playwright + manual on device | Service worker registers, app loads offline after first visit, data survives reload, installability, update behaviour | `e2e/pwa.spec.ts` + manual checklist |
| **Manual / acceptance** | Checklist (Tests A–E from Sprint 1) | Pinch-zoom feel, real touch accuracy, install to home screen, keyboard covering toolbar | Real devices |

Rule of thumb: logic → unit; anything touching IndexedDB → data test with fake-indexeddb; anything needing real touch, layout, or a service worker → Playwright or manual.

### 2.1 Mobile priority

Playwright projects, in priority order:
1. `iPhone 13` (WebKit — closest to iOS Safari)
2. `Pixel 7` (Chromium)
3. `Desktop Chrome` — secondary, run on PRs into `main` only

Test these first, on at least one real iPhone and one real Android phone:
1. **Offline** — open once online, then airplane mode: app loads, create case, paint, reload, nothing lost.
2. **Tap accuracy** — the tapped bone is the one painted, at 1x and after pinch-zoom to 2x/3x; small bones (hands, feet, teeth, vertebrae).
3. **On-screen keyboard** — notes / metadata / name inputs: keyboard does not cover Save/Cancel or the bottom toolbar.
4. **Layout at 360px and 390px** — no horizontal scroll, toolbar fits, tap targets ≥ 44px.
5. **Install to home screen** — Android Chrome and iOS Safari; launches standalone and works offline from the icon.
6. **Export/import on a phone** — the CSV downloads somewhere the user can find it; the file picker accepts it back.
7. **Storage survives** — data still there after closing the browser and a few days of not opening the app (iOS Safari can clear site data for web apps not added to the home screen).

---

## 3. Test points and acceptance criteria per module

### 3.1 Local database (Dexie) — `src/db/*`
- Create site/context/case → retrievable by ID; `dateCreated`/`dateModified` are ISO strings.
- `updateSegmentState`, `removeSegmentState`, `setAllSegmentStates`, `updateCaseMetadata` update `dateModified`; throw `"Case not found"` on a bad ID.
- `deleteSite` removes its contexts **and** their cases; `deleteContext` removes its cases; other sites untouched.
- `getCasesByContext` returns only that context's cases.
- **Accept:** all db functions have a data test; no orphaned cases after any delete.

### 3.2 Case management CRUD (Home page / My Skeletons)
- Add / rename / delete site, context, case through the UI; cancel on `confirm` leaves data unchanged.
- Case list refreshes live after changes (dexie-react-hooks).
- My Skeletons: edit saves, delete asks for confirmation, error path shows an alert.
- **Accept (Sprint 1 Test A):** created case shows the entered metadata after close + reopen; required fields validated.

### 3.3 Metadata form + notes popup
- Metadata: defaults (`sex: unknown`), each age group selectable, Save persists, Cancel discards.
- Notes: opens with existing notes; Save persists to `fieldNotes`; Cancel, Escape and backdrop click do **not** save; clicking inside the dialog doesn't close it; textarea autofocuses.
- Notes with commas, quotes, newlines, emoji survive save → export → import.
- On a phone viewport the on-screen keyboard does not hide Save/Cancel or the bottom toolbar (open question from meeting).
- **Accept:** notes are never lost on Save and never written on Cancel.

### 3.4 SVG bone selection + colour (zonation)
- Bone mode: tapping any zone selects the enclosing `<g>` bone; zone mode: selects the single shape; teeth are selectable individually in both modes.
- Tap outside the skeleton → nothing selected.
- Paint Present/Absent/Fragmentary → `data-paint` attribute set and colour matches the legend; stored as `complete/absent/fragmentary`.
- Painting a whole bone replaces its painted zones; clearing one zone of a painted bone keeps siblings' colour (`withoutPaint` / `computeUpdatedSegmentStates`).
- Painting one bone never changes another (left vs right femur/tibia on the back view — IDs are rewritten at load, test this explicitly).
- Saved states repaint correctly on reopen, in both front and back views.
- `boneLabel`: `l_femur → "Left femur"`, `r_iv-2 → "Right iv 2"`.
- **Accept (Test B):** the correct bone changes to the correct colour, others unchanged, state retained after reload.

### 3.5 Front/back view, skull (and spine/ribs) detail views, pan + zoom
- Flip front ↔ back keeps all paint and doesn't reset states.
- Tap skull on the anterior view → skull view; switch skull front ↔ left lateral; back button returns to the full skeleton.
- Same for the new spine/ribs detail view once built.
- Reset view returns zoom to 1 and centre, and returns from skull/back to anterior.
- Pinch zoom / drag pan on a real phone: smooth, no jump, paint still hits the tapped bone after zooming (tap accuracy at 2x/3x).
- **Accept (Test D):** every view transition lands on the correct SVG with paint intact; no mis-taps after zoom.

### 3.6 Undo / Redo + Select all + "unselected" state
- Undo disabled on a fresh case; enabled after one paint; redo disabled until an undo.
- Paint A → paint B → undo → B reverted in UI **and DB**; redo → B back.
- A new paint after undo clears the redo stack.
- Undo/redo after flipping view or entering skull view still works (stack holds DOM element refs — likely edge case).
- Undo/redo stacks reset when opening a different case (no leaking history).
- Select all: confirm dialog; Cancel changes nothing; OK marks every bone in the **current view only**; one undo reverts the whole select-all.
- New "unselected" (white) toolbar option clears a bone to no state and removes it from `segmentStates`.
- **Accept:** DB state always equals what's on screen after any undo/redo sequence.

### 3.7 CSV import / export (+ PDF)
Unit (pure functions):
- `escapeCsv`: values with `,` `"` `\n` are quoted and quotes doubled; plain values untouched.
- Parser: quoted commas, escaped `""`, newlines inside quotes, `\r\n` line endings, trailing newline, empty fields.

Data / round-trip:
- Export full DB → import into an empty DB → every site, context, case, field and segment state identical.
- Case with zero segments exports one row and re-imports with `{}` states.
- Import into a DB that already has the **same site/context** → adds the case under the existing one, no duplicate site/context (Tinashe's check).
- Duplicate case name / ID → the new duplicate-name popup appears and each choice (skip / overwrite / keep both) does what it says.
- Unselected-bones sheet: every bone without a state is listed (note: CSV has no "pages" — this needs a separate file or an `.xlsx` export).

Bad input:
- Empty file, header only, wrong/missing columns, invalid `ageGroup` or `segmentState`, non-CSV file → clear error message, DB unchanged.
- Note: `importDatabaseCSV` currently **returns without throwing** on an empty file, so the UI shows "Import successful!" — test this and fix.
- Notes beginning with `=`, `+`, `-`, `@` open safely in Excel (CSV formula injection).

PDF (if kept in scope):
- Generates a file for the selected case containing its metadata and bone states.

- **Accept (Test E):** full round-trip with zero field differences; bad files never corrupt the DB and always show an error.

### 3.8 PWA / offline / hosting
- Service worker registers after first load (`navigator.serviceWorker.controller` set after reload).
- Offline after first visit: app shell loads, create case, paint, notes, reload → data still there (Playwright `setOffline(true)`).
- Force-close + reopen on a real phone in airplane mode (Test C).
- `autoUpdate`: deploying a new build updates the app without losing IndexedDB data.
- Installability: manifest currently has **no icons** → Android Chrome won't offer install. Add 192/512 icons, then verify "Add to Home Screen" on Android and iOS.
- GitHub Pages: site is served from `/<repo>/`, so `start_url: '/'` and the Vite `base` must be checked — test deep reload and offline on the deployed URL, not just localhost.
- Desktop: `orientation: 'portrait'` doesn't break desktop layout; PWA installs on desktop Chrome (James's check).
- **Accept (Test C):** zero data loss offline; app opens from the home-screen icon in airplane mode.

### 3.9 Cross-cutting UI (styling, responsiveness, accessibility)
- Pages render without horizontal scroll at 360px and 390px widths; tap targets ≥ 44px.
- Toolbar buttons have `aria-label`s (lets RTL/Playwright select them by role — no need for `data-testid` everywhere).
- Colour legend distinguishable for colour-blind users (optional: add pattern/label).

---

## 4. Suggested testing tasks per person

Principle: **each person writes unit/component tests for their own feature; someone else runs the E2E/manual acceptance for it** (fresh eyes catch more).

| Person | Owns (from timesheet + minutes) | Writes tests for | Cross-checks |
|---|---|---|---|
| **Evan** (testing lead) | Metadata form, bone categorisation, notes popup | Set up Vitest + RTL + fake-indexeddb + Playwright + CI workflow; write the first example tests. Component tests for `NotesPopup`, `Metadata`. Maintain the manual checklist (Tests A–E). | Test B (colouring) on a real phone |
| **Thisen** | Local DB, case CRUD, CSV import/export, duplicate-name import, unselected-bones export | Data tests for all `src/db/*`; CSV unit tests; round-trip + bad-file tests; duplicate-name popup tests | Test A (create case + metadata) |
| **Shakeel** | Undo/redo, Select all, "unselected" button | Undo/redo sequence tests (ideally after extracting a `useUndoRedo` hook); select-all + one-undo; unselected clears DB entry | CSV round-trip E2E (Thisen's feature) |
| **Andoni** | SVG zonation, colour on click, front/rear view, spine/ribs detail, GitHub Pages | Unit tests for `selectionAt`, `withPaint`, `withoutPaint`, `computeUpdatedSegmentStates`, `searchOptionsFromSvg`; SVG ID sanity test (no duplicate IDs, left/right rewrite correct) | PWA offline on deployed GitHub Pages URL |
| **James** | Pan/zoom, PWA, front/back view, My Skeletons, homepage logic, user manual | Playwright PWA spec (SW registers, offline reload, data persists); view-transition E2E; My Skeletons component tests | Undo/redo manual (Shakeel's feature) |
| **Tinashe** | Import/export (CSV/PDF), skull/pelvis high-fidelity views, UI styling | Import-into-existing-site/context test; PDF export test; responsive layout checks at 360/390px via Playwright screenshots | Test D (zoom/pan/skull view) on a real phone |

---

## 5. Small code changes that would make testing easier (optional, not done)

1. Add scripts to `osteomap/package.json`: `test`, `test:watch`, `test:e2e`, `coverage`.
2. Move the pure helpers out of `SkeletonPage.tsx` (1,300 lines) into e.g. `src/skeleton/segments.ts` and export them — they are already pure, just not exported.
3. Extract undo/redo into a `useUndoRedo` hook so it can be tested with `renderHook`.
4. Split CSV code into pure `casesToCsv()` / `csvToRecords()` (no Dexie, no `saveAs`) plus a thin wrapper — makes every CSV edge case a 3-line unit test.
5. Make `importDatabaseCSV` throw on invalid input instead of `console.error` + return.

## 6. Issues for later discussion

Found while reading the code. Not fixed — to be discussed at the next meeting and turned into GitHub issues if agreed.

| # | Issue | Area / likely owner |
|---|---|---|
| 1 | `importDatabaseCSV` returns without throwing on an empty/short file, so the UI shows "Import successful!" when nothing was imported. | CSV import — Thisen |
| 2 | CSV import doesn't validate headers, `ageGroup` or `segmentState`; a bad file can write invalid data. | CSV import — Thisen |
| 3 | Import uses `bulkPut`, so a case with an existing `caseId` is silently overwritten (related to the duplicate-name popup work). | CSV import — Thisen |
| 4 | Sites/contexts are matched by ID only, so importing a case whose site already exists under a different ID creates a duplicate site. | CSV import — Tinashe |
| 5 | "Add a page to the Excel export for unselected bones" — CSV has no pages; needs a second file or a real `.xlsx` export. | Export — Thisen |
| 6 | Notes starting with `=`, `+`, `-`, `@` are treated as formulas when the CSV is opened in Excel. | Export — Thisen |
| 7 | PWA manifest has no icons, so Android Chrome won't offer install. | PWA — James |
| 8 | `start_url: '/'` and no Vite `base` — likely breaks when hosted under `/<repo>/` on GitHub Pages. | Hosting — Andoni / James |
| 9 | `orientation: 'portrait'` — check it doesn't cause problems on desktop. | PWA — James |
| 10 | Undo/redo stacks store DOM element references; undo after flipping view or entering skull view may fail. | Undo/redo — Shakeel |
| 11 | `deleteSite` / `deleteContext` delete cases and the parent in separate steps (no transaction), so an interruption could leave partial data. | DB — Thisen |
| 12 | Consider `navigator.storage.persist()` so the browser is less likely to clear IndexedDB on phones. | PWA — James |

**Questions for the client**
- Test B lists 5 conditions (complete, absent, fragmentary, **unknown, highly crushed/distorted**); the app stores only 3. Are the other two still required?
- Is PDF export still in scope, or is CSV (+ unselected-bones list) enough?
