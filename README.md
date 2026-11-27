# 📈 EconomicsPortal

A free class portal and gradebook for **Dr. Numan's Economics Class** (17 members across 4 teams), built by **Shehroz's team**.

Live site: **https://GucciCreates.github.io/EconomicsPortal/**

It runs entirely for free:
- **Frontend:** plain HTML, CSS and JavaScript modules (no framework), served by **GitHub Pages** from the `/docs` folder. Installable on phones as an app.
- **Backend:** a **Google Apps Script** web app backed by a **Google Sheet** on `bahriabatch30@gmail.com`. No server, no database hosting, no credit card.

---

## 👥 Roster & roles

PINs are private. Each person gets theirs from the group leader, and can change it from the account menu (top right) after logging in.

| Role | Name | Team | What they can do |
| :--- | :--- | :--- | :--- |
| **Instructor** | Dr. Numan | — | Everything the group leader can see; edit and **delete** marks; activity log |
| **Group Leader** | Shehroz | Shehroz | Assign tasks, enter/edit marks, announcements, quizzes, mentorship, resolve doubts, reset PINs, activity log |
| **Assistant** | Sajal | Shehroz | Enter and edit marks, reply to doubts, view everything |
| **Team Leader** | Amina, Ayesha (Quetta), Lareb | own team | Record marks, forward submissions for grading, team notices, reply to team doubts, submission tracker — **own team only** |
| **Member** | Ramesh, Mamoon, Tazneem, Minal, Anika, Ahmed bin Nasir, Shaiman, Aisha Amjad, Haseeb, Gorsi, Haris | own team | Submit work, set a goal, ask doubts, see **own** marks and the class leaderboard |

---

## 🔐 Security model (v4)

