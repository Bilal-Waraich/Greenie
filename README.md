# Greenie

Greenie is a mobile-first web app where students in Zürich log eco-friendly actions, earn points and daily streaks, and (from milestone 2) follow each other and compare weekly leaderboards.

This README covers milestone 1: registration and login, Home, logging actions with daily limits, streaks, and the action configuration file. It will be completed at milestone 2.

**Live site:** published by GitHub Pages from this repository. The address is shown under Settings → Pages, and at the end of every run of the Deploy workflow (Actions tab).

## Stack

- **Front end:** React 19 with Vite (plain JavaScript), React Router, and `@supabase/supabase-js`. Plain CSS. The fonts (Inter, Pixelify Sans) are served from the site itself; no third-party fonts, trackers or CDNs.
- **Back end:** Supabase free plan (Postgres and Auth) in an EU region (Ireland). All rules (points, daily limits, streaks, privacy) are enforced in the database by Postgres functions; tables are closed to direct access.
- **Hosting:** GitHub Pages (static files), deployed by GitHub Actions on every push to `main`.

## Repository layout

```
actions.json          the action list (edit this to change actions, points, limits; see below)
guide.json            the "Which bin in Zürich?" guide content (used from milestone 2)
badges.json           badge definitions (not used yet)
privacy_text.txt      the privacy text: short text on Register, full notice on the Privacy page (see below)
frontend/             the web app (React + Vite)
  src/                pages, components, lib (API calls, validation, formatting), styles, Figma sprites
  scripts/            local helpers: database reset, demo data, build step
  tests/unit/         unit tests (Node's test runner)
  tests/e2e/          browser tests (Playwright)
supabase/             the database
  migrations/         SQL migrations: tables, access rules, functions
  tests/database/     database tests (pgTAP)
  config.toml         local development settings only
scripts/              checks actions.json and privacy_text.txt, loads actions.json (used by the deploy and locally)
.github/workflows/    the deploy workflow
```

Front end and back end are separate: the front end only calls the database functions in `supabase/migrations/*_api.sql`.

## Run it locally

Prerequisites: Node.js 22, Docker (running), the Supabase CLI (2.120.0 was used), and `psql`.

```
supabase start                     # in the repository root; the first start downloads Docker images
cd frontend
npm install
npm run db:reset                   # builds the local database from the migrations and loads actions.json
npm run seed:local                 # optional: 25 demo students with logs (prints their shared password)
```

Create `frontend/.env.development.local` from `frontend/.env.example`, with the local API URL and publishable key printed by `supabase status`. Then:

```
npm run dev                        # http://127.0.0.1:5273
```

Local addresses (this project uses the default Supabase ports plus 2000, so it can run next to another local Supabase project): API `http://127.0.0.1:56321`, database `postgresql://postgres:postgres@127.0.0.1:56322/postgres`, Studio `http://127.0.0.1:56323`, email viewer `http://127.0.0.1:56324`.

Demo accounts after `npm run seed:local`: `demo01@greenie.test` to `demo25@greenie.test`, all with the password the script prints. They exist only in your local database.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. checks `actions.json` and `privacy_text.txt` (stops with a message naming the problem if one is invalid);
2. builds the front end with the Supabase URL and publishable key from the repository variables;
3. applies new database migrations to the Supabase project;
4. loads `actions.json` into the database;
5. publishes the site to GitHub Pages.

If any step fails, the site is not updated; the Actions tab shows which step and why. The workflow can also be started by hand there ("Run workflow").

Repository settings it needs (Settings → Secrets and variables → Actions):

| Name | Kind | Value |
|---|---|---|
| `SUPABASE_URL` | Variable | the Project URL from Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Variable | the publishable key (or the anon key) from Supabase; public by design |
| `SUPABASE_DB_URL` | Secret | the "Session pooler" connection string, with the database password filled in |

Also Settings → Pages → Source: "GitHub Actions".

Supabase project settings (Authentication): "Confirm email" off (sign-up confirmation is out of scope, and new students land on Home straight away), minimum password length 8, custom SMTP with the project's Gmail account (for password reset emails in milestone 2), and URL Configuration with the site's address as Site URL and that address followed by `**` as a redirect URL.

## Editing the action list (`actions.json`)

`actions.json` is a list of actions. The order in the file is the order on the Log screen. Each action has exactly these fields:

| Field | Meaning | Rule |
|---|---|---|
| `key` | permanent id of the action | 1–50 characters: lowercase letters, digits, underscore; unique |
| `label` | text shown in the app | 1–200 characters |
| `points` | points per log | whole number, at least 1 |
| `daily_limit` | how often a student can log it per day (Zürich calendar day) | whole number, at least 1 |
| `co2_g` | estimated CO₂ saving per log, in grams | whole number, 0 or more |

To change actions, edit `actions.json` on GitHub (or locally) and commit to `main`. The deploy checks the file, loads it into the database and republishes the site; the Log screen shows the change a few minutes later, with no code change.

