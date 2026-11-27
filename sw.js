/**
 * EconomicsPortal — Service worker (app shell only)
 *
 * Caches the site's own static files so the app opens offline and can be
 * installed. Requests to any other origin — including the Google Apps Script
 * API, which carries student data — are never intercepted or cached.
 *
 * Strategy: network-first for every same-origin GET, so a new deploy shows up
 * immediately; the cache is only used when the network is unavailable.
 * Bump CACHE_VERSION on each release (keep it in step with index.html ?v=).
 */

const CACHE_VERSION = 'v5.0.0';
const CACHE_NAME = `economics-portal-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/api.js',
  './js/app.js',
  './js/auth.js',
  './js/components/accountMenu.js',
  './js/components/activityLog.js',
  './js/components/announcementsPanel.js',
  './js/components/charts.js',
  './js/components/doubtThread.js',
  './js/components/editModals.js',
  './js/components/exportUtils.js',
  './js/components/goalPanel.js',
  './js/components/groupLeaderView.js',
  './js/components/leaderboard.js',
  './js/components/loginView.js',
  './js/components/memberView.js',
  './js/components/mentorshipPanel.js',
  './js/components/metricsPanel.js',
  './js/components/modal.js',
  './js/components/quizScheduler.js',
  './js/components/reportCardModal.js',
  './js/components/submissionTracker.js',
  './js/components/tabNav.js',
  './js/components/tabs/glAdmin.js',
  './js/components/tabs/glDoubts.js',
  './js/components/tabs/glScores.js',
  './js/components/tabs/glStudents.js',
  './js/components/tabs/glTasks.js',
  './js/components/tabs/glUpdates.js',
  './js/components/tabs/memDoubts.js',
  './js/components/tabs/memGoal.js',
  './js/components/tabs/memLeaderboard.js',
  './js/components/tabs/memScores.js',
  './js/components/tabs/memTasks.js',
  './js/components/tabs/memUpdates.js',
  './js/components/tabs/tlClass.js',
  './js/components/tabs/tlDoubts.js',
  './js/components/tabs/tlNoticeboard.js',
  './js/components/tabs/tlSubmissions.js',
  './js/components/tabs/tlTasks.js',
  './js/components/tabs/tlTeam.js',
  './js/components/teamLeaderView.js',
  './js/components/ui.js',
  './js/config.js',
  './js/dates.js',
  './js/demoServer.js',
  './js/lastSeen.js',
  './js/mockData.js',
  './js/utils.js',
  './js/vendor/chart.umd.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('economics-portal-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Only the site's own static files are ever handled. */
function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return; // API calls, fonts and CDNs go straight to the network

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }),
  );
});
