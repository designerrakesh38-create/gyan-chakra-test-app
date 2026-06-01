# Gyan Chakra Cloud Setup for 2,500 Daily Test Users

This app must run from a cloud server for 2,500 daily users. Do not use `127.0.0.1`, laptop terminal, or temporary Cloudflare links for that test.

## Recommended Test Setup

Use Render for the app server first. It gives one permanent HTTPS link:

- User app: `https://YOUR-APP.onrender.com`
- Admin panel: `https://YOUR-APP.onrender.com/?admin=1`
- Health check: `https://YOUR-APP.onrender.com/api/health`

For the first 2,500-user test, use a paid always-on web service and a persistent disk. Do not use a free sleeping service.

## Why Persistent Disk Is Required

The app currently stores data in a server-side JSON database file. On cloud, that file must live on persistent storage, otherwise registrations, answers, schedules, and winners can be lost after restart.

The included `render.yaml` is configured for:

- Node web service
- Persistent disk mounted at `/var/data`
- `DATA_DIR=/var/data`
- `ADMIN_PIN` as a private environment variable

## Render Settings

When creating the Render Web Service:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment variables:
  - `HOST=0.0.0.0`
  - `DATA_DIR=/var/data`
  - `ADMIN_PIN=your-private-pin`
- Persistent disk:
  - Mount path: `/var/data`
  - Size: `1 GB`

## Important Security

- Do not upload your local `data/db.json` to the cloud.
- Passwords are stored as hashes, not plain text.
- Keep `ADMIN_PIN` private.
- Share only the user app link with players.
- Use `?admin=1` only for your backend/admin panel.

## After Render Gives the Permanent Link

Update the Android app to use the permanent link:

```bash
npm run set:api -- https://YOUR-APP.onrender.com
npx cap sync android
```

Then rebuild or refresh the APK before sharing with testers.

## Scale Note

This setup is acceptable for a controlled test of around 2,500 daily visitors. If all 2,500 users answer in the same few seconds, the next upgrade should be PostgreSQL/Supabase so answer recording is fully database-safe under heavy bursts.
