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

There's no `src/components/` folder yet — as soon as more than one person is building UI, agree on a structure (e.g. `src/components/`, `src/hooks/`, `src/lib/`) before it grows organically.

## 6. GitHub workflow

**`main` is always in a working, demoable state. Nobody commits directly to `main`.**

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
4. **Commit messages**: short, imperative summary (`Add zone selection to spine SVG`, not `updates`).
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
   Click the "Compare & pull request" button GitHub shows on the repo page. Set the base branch to `main`. In the description, note *what* changed and *why*, and link the relevant task/issue if one exists. Request a review from at least one teammate. Don't merge your own PR without another set of eyes.
7. **Address review comments**, then merge once approved. Use **Squash and merge**.



