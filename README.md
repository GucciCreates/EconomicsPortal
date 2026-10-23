# 📈 EconomicsPortal

A free, static web portal and dashboard for **Dr. Numan's Economics Class** (17 members across 4 teams), built by **Shehroz's team**.

Runs entirely for free:
- **Frontend**: Plain HTML, CSS, and modern JavaScript (ES Modules), served via **GitHub Pages**. Zero hosting cost.
- **Backend**: Serverless JSON API running on **Google Apps Script** backed by a **Google Sheet** on `bahriabatch30@gmail.com`. Zero server costs, never sleeps, and requires no credit card.

---

## 👥 Roster & Class Organization

| Role | Name | Team | Default PIN | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Instructor** | Dr. Numan | — | `0000` | Read-only class marks |
| **Group Leader** | Shehroz | Shehroz | `1111` | Full oversight: assign tasks, enter marks, resolve escalations |
| **Group Assistant** | Sajal | Shehroz | `1112` | Recordkeeping: read-only marks & tasks + escalation log |
| **Team Leader** | Amina | Amina | `2001` | Team oversight: relay tasks, record team marks, view submissions |
| **Member** | Ramesh | Amina | `2002` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Mamoon | Amina | `2003` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Tazneem | Amina | `2004` | View tasks, submit work, view own marks, raise doubts |
| **Team Leader** | Ayesha (Quetta) | Ayesha | `3001` | Team oversight, relay tasks, record team marks, view submissions |
| **Member** | Minal | Ayesha | `3002` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Anika | Ayesha | `3003` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Ahmed bin Nasir | Ayesha | `3004` | View tasks, submit work, view own marks, raise doubts |
| **Team Leader** | Lareb | Lareb | `4001` | Team oversight, relay tasks, record team marks, view submissions |
| **Member** | Shaiman | Lareb | `4002` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Aisha Amjad | Lareb | `4003` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Haseeb | Lareb | `4004` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Gorsi | Shehroz | `1113` | View tasks, submit work, view own marks, raise doubts |
| **Member** | Haris | Shehroz | `1114` | View tasks, submit work, view own marks, raise doubts |

---

## 🚀 Quick Start (Local Development)

1. Clone or navigate to the repository:
   ```bash
   cd EconomicsPortal
   ```

2. Run the local static server:
   ```bash
   npm run dev
   ```
   *Or:* `python3 -m http.server 3000`

3. Open your browser at `http://localhost:3000`.

> **Note:** The app features an automatic **Demo Mode** out of the box with realistic seed data. You can click any of the quick-login chips on the sign-in screen to explore the Group Leader, Team Leader, and Member interfaces immediately.

---

## ⚙️ Connecting Your Google Apps Script Backend

1. Follow the step-by-step instructions in [**`SETUP_GUIDE.md`**](./SETUP_GUIDE.md) to:
   - Create your `EconomicsPortalDB` Google Sheet under `bahriabatch30@gmail.com`.
   - Paste [`backend/Code.gs`](./backend/Code.gs) into Google Apps Script.
   - Run `setup()` once to initialize tabs and users.
   - Deploy as a Web App (access set to *Anyone*).
2. Copy your Web App URL.
3. Open [`js/config.js`](./js/config.js) and update `API_URL`:
   ```javascript
   export const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
4. Run `npm run build` to sync your changes to `/docs`.

---

## 🌐 Deploying to GitHub Pages

1. In your GitHub repository:
   - Go to **Settings > Pages**.
   - Under **Build and deployment**:
     - Source: **Deploy from a branch**
     - Branch: **`main`**
     - Folder: **`/docs`** (or `/root`)
   - Click **Save**.
2. Your site will be live at:
   ```
   https://GucciCreates.github.io/EconomicsPortal/
   ```

---

## 📁 Repository Structure

```
EconomicsPortal/
├── backend/
│   └── Code.gs              # Complete Google Apps Script backend code
├── css/
│   └── style.css            # Responsive, mobile-first CSS with dark/light themes
├── docs/                    # Production deployment folder for GitHub Pages
│   ├── css/
│   ├── js/
│   └── index.html
├── js/
│   ├── components/
│   │   ├── groupLeaderView.js
│   │   ├── memberView.js
│   │   └── teamLeaderView.js
│   ├── api.js               # API client with CORS-safe text/plain fetch & demo fallback
│   ├── app.js               # Main application router and view controller
│   ├── auth.js              # Local storage session management
│   ├── config.js            # API_URL configuration
│   └── mockData.js          # In-browser test database for demo mode
├── .gitignore
├── build.js                 # Static sync script for /docs
├── index.html               # Main application entry point
├── package.json             # NPM build and dev scripts
├── README.md                # Documentation & instructions
└── SETUP_GUIDE.md           # Step-by-step Apps Script setup guide
```
