# Rosier app backend + admin panel

Controls everything people see in the Rosier app — intro slides, home banners and sections,
launch popup, categories, product badges, Rosier Coins rules, Benefits Club, blog, help,
notifications, maintenance mode and update prompts — without a new app release.

- **Admin panel:** `https://<your-backend>/admin`
- **What the app downloads:** `GET /api/app/config` (published content only)
- **Images and videos you upload:** `GET /img/<id>` (images optimised to WebP, add `?w=600` to resize; MP4 videos up to 50 MB, streamed in chunks)

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

## Shopify: customer login, real orders and checkout

Set up under **Shopify connection** in the admin panel. Each part has its own "How to get these keys" steps and a **Test connection** button.

| Part | What it does | Keys |
| --- | --- | --- |
| Checkout in the app | Builds a real Shopify cart (with the coin voucher) and opens checkout. Logged-in customers get their email, addresses and saved payment methods filled in. | Storefront API public token (Headless channel) |
| Customer login | Customers log in with their rosierfoods.com account (email + one-time code). The app shows their real orders with tracking, and gives Rosier Coins for every new order (app or website). | Customer Account API client ID + secret (Headless channel, "Confidential" client) |
| Orders & customers in the panel | **Orders**, **Customers** and **API console** pages in the admin panel. | Admin API token (`shpat_…`) or a Dev Dashboard app's client ID + secret |

Customer login needs **new customer accounts** switched on in Shopify (Settings → Customer accounts). In the Headless channel's Customer Account API settings, add the **Callback URI** shown in the panel (`https://<your-backend>/auth/shopify/callback`).

Secrets stay on the server. The app only ever talks to this backend.

## Live phone preview & theme

Every editing page shows the real app in a phone frame on the right. It updates as you type, before anything is published. Use the dropdown to switch screens and the Light/Dark buttons to check both modes. On smaller screens, tap **Show phone**.

**Theme & sizes** controls the app's colours (light and dark) and sizes: slider height and corners, tiles, category icons, deal cards, product photos and section spacing.

The preview is a web copy of the app, stored in `server/app-preview`. After changing the app's code, rebuild it from the project root with `npm run build:preview` and push.

## In-app checkout & payments

With **Use Shopify cart checkout in the app** switched on, checkout opens inside the app using Shopify Checkout Kit. It's the same Shopify checkout as the website, with the same payment methods, shipping rates and discounts, but there's no browser. UPI payments open GPay, PhonePe, Paytm, BHIM or CRED and come back to the app. The app is told the moment an order is paid, so it clears the cart, gives coins and shows the thank-you screen.

Checkout Kit only works in the real installed app (APK / App Store build). In Expo Go and in the admin panel's phone preview, checkout opens in a browser window instead.

## Visual editing in the phone

With **Click to edit** on, the phone preview works like a design tool:
- **Hover and click** anything (top slider, tiles, header, a section, a category, product cards, an intro slide, or empty space for the whole screen). Its settings open in the **Inspector** next to the phone.
- **Drag the ↕ handle** under the selected slider, tile row, category, product card or image banner to resize it.
- **Drag "⠿ Drag"** on a selected home section to move it. You can also use ↑ ↓, duplicate or delete.
- **+ Add section below** inserts a new section (image banner, product row, grid, promo…).
- Each section has a background colour, title colour and size, extra space above and below, and an entrance animation with speed. **Play animation** replays it.

Switch to **Use the app** to tap through the app normally. Everything stays a draft until you press Publish.

## Seasonal effects, coupons & order tracking

**Seasonal effects** (admin → Seasonal effects): snow, Diwali sparkles, floating diyas, Holi colours, rain, confetti, petals, hearts, leaves, kites, or your own emoji/image. One main on/off switch, then a list of effects — the first one switched on (and inside its dates) shows. Set dates (e.g. 1 Dec → 31 Jan) and it starts and stops by itself. Choose amount, speed, size, strength, colours, where it shows (Home / main tabs / everywhere) and "stop after N seconds" for a short burst. "Play in live preview" runs it in the phone for 12 s even while it's off. Customers can switch it off in Profile (you can hide that switch). Phones with "reduce motion" turned on don't get effects.

