# 📈 EconomicsPortal

A free class portal and gradebook for **Dr. Numan's Economics Class** (17 members across 4 teams), built by **Shehroz's team**.

Live site: **https://GucciCreates.github.io/EconomicsPortal/**

It runs entirely for free:
- **Frontend:** plain HTML, CSS and JavaScript modules (no framework), served by **GitHub Pages** from the `/docs` folder. Installable on phones as an app.
- **Backend:** a **Google Apps Script** web app backed by a **Google Sheet** on `bahriabatch30@gmail.com`. No server, no database hosting, no credit card.

---

## 👥 Roles

Names and PINs live only in the private Google Sheet. Each person gets their PIN from the group leader and can change it from the account menu (top right).

| Role | What they can do |
| :--- | :--- |
| **Instructor** | Everything the group leader can see; edit and **delete** marks; activity log |
| **Group leader** | Assign tasks, enter and edit marks, announcements, quizzes, support plans, resolve doubts, reset PINs, activity log |
| **Assistant** | Enter and edit marks, reply to doubts, view everything |
| **Team leader** | Record marks, forward submissions for grading, team notices, reply to team doubts, submission tracker — **own team only** |
| **Student** | Submit work, set a goal, ask doubts, see **own** marks and the class leaderboard |

---

## 🔐 Security model (v6)

- **Signed sessions.** Signing in with name + PIN returns a session token signed with HMAC-SHA256 (secret kept in the Apps Script project's Script Properties, never in code). Tokens are renewed automatically while in use and expire after 7 days without use.
- **The server decides who you are.** Every request carries the token, and the backend looks up name, role and team in the Users sheet. Anything the browser claims is ignored.
- **Scoped access.** Team leaders can only act on their own team; students only on themselves. Students receive only their own marks plus a leaderboard summary of classmates.
- **PINs** are 4–8 digits, stored as salted SHA-256 hashes and never sent to the browser. The instructor, group leader and assistant must choose at least 6 digits. Changing or resetting a PIN signs that person out everywhere.
- **Login locks that can't be used against you.** Wrong PINs for a name lock it for 1, then 5, 15 and 60 minutes. A device that has signed in as that person before keeps its own counter, so guesses from elsewhere can't lock the real person out. Every lock is in the AuditLog, and a locked leader account emails the owner (at most once a day).
- **Content Security Policy.** The page may only load code from this site and talk to Google Fonts and the Apps Script backend.
- **Demo Mode is separate.** It only starts from a `?demo=1` link, lasts for that browser tab, and is marked "Sample data" everywhere. The live site never falls back to it.
- **Validation & integrity.** Inputs are checked on the server; writes run under a lock; every change is recorded in **AuditLog**; text is stored literally so it can't run as a formula (CSV exports are protected the same way).
- **No script injection.** Everything users type is escaped before it's shown.

---

## ✨ Features

- **Fast:** signing in and every save are one request to Google; sheet reads are cached; the last dashboard shows instantly on refresh; the sign-in page loads 11 small files.
- **Role dashboards** with six tabs each (instructor, group leader, assistant, team leader, student).
- **Marks ledger** grouped by unit (newest first), filters, report cards (print/PDF), CSV export, charts and leaderboards. On phones each mark is a compact card.
- **Quick mark entry:** remembers the last unit, Enter moves to the next field, "Save and add another".
- **Tasks & submissions** with a tracker of who is on time, late or missing.
- **"This week"** deadline strip for students; "New" badges since your last visit.
- **Doubts with replies**, announcements, quiz countdowns, goals, team noticeboard, support plans.
- **Email (optional, free):** daily deadline reminders for students who turn them on, and a Monday summary for Dr. Numan.
- **Activity log**, **Change my PIN**, **Reset PIN**, weekly **backups** to Drive.
- **Installable app (PWA)**, light "graph paper" and dark "chalkboard" themes, accessible (WCAG AA).

---

## 🚀 Quick start (local)

```bash
npm run dev          # serves the repo at http://localhost:3000
```

Open the site with `?demo=1` (for example `http://localhost:3000/?demo=1`) to use **Demo Mode**: sample data that lives only in that browser tab and is never saved. Demo Mode enforces the same rules as the real backend, and the quick sign-in buttons appear only there.

## ⚙️ Connecting / upgrading the backend

Follow [**SETUP_GUIDE.md**](./SETUP_GUIDE.md). If you're upgrading an existing v3 install, read its **"Upgrading to v4"** section. Everyone's PINs need resetting, and everyone will have to sign in again.

## 🌐 Deploying to GitHub Pages

1. Make changes in `index.html`, `css/`, `js/` (never edit `docs/` by hand).
2. Run `npm run build`. This syncs everything into `docs/` and removes files that no longer exist.
3. Commit and push to `main`. GitHub Pages serves `main` → `/docs` (Settings → Pages).
4. When releasing, bump the `?v=` numbers in `index.html` and `CACHE_VERSION` in `sw.js` together (a test checks they match).

Every pull request runs the tests on GitHub Actions (free for public repositories), including a check that `docs/` is up to date.

## 🧪 Tests

```bash
npm test             # backend tests (Code.gs under Node with fake Apps Script services), PWA checks, syntax check
```

```bash
npm run test:e2e     # browser tests with Playwright: every role and tab, XSS, phone width, one-request sign-in, demo isolation
```

---

## 📁 Repository structure

```
EconomicsPortal/
├── backend/Code.gs              # Apps Script backend (auth, API, caching, email, migrations, backups)
├── css/style.css                # All styles (graph-paper light / chalkboard dark)
├── docs/                        # Built copy served by GitHub Pages (npm run build)
├── icons/                       # App icons
├── js/
│   ├── app.js                   # Boot, header, routing, dashboard loading and caching
│   ├── api.js                   # API client: token, renewal, dashboard cache
│   ├── auth.js                  # Session + device ID
│   ├── config.js                # API_URL and Demo Mode (?demo=1)
│   ├── dates.js                 # The one date formatter (relative + full date tooltip)
│   ├── demoServer.js            # Demo Mode backend (loaded only in Demo Mode)
│   ├── mockData.js              # Demo sample data
│   ├── lastSeen.js, utils.js
│   ├── vendor/chart.umd.js      # Chart.js 4.4.4 (MIT), loaded only when a chart is shown
│   └── components/
│       ├── groupLeaderView.js, teamLeaderView.js, memberView.js   # dashboard shells
│       ├── tabs/                # one module per tab (gl*, tl*, mem*)
│       ├── ui.js                # shared helpers: event delegation, actions, empty states
│       └── …                    # shared panels (announcements, quizzes, doubts, report card, …)
├── tests/                       # backend + PWA tests; tests/e2e/ Playwright tests
├── .github/workflows/ci.yml     # tests on every pull request
├── build.js, index.html, manifest.webmanifest, sw.js, package.json
├── README.md
└── SETUP_GUIDE.md
```
