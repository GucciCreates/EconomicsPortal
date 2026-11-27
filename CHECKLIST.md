# Before you open a pull request

A short list so each change is checked the same way. Everything here is free and runs on your own computer.

## Every change

- [ ] **Build:** `npm run build`, then commit `docs/` together with the source. Never edit `docs/` by hand.
- [ ] **Tests:** `npm test` (backend, permissions, privacy) and `npm run test:e2e` (browser, budget).
- [ ] **Try it:** open `?demo=1`. Do the job you changed as each role it affects, at full width and at phone width (390 px). Check both light and dark themes.

## If you changed what the server does (`backend/Code.gs`)

- [ ] **Demo Mode matches.** Make the same change in `js/demoServer.js`. If who-can-do-what changed, update the table in `tests/permissions.test.js`. That test fails if the two servers or the table disagree.
- [ ] **A test proves it.** Add a test in `tests/backend.test.js` that fails without your change.
- [ ] **Migration.** If you changed a sheet's columns, it ships with a migration that runs from `setup()`, is safe to run twice, and is written up in SETUP_GUIDE.md, saying exactly what the owner must run.

## If you changed what's on screen

- [ ] **Accessibility.** No new axe violations in either theme. Headings go h1 → h2 → h3 (`tests/e2e/v7.e2e.js` checks this), every button has a name, and focus returns where it was after a dialog closes.
- [ ] **No sideways scrolling** at 390 px.
- [ ] **Empty states** say what to do next. Errors say what went wrong and how to fix it.

## Privacy

- [ ] **No real names** in shipped JavaScript or sample data. `tests/privacy.test.js` checks this.
- [ ] **Students see only what they need.** A student sees their own marks, their team's work, and the leaderboard top 5 plus their own place. Nothing about another team.

## Speed

- [ ] **Within budget.** `tests/e2e/budget.e2e.js` passes: the sign-in page is within 10% of `tests/budget.json`, and signing in or saving takes one request. If it grew on purpose, run `npm run budget:update` and say why in the PR.

## Free, always

- [ ] **No new paid services**, trials, credit cards, frameworks, bundlers or runtime dependencies. Dev tools must be free and work offline.