- **Signed sessions.** Logging in with name + PIN returns a session token signed with HMAC-SHA256 (secret kept in the Apps Script project's Script Properties, never in code). Tokens expire after 7 days.
- **The server decides who you are.** Every request carries the token, and the backend looks up your name, role and team in the Users sheet. Anything the browser claims (`role`, `editedBy`, `team`, …) is ignored.
- **Scoped access.** Team leaders can only act on their own team; members only on themselves. Members receive only their own marks plus a leaderboard summary of classmates (name, team, average, streak, trend).
- **PINs are hashed** (salted SHA-256) and never sent to the browser — not even to the group leader. Changing or resetting a PIN signs that person out everywhere.
- **Brute-force protection.** 5 wrong PINs for a name lock it for 15 minutes.
- **Validation & integrity.** Inputs are checked on the server (score 0–100, rating 1–5, lengths, teams, `http(s)` links only). Writes run under a lock. Every change is recorded in the **AuditLog** sheet.
- **No script injection.** Everything users type is escaped before it's shown, and text is stored in the sheet literally, so it can't run as a formula.

---

## ✨ Features

- **Role dashboards** for instructor/group leader/assistant, team leaders and members.
- **Gradebook ledger** with filters, report cards (print/PDF), CSV export, charts and a class leaderboard.
- **Tasks & submissions**, plus a **submission tracker** showing who is on time, late or missing, with a "copy reminder list" button.
- **Deadline strip** for students: overdue tasks in red, plus tasks and quizzes due in the next 7 days.
- **"New since your last visit"** badges on tabs and "New" pills on items.
- **Doubts with replies:** leaders reply in a thread, and students see replies and when a doubt is resolved.
- **Announcements, quiz scheduler with live countdowns, goals, team noticeboard, peer-mentorship plans.**
- **Activity log** (instructor & group leader): who changed what, when, with before → after for mark edits.
- **Change my PIN** for everyone; **Reset PIN** for the group leader.
- **Installable app (PWA):** add it to your home screen; the app shell opens offline. Student data is never cached.
- **Weekly backups** of the spreadsheet to Google Drive (keeps the last 8).
- **Accessible:** labelled forms, WCAG AA contrast in light and dark themes, keyboard-friendly tabs, menus and dialogs.

---

## 🚀 Quick start (local)

```bash
npm run dev          # serves the repo at http://localhost:3000
```

Without a live backend, the app runs in **Demo Mode** with sample data in your browser. Demo Mode enforces the same rules as the real backend. The quick-login buttons on the sign-in screen appear **only in Demo Mode**. To try Demo Mode against the live site, click "Continue in Demo Mode" after a connection error.

## ⚙️ Connecting / upgrading the backend

Follow [**SETUP_GUIDE.md**](./SETUP_GUIDE.md). If you're upgrading an existing v3 install, read its **"Upgrading to v4"** section. Everyone's PINs need resetting, and everyone will have to sign in again.

## 🌐 Deploying to GitHub Pages

1. Make changes in `index.html`, `css/`, `js/` (never edit `docs/` by hand).
2. Run `npm run build`. This syncs everything into `docs/` and removes files that no longer exist.
3. Commit and push to `main`. GitHub Pages serves `main` → `/docs` (Settings → Pages).
4. When releasing, bump the `?v=` numbers in `index.html` and `CACHE_VERSION` in `sw.js` together (a test checks they match).

## 🧪 Tests

```bash
npm test             # backend tests (Code.gs under Node with fake Apps Script services), PWA checks, syntax check
```

```bash
npm run test:e2e     # browser tests with Playwright: every role, every tab, XSS checks, phone width
```

---

## 📁 Repository structure

```
EconomicsPortal/
├── backend/
│   └── Code.gs                  # Apps Script backend (auth, API, migrations, backups)
├── css/style.css                # All styles (dark/light themes, responsive)
├── docs/                        # Built copy served by GitHub Pages (npm run build)
├── icons/                       # App icons (SVG + PNG) for the PWA and favicon
├── js/
│   ├── app.js                   # Boot, header, routing, theme, session-expiry handling
│   ├── api.js                   # API client: attaches the session token to every call
│   ├── auth.js                  # Session storage (name, role, team, token)
│   ├── config.js                # API_URL of the Apps Script web app
│   ├── demoServer.js            # In-browser backend for Demo Mode (same rules as Code.gs)
│   ├── lastSeen.js              # "New since your last visit" tracking
│   ├── mockData.js              # Demo sample data
│   ├── utils.js                 # escapeHtml / safeUrl / linkHtml helpers
│   └── components/
│       ├── accountMenu.js       # Header menu: Change my PIN, Log out
│       ├── activityLog.js       # Audit log tab
│       ├── announcementsPanel.js
│       ├── charts.js            # Chart.js charts
│       ├── doubtThread.js       # Doubts with replies (all roles)
│       ├── editModals.js        # Edit mark / edit task dialogs
│       ├── exportUtils.js       # CSV export
│       ├── goalPanel.js
│       ├── groupLeaderView.js   # Instructor / group leader / assistant dashboard
│       ├── leaderboard.js
│       ├── loginView.js
│       ├── memberView.js        # Student dashboard
│       ├── mentorshipPanel.js
│       ├── metricsPanel.js
│       ├── modal.js             # Accessible dialogs (focus trap, Esc)
│       ├── quizScheduler.js
│       ├── reportCardModal.js
│       ├── submissionTracker.js
│       ├── tabNav.js            # Tabs with "N new" badges and keyboard support
│       └── teamLeaderView.js    # Team leader dashboard
├── scripts/check-syntax.js      # node --check on every JS file
├── tests/
│   ├── backend.test.js          # Backend tests
│   ├── gasFakes.js              # In-memory Apps Script fakes
│   ├── pwa.test.js              # Service worker / manifest checks
│   └── e2e/                     # Playwright tests (npm run test:e2e)
├── build.js                     # Syncs the site into /docs
├── index.html
├── manifest.webmanifest         # PWA manifest
├── sw.js                        # Service worker (app shell only)
├── package.json
├── README.md
└── SETUP_GUIDE.md
```
