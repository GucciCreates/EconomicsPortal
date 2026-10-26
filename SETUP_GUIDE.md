# EconomicsPortal — Backend Setup & Upgrade Guide (Google Apps Script)

This system uses a **Google Sheet + Google Apps Script Web App** as a free, 24/7 serverless JSON backend. It requires no server, no database hosting, and no credit card.

* **Account to use**: `bahriabatch30@gmail.com`
* **Repository**: [https://github.com/GucciCreates/EconomicsPortal](https://github.com/GucciCreates/EconomicsPortal)

---

## ⚡ UPGRADING FROM v1 to v2

If you already created `EconomicsPortalDB` in v1, the **Marks** tab has new columns in v2:
`mockNumber`, `previewDone`, `peerRating`, `punctual`, `editedBy`.

### Option A: Clean Re-seed (Fastest)
1. Open your `EconomicsPortalDB` sheet.
2. Go to **Extensions > Apps Script**.
3. Replace the entire code with the contents of [`backend/Code.gs`](./backend/Code.gs).
4. In the function dropdown, select **`setup`** and click **▶ Run**.
5. This re-creates the tabs and populates the updated headers automatically.
6. Click **Deploy > Manage deployments > Edit > Version: New version > Deploy**.

### Option B: Manual Column Update (Preserves Existing Marks)
If you already have real student marks entered and want to preserve them:
1. Open the **Marks** tab in your Google Sheet.
2. Update row 1 so the column headers match this exact order (14 columns):
   ```
   id | member | team | cycle | mockNumber | quizScore | submission | attendance | previewDone | peerRating | punctual | notes | editedBy | timestamp
   ```
3. Update Apps Script with [`backend/Code.gs`](./backend/Code.gs) and deploy a **New version**.

---

## 1. Initial Setup (New Spreadsheet)
1. Sign in to your browser with **`bahriabatch30@gmail.com`**.
2. Open [sheets.new](https://sheets.new) and name the spreadsheet `EconomicsPortalDB`.
3. Create these 5 tabs: `Users`, `Marks`, `Tasks`, `Submissions`, `Escalations`.
4. Go to **Extensions > Apps Script**, paste [`backend/Code.gs`](./backend/Code.gs), and save.
5. Select **`setup`** from the function dropdown and click **▶ Run** (approve permissions).
6. Click **Deploy > New deployment**:
   * Type: **Web app**
   * Execute as: **`Me (bahriabatch30@gmail.com)`**
   * Who has access: **`Anyone`**
7. Copy the Web app URL and paste it into `js/config.js`.
