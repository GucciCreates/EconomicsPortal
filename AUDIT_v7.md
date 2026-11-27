# EconomicsPortal audit (v7)

Audited on 2026-11-27, on branch `improve/v7-self-review`. The branch is built on PR #5 (Google sign-in and the animated chart), which is still open.

**How:**
- Demo Mode walk-through of all 5 roles, at 1280 px and 390 px, in both themes.
- `backend/Code.gs` run in Node with the test fakes.
- Lighthouse 12 (free, offline) against `docs/` served locally.
- axe-core on every tab of every role in both themes.
- Scripted experiments for timeouts, bad server replies, two people editing at once, and what each role can read.
- Static checks: test coverage per action, function length, hard-coded names.

The live site and Apps Script server are blocked from this environment, so nothing here was measured against production.

**Key:**
- **Impact** is who it hurts and how badly: H high, M medium, L low.
- **Effort** is how much work the fix is: S small, M medium, L large.
- **Rank** is impact ÷ effort, after the "needs your OK" items are put where a decision is required.

## What is already good

- **Demo Mode matches the real server.** I called all 29 actions as all 5 roles on both. The same 145 calls are allowed or refused. *(Evidence: the permission matrix below.)*
- **Dashboards have the same shape.** For every role, the dashboard has the same keys in Demo Mode as from `Code.gs`.
- **Lighthouse scores:**

  | | Performance | Accessibility | Best practices | SEO |
  | :--- | ---: | ---: | ---: | ---: |
  | Mobile | 96 | 100 | 96 | 100 |
  | Desktop | 100 | 100 | 96 | 100 |

  The page weighs 258 KB. On mobile it paints in 1.8 s, reaches the largest element in 2.3 s, and shifts layout by 0.076. The "compression" and "cache" warnings come from my local test server; GitHub Pages already compresses files and sets caching.
- **Team scoping holds.** A member can't see another team's tasks, marks, notes or doubts, and a team leader can't read another team's marker notes.
- **Editing a mark only sends the fields that changed,** so two people editing *different* fields don't overwrite each other.

## Findings

