# Gyan Chakra Permanent Link Setup

The temporary Cloudflare link changes when the tunnel is closed. For a stable app link, deploy the app to Render.

## What You Will Get

- User app: `https://your-render-link`
- Admin/backend panel: `https://your-render-link/?admin=1`
- Health check: `https://your-render-link/api/health`
- Same link keeps working even when your laptop is off.

## One-Time Render Setup

1. Create or open a Render account.
2. Create a new Web Service from this project/repository.
3. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Add environment variables:
   - `HOST`: `0.0.0.0`
   - `DATA_DIR`: `/var/data`
   - `ADMIN_PIN`: choose your private admin PIN
5. Add a persistent disk:
   - Mount Path: `/var/data`
   - Size: `1 GB`

This project also includes `render.yaml`, so Render can read most of these settings automatically.

## After Deploy

Render will show your permanent URL. Use it like this:

- User app: `https://YOUR-LINK.onrender.com`
- Admin panel: `https://YOUR-LINK.onrender.com/?admin=1`

Then update the Android APK to use that permanent backend:

```bash
npm run set:api -- https://YOUR-LINK.onrender.com
npx cap sync android
```

After that, rebuild or refresh the APK and share the new APK with testers.