**Coupons** (admin → Coupons): create the codes in Shopify → Discounts as usual. In the app the cart has a coupon box; every code is checked with Shopify against the customer's actual items (a throwaway cart, nothing ordered), so they see the real saving or "not valid" before checkout. The code goes to Shopify checkout together with any Rosier Coins voucher. "Import from Shopify" fills the "Available coupons" list from your active discounts (needs the `read_discounts` Admin API scope); edit headlines/terms there. If the Storefront API isn't connected the app estimates the saving from this list and Shopify applies the code at checkout.

**Order tracking** (admin → Order tracking): logged-in customers tap Track on any order and see a 5-step timeline, courier name, tracking number, expected delivery date and the courier's history, straight from Shopify fulfilments. Anyone can track with order number + the email or phone used (same check as the website; needs the Admin API with `read_orders`). Lookups and coupon checks are rate-limited per device. If your courier puts tracking numbers but no links into Shopify, set "Courier tracking page" with `{number}`.

## Phone notifications (push)

Admin → **Push notifications** sends a notification now (to everyone / members / logged-in / guests). In **Notifications**, tick "Also send to phones" and it goes out when you publish. **Phone notifications** sets the sound (chime, temple bell, coin, soft notes or the phone's default) and the automatic order messages (confirmed → shipped → out for delivery → delivered / cancelled). Order updates are checked every 5 minutes; Shopify connection → "Turn on instant order updates" makes them instant (webhooks, signed with your app's client secret).

One-time setup (needed for notifications to reach phones):
1. **Expo project ID** – in the app folder run `npx eas-cli init` once (log in with your Expo account). It adds `extra.eas.projectId` to `app.json` — commit it.
2. **Firebase (Android)** – console.firebase.google.com → Add project → Add Android app with package `com.rosierfoods.app` → download `google-services.json`. For GitHub builds paste the whole file into a repository secret named `GOOGLE_SERVICES_JSON` (or put the file in the app folder for local builds — it's git-ignored).
3. **Firebase key for Expo** – Firebase → Project settings → Service accounts → Generate new private key. Upload it at expo.dev → your project → Credentials → Android → FCM V1 service account key.
4. **iPhone** – the iOS build (EAS) sets up the Apple push key automatically the first time (say yes when asked).
5. Rebuild the app. The app shows a friendly "Turn on notifications" card on the home screen before the phone asks for permission.

Optional: `EXPO_ACCESS_TOKEN` env on Render if you turn on "enhanced push security" in Expo.

## App sales dashboard
Admin → **App sales**: sessions, live users in the app right now, sales/orders/AOV/conversion from app orders only (Shopify orders marked `source = rosier_app`), compared with the previous period, daily chart, top products and latest app orders. Needs the Admin API (read_orders).

## Products in the app
Admin → **Products in the app** lists every Shopify product. "Same as the website" shows the website's products minus the ones you switch off, plus any you switch on that aren't on the website. "Only the products I tick" shows just your picks. Products that aren't on the website must be **Active** and available on your app's sales channel (Shopify → product → Sales channels → the Headless/Storefront channel) so the app can sell them. Needs read_products (+ read_product_listings).

## Membership
Customers who bought the Membership product (app or website) or have a member tag in Shopify (Benefits Club → member tags) see the member page: their card, days left, savings, free-ghee progress, benefits and **Member updates** (admin → Benefits Club → Member updates; tick "Also send to members' phones" to ping them). They log in with their rosierfoods.com account. The cart shows the member discount only if "Show the member discount in the cart total" is on — switch it on only if Shopify really gives members that discount at checkout.

## Logout
The app's Logout also signs the customer out of their Shopify account. Make sure Shopify → Customer Account API → Application setup → **Logout URI** is exactly your backend link (e.g. `https://rosier-app-backend.onrender.com`).
