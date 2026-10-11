# Contributing to OsteoMap (Team 53)

This document is the team's shared reference for how the project is set up and how we work together on GitHub. Read it once, then keep it open as a reference for your first few PRs.

## Repo layout

```
3200_53/
├── osteomap/                    # the actual app — this is where you'll spend ~all your time
├── meeting-minutes/             # chair/minute-taker notes from each team meeting
├── client-communication-evidence/  # email threads with the client
├── drafts-and-planning/         # Figma mockups and early planning docs
└── README.md
```

## Stack

| Layer            | Choice                                      |
|-------------------|----------------------------------------------|
| UI                | React 19 + TypeScript                        |
| Build/dev server  | Vite 8                                        |
| Styling           | Tailwind CSS v4 (`@tailwindcss/vite`)         |
| Client-side data  | Dexie / dexie-react-hooks (IndexedDB wrapper) |
| Diagram interaction | @panzoom/panzoom                            |
| Export            | jsPDF (PDF); CSV/JPEG handled in-app          |
| Installable app   | vite-plugin-pwa                               |
| Lint/format       | ESLint (typescript-eslint, react-hooks, react-refresh) + Prettier |
| Node version      | 24 (pinned in `osteomap/.nvmrc`)              |

There is no backend — no server, database, or API in this repo. All persistence is local (IndexedDB) and export-based.

## Local setup

```bash
nvm use                # picks up Node 24 from osteomap/.nvmrc — cd into osteomap first
cd osteomap
npm install
npm run dev             # starts the Vite dev server. Click the link to preview our project.
```

Other useful scripts (run from `osteomap/`):

```bash
npm run lint      # catches unused vars, hook-rule violations, and style issues — same checks CI/reviewers expect to pass
npm run build     # type-checks the whole project (tsc -b) then bundles it (vite build) — catches type errors `dev` won't
npm run preview   # serves the build/ output locally, so you can sanity-check the production bundle before opening a PR
```

Run `npm run lint` and `npm run build` before opening a PR — both should pass cleanly.

## Main files we'll actually edit

Everything app-related lives under `osteomap/`:

- **`src/App.tsx`** — root component. Currently still the default Vite starter content — this is where the real OsteoMap UI gets built out.
- **`src/main.tsx`** — app entry point/bootstrap. Rarely needs changes.
- **`src/index.css`** — Tailwind entry point + any global styles.
- **`src/App.css`** — starter component styles; expect to replace this as real components/Tailwind classes take over.
- **`src/assets/`** — images and SVGs, including the skeleton diagram placeholders.
- **`public/`** — static files served as-is (favicon, `icons.svg` sprite).
- **`vite.config.ts`** — plugin config (Tailwind, PWA manifest name/icons).
- **`eslint.config.js`** — lint rules, if the team agrees to change them.
- **`package.json`** — scripts and dependencies.
- **`src/pages/`** — one file per page: `HomePage.tsx` (create/manage cases), `SkeletonPage.tsx` (SVG diagram editing), `ExportPage.tsx` (CSV/JPEG/PDF export). Placeholder content only for now — not yet wired up to `App.tsx`.

There's no `src/components/` folder yet — as soon as more than one person is building UI, agree on a structure (e.g. `src/components/`, `src/hooks/`, `src/lib/`) before it grows organically.

## Bone and zone IDs

Every bone and zone has one ID. The SVG drawings, the database and the CSV export all use it, and the app works out every name a person reads from it (`src/pages/segmentNames.ts`).

```
[left_|right_]<element>[_zone_[left_|right_]<zone>]
```

| ID | Reads as |
|----|----------|
| `left_femur` | Left femur |
| `left_femur_zone_11` | Left femur — zone 11 |
| `vertebra_t7_zone_2` | T7 vertebra — zone 2 |
| `mandible_zone_left_3` | Mandible — left zone 3 |
| `left_hand_distal_phalanx_4` | Left hand distal phalanx 4 |
| `cranium_zone_left_orbit` | Cranium — left orbit |

- Lowercase words joined by underscores.
- The side is the subject's, not the viewer's: on the front view the left bones are on the right of the screen.
- Elements are named in full and counted the anatomical way: digits 1–5 from the thumb or big toe, ribs 1–12 from the top, vertebrae `vertebra_c1`–`c7`, `t1`–`t12` and `l1`–`l5`.
- Zones keep their zonation-method number (or letters, as on the ulna). A midline bone drawn in a left and a right half puts the side on the zone: `mandible_zone_right_7`.
- A bone drawn as one shape has no zones. Its group carries the bone ID and the shape has no ID.
- In an SVG, a bone is a `<g>` with the bone's ID, and its zones are the shapes inside it. Groups of bones are regions, named for what they hold.
- Teeth and cartilage are drawn but never recorded (IDs starting `teeth` or containing `cartilage`).

