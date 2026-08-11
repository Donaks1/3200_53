# Contributing to OsteoMap (Team 53)

This document is the team's shared reference for how the project is set up and how we work together on GitHub. Read it once, then keep it open as a reference for your first few PRs.

## 1. What this project is

**OsteoMap** is a browser-based skeletal inventory tool built for CITS3200 Group 53's client (see [`meeting-minutes/`](meeting-minutes/)). Users colour-code bone completeness (complete / fragmentary / absent) on adult front/back skeleton diagrams, then export the case as CSV, JPEG, or PDF, and can re-import a CSV to reconstruct a previous case. No account system or backend — everything runs client-side in the browser.

## 2. Repo layout

```
3200_53/
├── osteomap/                    # the actual app — this is where you'll spend ~all your time
├── meeting-minutes/             # chair/minute-taker notes from each team meeting
├── client-communication-evidence/  # email threads with the client
├── drafts-and-planning/         # Figma mockups and early planning docs
└── README.md
```

## 3. Stack

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

## 4. Local setup

```bash
nvm use                # picks up Node 24 from osteomap/.nvmrc — cd into osteomap first
cd osteomap
npm install
npm run dev             # starts the Vite dev server
```

Other useful scripts (run from `osteomap/`):

```bash
npm run lint      # ESLint
npm run build     # type-check (tsc -b) + production build
npm run preview   # preview the production build locally
```

Run `npm run lint` and `npm run build` before opening a PR — both should pass cleanly.

## 5. Main files you'll actually edit

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
   Fix anything that fails. Rebase or merge `main` into your branch if it's fallen behind.
6. **Open the PR against `main`.** In the description, note *what* changed and *why*, and link the relevant task/issue if one exists. Request a review from at least one teammate — don't merge your own PR without another set of eyes.
7. **Address review comments**, then merge once approved. Use **Squash and merge** (keeps `main`'s history one commit per PR — the repo currently allows merge commits and rebase too, but squash is easiest to read back through later).
8. **Delete the branch after merging** (GitHub will prompt you — branch auto-delete isn't turned on for this repo yet, so this is a manual step for now).

**Handling conflicts:** if two people are touching the same file (`index.css`, `App.tsx`, `package.json` are the likely hotspots early on), give the team a heads-up in chat before starting, and pull `main` into your branch often rather than waiting until the PR to find out.

## 7. Recommended GitHub settings (not yet enabled)

Worth turning on as a team once everyone's ready to start branching (Settings → Branches, and Settings → General on GitHub):

- **Branch protection on `main`**: require a pull request before merging, require at least 1 approval.
- **Delete head branches automatically** on merge (General settings) — saves the manual cleanup step above.
- Once CI exists (see below), require it to pass before merging.

## 8. Setup gaps to close as a team

Found while reviewing the current state of the repo — none are blocking, but worth assigning before the team starts branching in parallel:

- [ ] No branch protection on `main` — anyone can currently push directly or force-push.
- [ ] `osteomap/README.md` is still the unmodified Vite template README — should describe OsteoMap instead.
- [ ] Root `README.md` is just `# 3200_53` — worth a short project description + link into `osteomap/`.
- [ ] No CI (GitHub Actions) — `lint`/`build` aren't checked automatically on PRs yet.
- [ ] `prettier` is installed but there's no config file (`.prettierrc`) or `format` script, so formatting isn't actually enforced.
- [ ] Stray asset file `osteomap/src/assets/skeleton_front(placeholder) copy.svg` — looks like an accidental Finder duplicate (space + parens + "copy" in the filename); clean up before it's imported somewhere by accident.
- [ ] No test setup yet (no runner, no `test` script) — fine for now, but decide as a team if/when this is needed before the MVP deadline.
- [ ] `.nvmrc` pins Node 24 — worth everyone confirming `node -v` matches before their first `npm install`, to avoid dependency resolution differences across machines.

Happy to help wire up any of these (CI workflow, branch protection, README content, Prettier config) — just say which ones.