| ID | Finding | Evidence | Who it hurts | Impact | Effort | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| F1 | **Demo Mode uses the class's real names** and puts made-up failing marks, "needs support" flags, support plans and doubts on real students. Anyone with the link can see them. | `js/mockData.js:9-23` (roster), `:75-98` (marks, e.g. Mamoon 48 → 46, Anika 45 → 44), `:127-164` (support plan for Mamoon; doubts by Anika, Mamoon, Haseeb). Screenshot: the team-leader view says "Mamoon needs support". | The named students: invented bad results are published under their names. | H | S | **fixed** `fb0d59f`: fictional student names; `tests/privacy.test.js` |
| F2 | **The demo PINs are the class's original real PINs.** They were first published in the v1 README and are now shown again next to the real names. | `git show 9efcbff:README.md` lines 15-19 (Dr. Numan `0000`, Shehroz `1111`, Ramesh `2002`). `js/demoServer.js:374` prints "Demo PINs: Shehroz 1111, Dr. Numan 0000 …". | Everyone, **if `resetAllPins()` was never run** after the v4 upgrade. Then anyone can sign in to the live site as the group leader. | H | S | **fixed** `76df8cf` (you chose: block them): refused at sign-in and can never be set again; server and Demo Mode |
| F3 | **The full roster ships in public JavaScript:** every student's name and team, as a fallback that is no longer needed. | `js/components/ui.js:14-19` (`TEAM_ROSTER`), used only by `teamLeaderView.js:38`. The server already sends `roster`. | Students' privacy. It defeats the README clean-up. | H | S | **fixed** `f60e98d`: roster comes only from the server; privacy test |
| F4 | **Sign-in hangs forever if the server never answers.** There is no time limit on any request. | `flaky.js`: after 20 s the button still says "Signing in…" and there is no message. `api.js` `postToAppsScript` has no `AbortController`. | Everyone, whenever Apps Script stalls (cold start, Google outage, bad network). | H | S | **fixed** `a800a1f`: 30 s limit, then a message and **Try again** |
| F5 | **A web page instead of data is reported as "Can't reach the class server".** This happens when Google returns an HTML quota or maintenance page. | `flaky.js`: a 200 HTML reply shows "Can't reach the class server right now…". `api.js` calls `response.json()` without checking. | Anyone who hits Google's daily limit is told their connection is the problem. | M | S | **fixed** `a800a1f`: quota and odd replies explained; shared `describeApiError()` |
| F6 | **Every student sees every classmate's exact average,** including the lowest, on the Leaderboard. | `leak.js`: member Ramesh's dashboard has `memberMetrics.Minal.avgScore = 31`. `memLeaderboard.js:8` renders all of it. | Struggling students. It's a design decision, so it's yours to make. | M | M | **fixed** `0faaa02` (you chose: top 5 + own place): only those rows are sent to students |
| F7 | **Only the group leader can reset a PIN.** The instructor can't. | Permission matrix: `updatePin` is refused for the instructor. | Anyone locked out while Shehroz is away. Only the sheet owner can then help, from Apps Script. | M | S | **fixed** `fe2b889` (you chose: yes) |
| F8 | **7 backend actions have no tests at all:** `addQuiz`, `deleteQuiz`, `deleteAnnouncement`, `pinAnnouncement`, `editTask`, `createMentorshipPlan`, `updateMentorshipStatus`. | Coverage scan: each action name vs `tests/backend.test.js`. 0 references for these 7. | Future changes: two of them delete data. | M | M | **fixed** `706b383`: 4 behaviour tests; all 7 actions were already correct |
| F9 | **No test keeps Demo Mode's permissions in step with the server.** They match today, but nothing stops drift. | The permission matrix (below) was produced by a throwaway script. | Every role, the next time someone edits one side only. | M | S | **fixed** `7531770`: `tests/permissions.test.js`; breaking a rule on either side fails it |
| F10 | **No one is told when the live site or server is down.** | There is no scheduled check; CI only runs on pull requests. | Everyone, and the owner finds out last. | M | S | **fixed** `6f1d6e8`: `.github/workflows/health.yml`, daily |
| F11 | **People and class shape are hard-coded in the UI.** Changing group leader, assistant, instructor or team count means editing code. | "Ask Shehroz" (`loginView.js:143`); "Shehroz and Sajal will see it" (`tlSubmissions.js:64`); report-card signatures (`reportCardModal.js:129-130`); "4 teams" (`groupLeaderView.js:65`); "seventeen students" (`loginView.js:31`); `TEAMS` in 3 files. | The class next term: wrong names on report cards and help text. | M | M | deferred: medium effort, not in this round. Suggested next. |
| F12 | **No performance budget in CI.** The sign-in page could quietly grow, or gain extra requests. | `.github/workflows/ci.yml` checks correctness only. | Students on slow phones. | M | S | **fixed** `5d285a7`: `tests/e2e/budget.e2e.js`, `tests/budget.json` |
| F13 | **Countdowns are shown twice on deadline cards.** | Screenshot `member-overview.png`: "in 2d 23h" right above "in 3 days". | Members, every visit. | L | S | **fixed** `61e8313` |
| F14 | **Headings skip a level** (h1 → h3) on every dashboard tab. | axe `heading-order` on 56 of 60 tab views; e.g. `.at-risk-title`, `.card-header h3`. | Screen-reader users, who navigate by headings. | L | S | **fixed** `3b8cb2d`: axe `heading-order` 56 → 0; the new test fails on any skip |
| F15 | **Real errors in people's browsers are invisible to the owner.** There is no error reporting. | Nothing in `app.js` sends `window.onerror` or `unhandledrejection` anywhere. | The owner, who only hears about bugs by word of mouth. | M | M | deferred: not chosen this round. The daily health check covers outages, not in-browser errors. |
| F16 | **The "Choose a longer PIN" note appears on every Demo Mode sign-in,** in every role. | Screenshots `member-overview.png`, `team_leader-members.png`. | Visitors trying the demo: noise above the content. | L | S | deferred: low impact. The demo leader accounts now use 6-digit PINs, so only demo students still see the note. |
| F17 | **The Demo Mode bar sits outside page landmarks.** | axe `region` on every Demo Mode view (`.demo-banner > span`). | Screen-reader users in Demo Mode only. | L | S | **fixed** `d4d71b5`: axe now reports 0 violations everywhere (it was needed to meet the "done" bar) |
| F18 | **The last save wins when two people change the same field of a mark at the same time.** | `race.js`: both saves succeed and the second one overwrites. The activity log keeps both values. | Rare: two markers fixing the same score at once. | L | M | deferred: rare, and the audit log keeps both values |
| F19 | **Demo Mode's dashboard builder duplicates `Code.gs`** in about 200 lines. Today the keys match, but there is no test. | Field-shape comparison script (all 5 roles match). Function lengths: `demoServer.buildDashboard` is about 200 lines. | Future changes. | L | M | deferred: dashboard keys are checked by hand today. A shape test is a good next step (see below). |
| F20 | **Some render functions are very long:** `renderModernLogin` (297 lines), `renderScoresTab` (270), `renderQuizScheduler` (148), `renderTasksTab` (147). | Function-length scan (awk over the source). | Future changes: hard to review. | L | L | deferred |
| F21 | **A keep-warm trigger for cold starts** might help. | Can't measure the live cold start from here: Apps Script is blocked. | Everyone, on the first visit of the day. | ? | S | deferred: measure live first |
| F22 | **An owner "System health" card in Admin.** It would show schema version, MailApp quota, last backup, triggers, and whether Google sign-in is on. | No single place shows these today; the owner must open Apps Script. | The owner. | L | M | idea |
| F23 | **There are 36 empty or ignore-errors `catch` blocks.** | `grep` over `js/`. Almost all wrap `localStorage` or `sessionStorage`, which is correct. The `names` one is deliberate. | Nobody, so far. | L | S | rejected: checked, they're fine |
| F24 | **Font stylesheet "blocked by CSP" errors.** | Seen only while axe was running: axe downloads stylesheets to inspect them. Without axe there are 0 errors (`fonterr.js`). | Nobody. | – | – | rejected: caused by the audit tool, not a bug |