The elements, head to toe (the order the CSV lists them). Every `left_` element has a `right_` twin.

| Region | IDs |
|--------|-----|
| Skull | `skull` (region), `cranium` (zones `cranium_zone_1`–`15`, `cranium_zone_left_orbit`, `cranium_zone_right_orbit`), `mandible` (zones `mandible_zone_left_1`–`7`, `mandible_zone_right_1`–`7`) |
| Spine | `spine_and_ribs`, `cervical_vertebrae`, `thoracic_vertebrae`, `lumbar_vertebrae` (regions), `vertebra_c1`–`c7`, `vertebra_t1`–`t12`, `vertebra_l1`–`l5`, `sacrum`, `coccyx` |
| Thorax | `left_ribs` (region), `left_rib_1`–`12`, `sternum` |
| Shoulder | `left_clavicle`, `left_scapula` |
| Arm | `left_humerus`, `left_radius`, `left_ulna` |
| Hand | `left_hand`, `left_carpals`, `left_hand_digit_1`–`5` (regions); `left_scaphoid`, `left_lunate`, `left_triquetrum`, `left_pisiform`, `left_trapezium`, `left_trapezoid`, `left_capitate`, `left_hamate`, `left_metacarpal_1`–`5`, `left_hand_proximal_phalanx_1`–`5`, `left_hand_middle_phalanx_2`–`5`, `left_hand_distal_phalanx_1`–`5` |
| Pelvis | `pelvis` (region), `left_hip_bone` |
| Leg | `left_femur`, `left_patella`, `left_tibia`, `left_fibula` |
| Foot | `left_foot` (region), `left_talus`, `left_calcaneus`, `left_navicular`, `left_cuboid`, `left_medial_cuneiform`, `left_intermediate_cuneiform`, `left_lateral_cuneiform`, `left_metatarsal_1`–`5`, `left_foot_proximal_phalanx_1`–`5`, `left_foot_middle_phalanx_2`–`5`, `left_foot_distal_phalanx_1`–`5` |

**Editing a drawing:** name the Illustrator layers with these IDs so a re-export keeps them, and check that no `_x5F_` or `-2` suffixes come through. `npm test` fails if any ID in a drawing breaks the convention.

**Renaming an ID later:** saved records and exported CSV files keep the old ID. Add a new database version in `src/db/db.ts` that moves them, and an entry in `src/pages/legacySegmentIds.ts`. That table already maps every ID used before this convention to its new one.

**The CSV export:** the INVENTORY table has one row per bone or zone, head to toe. Each row has `Region`, `Bone`, `Side`, `Zone` and `Segment ID`, then a column per specimen holding complete, absent or fragmentary. `Whole bone` in the Zone column means the mark is on the bone itself. A mark on a whole region (Select All, a whole hand) is listed as each bone it covers. Import reads the `Segment ID` column. Files from before this convention, which have a single `Bone` column of old IDs, still import.

## GitHub workflow

**`main` is always in a working, demoable state. Nobody commits directly to `main`. Branch protection means you physically can't push straight to `main` or merge without going through a pull request — but approval isn't required, so a PR can be merged without another person reviewing it first.**

1. **Sync before starting work**
   ```bash
   git checkout main
   git pull
   ```
2. **Branch per task**, off `main`:
   ```bash
   git checkout -b <type>/<short-description>
   ```
   Types: `feat`, `fix`, `chore`, `docs`, `refactor`. Examples: `feat/bone-svg-selection`, `fix/csv-export-encoding`, `chore/prettier-config`.
3. **Keep PRs small** — one feature or fix per branch. Small PRs get reviewed faster and are easier to debug if something breaks.
4. **Save your changes as you go**:
   ```bash
   git status              # see what you've changed
   git add <file>          # stage specific files (avoid `git add .` unless you've checked git status first)
   git commit -m "<message>"
   ```
   **Commit messages**: short, imperative summary (`Add zone selection to spine SVG`, not `updates`).
5. **Before opening a PR**:
   ```bash
   npm run lint
   npm run build
   ```
   Fix anything that fails. If your branch has fallen behind `main`, merge it in:
   ```bash
   git checkout main
   git pull
   git checkout <your-branch>
   git merge main
   ```
   Resolve any conflicts, then commit.
6. **Push your branch and open the PR**:
   ```bash
   git push -u origin <your-branch>
   ```
   Click the "Compare & pull request" button GitHub shows on the repo page. Set the base branch to `main`. In the description, note *what* changed and *why*, and link the relevant task/issue if one exists. Request a review from at least one teammate — GitHub won't block the merge if no one reviews, but try to get a second set of eyes anyway.
7. **Address any review comments**, then merge. **Squash and merge** is the only option GitHub allows on this repo.



