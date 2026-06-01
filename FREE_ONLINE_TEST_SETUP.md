# Free Online Testing Setup

Use this when you want a public link that works even after your laptop is shut down.

## Best Free Test Option: Railway Trial

Railway currently gives new users a free trial credit. This is good for short testing with a few users in different cities.

What you get:

- Public user app link
- Admin panel link
- Server runs in cloud, not on your laptop
- Laptop can be off

Links will look like:

- User app: `https://your-app.up.railway.app`
- Admin panel: `https://your-app.up.railway.app/?admin=1`
- Health check: `https://your-app.up.railway.app/api/health`

## Important

The current app uses a server-side JSON database file. For short testing this is okay, but the cloud service must have persistent storage/volume enabled.

Use these environment variables:

- `HOST=0.0.0.0`
- `ADMIN_PIN=your-private-pin`
- `DATA_DIR=/data`

Add a persistent volume mounted at:

- `/data`

## Steps

1. Create a free Railway account.
2. Connect your GitHub account.
3. Upload/push this project to a GitHub repository.
4. In Railway, create a new project from that GitHub repository.
5. Add the environment variables above.
6. Add a persistent volume mounted at `/data`.
7. Deploy.

After deployment, Railway will give a public URL.

Send that URL back here. I will update the Android APK to use it.

## Free Plan Warning

Free/trial hosting is good for testing, not final public launch. For real launch, move to a paid always-on server and PostgreSQL/Supabase.