### Permission matrix (actual server responses; Demo Mode identical)

| Action | Instructor | Group leader | Assistant | Team leader | Member |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `dashboard`, `addEscalation`, `setGoal`, `changeMyPin`, `setReminders`, `linkGoogle`, `unlinkGoogle` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users`, `auditLog`, `addTask`, `editTask`, `updateEscalationStatus`, `addAnnouncement`, `deleteAnnouncement`, `pinAnnouncement`, `addQuiz`, `deleteQuiz`, `createMentorshipPlan`, `updateMentorshipStatus` | ✓ | ✓ | – | – | – |
| `addMark`, `addEscalationReply` | ✓ | ✓ | ✓ | ✓ | – |
| `editMark` | ✓ | ✓ | ✓ | – | – |
| `deleteMark` | ✓ | – | – | – | – |
| `updateTaskStatus` | ✓ | ✓ | – | ✓ | – |
| `addSubmission` | – | ✓ | ✓ | ✓ | ✓ |
| `updatePin` (reset someone's PIN) | **–** | ✓ | – | – | – |
| `requestGrading`, `addTeamMessage`, `deleteTeamMessage` | – | ✓ | – | ✓ | – |

## Top 15, ranked

These are ranked by impact ÷ effort. Items marked 🔒 need your answer first.

1. **F1:** Fictional names for Demo Mode. *H/S*
2. **F2:** 🔒 Confirm `resetAllPins()` was run. Optionally, the server refuses the old published name and PIN pairs and asks for a reset. *H/S*
3. **F3:** Remove `TEAM_ROSTER` from public JS. *H/S*
4. **F4:** A time limit on every request, with a clear message and **Try again**. *H/S*
5. **F5:** Detect HTML and quota replies and say what's really wrong. *M/S*
6. **F9:** Permission-matrix test against both `Code.gs` and Demo Mode. *M/S*
7. **F10:** Daily scheduled health check of the live site and server, which opens a GitHub issue on failure. *M/S*
8. **F12:** Performance budget in CI: sign-in page bytes and requests per sign-in. *M/S*
9. **F8:** Tests for the 7 untested actions. *M/M*
10. **F7:** 🔒 Let the instructor reset PINs too. *M/S*
11. **F6:** 🔒 Leaderboard: keep, top 5 plus your own rank, or hide others' scores. *M/M*
12. **F13:** One countdown per deadline card. *L/S*
13. **F14:** Fix heading levels. *L/S*
14. **F11:** Names and class shape from the roster or Script Properties instead of code. *M/M*
15. **F15:** Rate-limited client error reporting to an `Errors` tab. *M/M*

**My recommendation:** do 1–9, 12 and 13 now. They are all small or medium, need no decisions, and remove the only high-impact risks. For F2, F6 and F7 I need your answers.


## After the fixes (re-audit)

These were re-run after the 5th fix, and again after the last one.

| Check | Before | After |
| :--- | :--- | :--- |
| axe violations (60 views: 5 roles × all tabs × 2 themes) | 116 (`heading-order` 56, `region` 60) | **0** |
| Console errors during the role walk | 0 | 0 |
| Lighthouse mobile (performance / accessibility / best practices / SEO) | 96 / 100 / 96 / 100 | 95–98 / 100 / 96 / 100 (performance varies by about ±2 from run to run) |
| Sign-in page: requests / own bytes (uncompressed) | 13 / 151 KB | 13 / 153 KB (now a CI budget) |
| Server requests per sign-in and per save | 1 / 1 | 1 / 1 (now a CI budget) |
| Server never answers | "Signing in…" forever | message plus **Try again** after 30 s |
| Google quota page | "Can't reach the class server" | "…has hit Google's daily limit…" |
| Real student names in shipped JS | 11 students, with invented failing marks | 0 (tested) |
| Leaderboard rows sent to a student | whole class, exact averages | top 5 + their own row |
| Actions with no tests | 7 | 0 |
| Demo Mode vs server permissions | matched, untested | matched, tested on every run |
| Tests | 50 unit, 10 browser | 62 unit (including 3 permission and 2 privacy), 20 browser (including the budget) |

## What to audit first next time

1. **F11:** make leader names and the class shape configurable (help text, report-card signatures, "4 teams", `TEAMS` in 3 files).
2. **F19:** a dashboard-shape test, which compares Demo Mode with `Code.gs` for every role, as the permission test already does for permissions.
3. **F15:** rate-limited error reporting from browsers to an `Errors` tab. The daily health check only sees outages.
4. **Live numbers.** Read a few days of health-check timings for cold starts before deciding on a keep-warm trigger (F21).