- **Change a label, points, limit or CO₂ value:** applies to new logs from then on. Past logs keep the points and CO₂ value they had when they were logged.
- **Remove an action:** it disappears from the Log screen. Past logs of it still count.
- **Change a key:** counts as removing one action and adding a new one. Keep keys stable.
- **Add an action:** it appears on the Log screen. The eight original actions have their own pixel icon; any other action shows the leaf icon.
- **A mistake in the file** (missing field, unknown field, duplicate key, 0 points, text instead of a number): the deploy stops at "Check actions.json and privacy_text.txt" with a message naming the entry, and nothing changes. Fix the file and commit again.

Locally, run `npm run db:reset` in `frontend/` after editing the file (this also deletes local test data), or load just the actions with:

```
node scripts/actions-to-sql.mjs | psql "postgresql://postgres:postgres@127.0.0.1:56322/postgres" -v ON_ERROR_STOP=1
```

## Editing the privacy text (`privacy_text.txt`)

The app shows this file word for word, read from the repository when the site is built:

- **Part A** (between the "PART A" and "PART B" headings): the short text appears above the consent checkbox on the registration screen, and the text after the line `Checkbox label:` is the checkbox's label. The words "privacy notice" in the label link to the Privacy page, which opens in a new tab.
- **Part B** (after the "PART B" heading): the full notice on the Privacy page (`/privacy`), open to everyone. The first line is the page title; a line starting with a number and a full stop ("1. Who is responsible") starts a section; a line starting with "- " starts a list item, and indented lines continue it; a blank line starts a new paragraph. Email addresses become email links.

Lines can be wrapped anywhere: lines of one paragraph are joined. Edit the file and commit to `main` like `actions.json`; the site shows the new text after the deploy. The deploy stops at "Check actions.json and privacy_text.txt", and nothing changes, if a "PART A" or "PART B" line, the `Checkbox label:` line, the short text or the words "privacy notice" in the label are missing.

## Editing the guide (`guide.json`)

Used from milestone 2. Each entry has `item`, `where` and `note`.

## Data stored and privacy

- **Supabase Auth** stores each account's email and password, the password only as a salted bcrypt hash. Supabase Auth also keeps its own logs (for example sign-in times and IP addresses), and a copy of the sign-up fields in the account's own metadata, which only that account can read.
- **Database tables:** `users` (nickname, first name, last name, date of birth, university, created at), `action_logs` (action, points, CO₂ grams, time in UTC, Zürich date), `follows` (milestone 2), `actions` (loaded from `actions.json`).
- **What other students see** (from milestone 2): only nickname, university, points and streak. No database function returns anyone's email, first name, last name or date of birth; the database tests check this for every function.
- Tables can't be read or written directly through the API (row-level security without policies, and no privileges for the API roles). The browser can only call four functions in milestone 1.
- No analytics, trackers or third-party requests. Data is stored in the EU (Ireland).
- The privacy text students agree to is Bean Co.'s `privacy_text.txt` (see above).

## Keeping it running

Supabase pauses a free project after a period of low activity. Supabase's documentation says "typically a few user requests to the database each day over the previous week is enough to keep the project from being paused". Supabase emails a warning about a week before pausing; opening the project in the Supabase dashboard after the warning prevents the pause. A paused project can be restored from the dashboard (see Supabase's guide on paused projects). The deployed site must stay reachable until at least 15 November 2026.

## Restoring from scratch

The free plan has no backups. If the project is lost: create a new Supabase project in an EU region (this one is in Ireland), apply the Auth settings above, update the three GitHub settings, and run the Deploy workflow. The migrations and `actions.json` rebuild everything except user accounts and logs. Demo data for local work comes from `npm run seed:local`.

## Email

Password reset (milestone 2) sends email through the project's own Gmail account via Supabase's custom SMTP. Limits: Gmail about 500 emails a day; Supabase's custom SMTP 30 emails per hour by default (adjustable in the dashboard). Sign-up sends no email.

## Tests

Run from `frontend/` unless noted; the local Supabase stack must be running.

| Kind | Command | What it covers |
|---|---|---|
| Database | `supabase test db` (repository root) | access rules and privacy, sign-up validation, points and daily limits, streaks, weeks, the `actions.json` loader |
| Unit | `npm run test:unit` | form validation, formatting, error messages, `actions.json` rules, reading `privacy_text.txt` word for word |
| Browser | `npm run test:e2e` | registration, the privacy text and Privacy page, login, logout, route guards, logging, limits, streaks, `actions.json` changes, privacy, accessibility (axe), no horizontal scrolling at 360–1280 px |

The browser tests need Playwright's browsers once: `npx playwright install chromium firefox webkit`.

The brief's six streak test cases (US-04) are the tests named "US-04 case 1" to "US-04 case 6" in `supabase/tests/database/streak.test.sql`. They use logs on Mon 26 to Fri 30 October 2026, check the 23:59/00:01 case in both winter and summer time, and also cover the clock change on 25 October 2026.

## After handover

- Change the database password in Supabase and update the `SUPABASE_DB_URL` secret.
- Remove the developer's access to the repository and the Supabase project.

## AI use

See [AI-DECLARATION.md](AI-DECLARATION.md).
