# EconomicsPortal — Backend Setup & Upgrade Guide (Google Apps Script)

The backend is a **Google Sheet + Google Apps Script web app**: free, always on, no server and no credit card.

* **Account to use:** `bahriabatch30@gmail.com`
* **Repository:** [github.com/GucciCreates/EconomicsPortal](https://github.com/GucciCreates/EconomicsPortal)

All the functions mentioned below are run from the Apps Script editor: pick the function in the dropdown at the top, then click **▶ Run**. Results appear in **View → Logs** (or the Execution log panel).

| Function | What it does | Safe to re-run? |
| :--- | :--- | :--- |
| `setup()` | Creates or upgrades all 12 tabs and their headers. On an empty Users tab it adds the roster with random PINs and prints them once. Also converts plaintext PINs to hashes. | ✅ |
| `migratePins()` | Converts an old plaintext `pin` column to `pinHash` + `salt`. | ✅ |
| `migrateSubmissions()` | Repairs Submissions rows written by the old v3 bug (timestamp stored in the `gradingRequested` column). | ✅ |
| `resetAllPins()` | Gives **everyone** a new random PIN, prints the list once, and signs everyone out. | ✅ (new PINs each time) |
| `setPinForUser("Name", "1234")` | Sets one person's PIN. Edit the call in the editor first, or use **Reset PIN** in the app. | ✅ |
| `installBackupTrigger()` | Turns on weekly backups to Drive and makes one now. | ✅ |

The tabs `setup()` creates: `Users`, `Marks`, `Tasks`, `Submissions`, `Escalations`, `EscalationReplies`, `Announcements`, `QuizSchedule`, `Goals`, `TeamMessages`, `Mentorship`, `AuditLog`. You don't need to create any of them by hand.

---

## 1. Fresh install

1. Sign in to your browser as **`bahriabatch30@gmail.com`**.
2. Open [sheets.new](https://sheets.new) and name the spreadsheet `EconomicsPortalDB`.
3. Go to **Extensions → Apps Script**, replace everything with [`backend/Code.gs`](./backend/Code.gs), and save.
4. Run **`setup()`** and approve the permissions it asks for.
5. Open the execution log and **copy the list of PINs**. They are shown only this once; the sheet stores only hashes. Give each person their PIN privately.
6. **Deploy → New deployment**:
   * Type: **Web app**
   * Execute as: **Me (bahriabatch30@gmail.com)**
   * Who has access: **Anyone**. This is required for the site to reach it; the token check protects the data.
7. Copy the Web app URL into `js/config.js` (`API_URL`), run `npm run build`, then commit and push.
8. Optional but recommended: run **`installBackupTrigger()`** (see section 4).

---

## 2. ⚡ Upgrading to v4 (from v3)

v4 changes how logins work. **Everyone will have to sign in again**, and **everyone needs a new PIN**: the old default PINs were published in the public README and stay in the repository's history.

Do these steps in order, close together. Between steps 3 and 5, people using the old site will see "session expired" errors.

1. **Back up the sheet:** in Google Sheets, **File → Make a copy**.
2. **Replace the code:** open **Extensions → Apps Script**, replace everything with the new [`backend/Code.gs`](./backend/Code.gs), and save.
3. **Deploy a new version of the existing deployment** so the URL stays the same: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
   *If you create a brand-new deployment instead, the URL changes and you must update `js/config.js`.*
4. **Run the upgrade functions:**
   1. `setup()`: adds the new tabs and columns and hashes the existing PINs (`migratePins()`). Approve the new permissions it asks for.
   2. `migrateSubmissions()`: repairs submissions saved by the old bug. The log says how many rows were fixed; 0 is fine.
   3. **`resetAllPins()`**: copy the new PIN list from the log and hand the PINs out privately.
5. **Publish the new website:** merge the v4 pull request into `main`. `docs/` is already built, so GitHub Pages updates within a few minutes.
6. **Check `js/config.js`** still points at your web app URL. Open the site, log in as yourself, and check that your dashboard loads.
7. **Tell everyone:** "The portal was upgraded. Sign in again with the new PIN I sent you. You can change it under your name (top right) → Change my PIN."
8. Optional: run `installBackupTrigger()` (section 4).

> If someone still sees an old version of the site, a normal refresh fixes it. The app now uses network-first caching, so new releases appear straight away.

---

## 3. Everyday administration

* **Someone forgot their PIN:** the group leader opens **Member Access & PINs → Reset PIN** and tells them the new PIN in person. Nobody, including the group leader, can see existing PINs.
* **"Too many failed attempts":** after 5 wrong PINs a name is locked for 15 minutes. Wait it out; there is nothing to reset.
* **Sign everyone out at once** (for example, if a phone with an open session was lost): in Apps Script open **Project Settings → Script Properties** and delete `TOKEN_SECRET`. A new secret is created automatically and all existing sessions stop working. Changing one person's PIN signs out just that person.
* **Who changed a mark?** The **Activity Log** tab (instructor and group leader) lists every change with before → after values. The raw data is in the `AuditLog` tab.
* **Adding a person:** add a row to the `Users` tab with `name`, `role` (`instructor`, `group_leader`, `assistant`, `team_leader` or `member`) and `team` (`Shehroz`, `Amina`, `Ayesha`, `Lareb`, or `-` for the instructor), then give them a PIN with `setPinForUser` or **Reset PIN** in the app. Don't type anything into `pinHash` or `salt`.

---

## 4. Weekly backups

Run **`installBackupTrigger()`** once and approve the Google Drive permission. It:

* makes a backup right away;
* copies the whole spreadsheet every Sunday at about 2 AM into a Drive folder named **"EconomicsPortal Backups"**;
* keeps the newest **8** copies and moves older ones to the Drive trash.

Running it again just replaces the schedule; it never adds a second one. To restore, open a backup copy, check it, and copy the tabs you need back. Or point a new deployment at the copy.

To stop backups: in Apps Script open **Triggers** (the clock icon) and delete the `runBackup` trigger.

---

## 5. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| "Your session expired, please sign in again" right after the upgrade | Expected: sign in again. |
| Login says "Invalid name or PIN" for everyone | Did you run `resetAllPins()`? Use the new PINs. Type full names as listed, e.g. `Ayesha (Quetta)`; capitals and extra spaces don't matter. |
| "Server error: …" | Open Apps Script → **Executions** to see the full error. Make sure the newest version is deployed (step 3 of the upgrade). |
| The site can't reach the backend at all | Check `API_URL` in `js/config.js`, and that the deployment has access **Anyone**. You can click **Continue in Demo Mode** to try the app with sample data meanwhile. |
| A new Google permission prompt appears | v4 uses Script Properties, Cache, Lock, Drive (backups) and Triggers. Approve it once as the owner. |
