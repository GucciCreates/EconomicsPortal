# EconomicsPortal — Backend Setup Guide (Google Apps Script)

This system uses a **Google Sheet + Google Apps Script Web App** as a free, 24/7 serverless JSON backend. It requires no server, no database hosting, and no credit card.

* **Account to use**: `bahriabatch30@gmail.com`
* **Repository**: [https://github.com/GucciCreates/EconomicsPortal](https://github.com/GucciCreates/EconomicsPortal)

---

## 1. Create the Database Spreadsheet
1. Sign in to your browser with **`bahriabatch30@gmail.com`**.
2. Open a new tab and go to **[sheets.new](https://sheets.new)**.
3. Rename the sheet at the top left to:
   ```
   EconomicsPortalDB
   ```
4. By default, there is a tab named `Sheet1`. Rename and add tabs until you have these **5 tabs** (exact names, case-sensitive):
   * `Users`
   * `Marks`
   * `Tasks`
   * `Submissions`
   * `Escalations`

---

## 2. Add the Apps Script Code
1. In your Google Sheet, click **Extensions > Apps Script**.
2. A new editor tab will open.
3. Delete any default code inside `Code.gs`.
4. Copy the entire contents of [`backend/Code.gs`](./backend/Code.gs) and paste it into the editor.
5. Click the **Save** icon (diskette) or press `Cmd+S` / `Ctrl+S`.

---

## 3. Seed Users & Headers (One-time Setup)
1. In the Apps Script toolbar at the top, locate the function dropdown (it probably says `myFunction` or `doGet`).
2. Select **`setup`** from the dropdown.
3. Click **▶ Run**.
4. Google will ask for permission ("Authorization Required"):
   * Click **Review Permissions**.
   * Choose your account `bahriabatch30@gmail.com`.
   * Click **Advanced** (in small text).
   * Click **Go to EconomicsPortal (unsafe)** (Google shows this warning for personal scripts you create yourself).
   * Click **Allow**.
5. The script will run. Check the Execution log — it will say:
   `Setup complete. 17 users created.`
6. Return to your Google Sheet: you will see all 5 tabs populated with their column headers, and the `Users` tab populated with the 17 class members and PINs.

---

## 4. Deploy as a Web App (Public JSON API)
1. In the Apps Script editor, click the blue **Deploy** button (top right) > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the deployment details:
   * **Description**: `EconomicsPortal API v1`
   * **Execute as**: `Me (bahriabatch30@gmail.com)`
   * **Who has access**: **`Anyone`** *(Important: Must be "Anyone" so the static web app can read/write)*.
4. Click **Deploy**.
5. Google will provide a **Web app URL** formatted like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
6. **Copy this URL**.

---

## 5. Connect Frontend
1. Open [`js/config.js`](./js/config.js) in this repo.
2. Replace `"PASTE_YOUR_APPS_SCRIPT_URL_HERE"` with your copied Web App URL:
   ```javascript
   export const API_URL = "https://script.google.com/macros/s/AKfycbx.../exec";
   ```
3. Commit and push the change to GitHub.

---

## Verification
You can verify your backend in your browser by visiting:
`https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=login&name=Shehroz&pin=1111`

It should return:
```json
{"ok":true,"user":{"name":"Shehroz","role":"group_leader","team":"Shehroz"}}
```
