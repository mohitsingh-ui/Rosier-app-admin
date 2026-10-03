# Rosier app backend + admin panel

Controls everything people see in the Rosier app — intro slides, home banners and sections,
launch popup, categories, product badges, Rosier Coins rules, Benefits Club, blog, help,
notifications, maintenance mode and update prompts — without a new app release.

- **Admin panel:** `https://<your-backend>/admin`
- **What the app downloads:** `GET /api/app/config` (published content only)
- **Images you upload:** `GET /img/<id>` (optimised to WebP, add `?w=600` to resize)

## How editing works

1. Change anything in the admin panel. It saves as a **draft** automatically — the app doesn't change yet.
2. **Preview on phone** shows a QR code. Scan it with a phone that has the Rosier app installed to see your drafts in the real app. Tap the dark "Preview" pill in the app to leave preview.
3. **Publish changes** sends them live. Apps pick them up on the next open, or when someone comes back to the app after 30 seconds away.
4. **Versions** lists every publish. "Restore" puts an older version back live.

Products and prices still come from Shopify automatically. The Products section is only for app-specific changes (hide, rename, badge, category, rating, photo).

## Run it on your computer

```bash
cd server
npm install
ADMIN_EMAIL=you@rosierfoods.com ADMIN_PASSWORD='choose-a-password' npm start
# open http://localhost:4000/admin
```

With no `DATABASE_URL` it uses a built-in database saved in `server/data/`.
To point the app at it, start Expo with `EXPO_PUBLIC_API_URL=http://<your-laptop-ip>:4000 npx expo start`.

## Deploy on Render

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → choose the repo. It reads `render.yaml` and creates the web service and a Postgres database (Singapore).
3. Fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` when asked. That account is created on first start.
4. When it's live, open `https://rosier-app-backend.onrender.com/admin` (or whatever URL Render gives you).
5. If the URL is different, put it in the app's `app.json` → `expo.extra.apiUrl` and build the app again.

Cost on Render: Starter web service + basic-256mb Postgres, roughly US$13/month.
You can switch the web service to the free plan, but it sleeps when idle. The app then keeps showing the last content it downloaded until the server wakes up.

## Environment variables

| Name | What it's for |
| --- | --- |
| `DATABASE_URL` | Postgres connection (set automatically by the Blueprint) |
| `JWT_SECRET` | Signs admin logins (generated automatically) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin, created only if there are no admins yet |
| `PUBLIC_URL` | Optional. Full public URL if you put a custom domain in front, e.g. `https://app-api.rosierfoods.com` |
| `STORE_URL` | Optional. Defaults to `https://www.rosierfoods.com` (for the product pickers) |

Forgot the password? In the Render shell: `npm run create-admin -- you@rosierfoods.com 'new-password'`.

## Adding a new editable thing

1. Add the default value to `src/config/defaults.json` (in the app).
2. Describe the field in `server/src/schema.js`. The admin form appears automatically.
3. Read it in the app with `useContent('<section>')`.
4. Run `npm run sync-defaults` in `server/` so the server's copy matches.
