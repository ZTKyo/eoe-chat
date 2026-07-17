# PWA Installation Guide

## Production installation

The service worker registers only in a production build so development refreshes are not affected by stale caches.

```bash
npm run build
npm run start
```

Open the application in a supported browser using HTTPS, or `localhost` during local development.

### Desktop Chromium browsers

1. Open EOE Chat.
2. Use the install icon in the address bar, or open the browser menu.
3. Choose **Install EOE Chat**.
4. Confirm installation.

### Android Chromium browsers

1. Open EOE Chat.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.

### iPhone/iPad Safari

1. Open EOE Chat in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.

## Offline behavior

The production service worker caches the application shell, manifest, and icons. Previously persisted conversations remain available from IndexedDB when the shell can load.

AI generation still requires network access and a reachable provider. The app must not claim that model generation works offline.

## Updating

The current service worker uses a versioned cache name. A new deployment should increment `CACHE_NAME` when shell caching behavior changes. The new worker removes older EOE shell caches after activation.

## Troubleshooting

- If installation is unavailable, verify the production build, manifest response, icons, service worker, and secure context.
- If an old shell remains, close all installed app windows and reload once online.
- Clearing browser site data deletes IndexedDB conversations and cached shell files.
