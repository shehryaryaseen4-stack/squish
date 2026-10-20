# Slotly: booking app for salons, barbers, spas and gyms

A white-label booking app you can sell to local businesses. Each business gets:

- **A customer app for Android, iPhone and the web.** Customers browse services, pick a professional (or "any"), choose a date and time slot, and book in under a minute. They can see, cancel and re-book their appointments, add them to their calendar, and message the shop on WhatsApp. Gyms also get a class timetable with live "spots left" and membership plans.
- **An owner dashboard** at `/admin`, protected by a PIN. It has today's numbers, a 7-day chart, a day schedule with a column per staff member, a bookings list with search, walk-in and phone bookings, reschedule, complete, no-show and cancel actions, and one-tap WhatsApp reminders. The owner can also edit services, team, classes, categories, opening hours with breaks, holidays, booking rules, brand colour and membership plans.
- **A small server** with no dependencies (Node 18+). It stores everything in one JSON file and stops double bookings.

Two demo businesses are included: `salon` (Luxe Studio, Lahore) and `gym` (Iron Republic, Karachi).

## Run it locally

```bash
cd booking-app
npm start                 # salon demo on http://localhost:3100
SEED=gym PORT=3101 npm start   # gym demo (uses a fresh data file the first time)
```

- Customer app: `http://localhost:3100`
- Owner dashboard: `http://localhost:3100/admin` (default PIN **1234**; change it in Settings)
- Tests: `npm test`

| Setting | Meaning |
|---|---|
| `PORT` | Port to listen on (default 3100) |
| `DATA_FILE` | Where bookings and settings are saved (default `data/db.json`) |
| `SEED` | `salon` or `gym`, used only when the data file doesn't exist yet |
| `ADMIN_PIN` | First PIN, used only when the data file doesn't exist yet |
| `CORS_ORIGINS` | Extra comma-separated origins allowed to call the API |

## Put a business online

The mobile apps talk to the server, so each business needs its server on the internet with **https**.

1. Deploy the `booking-app` folder with the included `Dockerfile` to any host that gives you a **persistent disk** (Railway, Fly.io, a VPS, Render with a disk). Mount the disk at `/data`.
2. Point a domain at it, for example `book.luxestudio.pk`.
3. Open `/admin`, change the PIN, and fill in the business name, colour, hours, services and team.

The website works straight away and can be installed from the browser ("Add to Home screen").

## Android and iPhone apps

The apps are built with [Capacitor](https://capacitorjs.com): the same screens, packaged as real native apps. The native projects are in `android/` and `ios/`.

### Get an Android APK without installing anything

Every push that touches `booking-app/` runs **GitHub Actions → "Booking app · Android & iOS"**, which builds an APK. Open the run and download the **android-apk** artifact. Copy it to a phone and install it (allow "install unknown apps").

To bake the server address into the app, add a repository variable `BOOKING_API_URL` (Settings → Secrets and variables → Actions → Variables), for example `https://book.luxestudio.pk`. If you skip this, the app asks for the server address the first time it opens.

You can also run the workflow by hand (**Run workflow**) and type the server URL there. Tick **iOS** to also check that the iPhone app builds.

### Build on your own computer

```bash
npm install
API_URL=https://book.luxestudio.pk npm run mobile:android   # opens Android Studio
API_URL=https://book.luxestudio.pk npm run mobile:ios       # opens Xcode (Mac only)
```

- **Android:** in Android Studio use *Build → Generate Signed App Bundle* to get the `.aab` for the Play Store. A Google Play developer account costs a one-time $25.
- **iPhone:** you need a Mac with Xcode and an Apple Developer account ($99 a year). In Xcode choose your team under *Signing & Capabilities*, then use *Product → Archive* to upload to App Store Connect / TestFlight.

### Rebrand the app for a new client

1. `capacitor.config.json`: set `appId` (unique, for example `pk.luxestudio.booking`) and `appName`.
2. Replace the images in `assets/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png` at 1024×1024, `splash.png` and `splash-dark.png` at 2732×2732), then run `npm run mobile:icons`.
3. Build with that client's `API_URL`.

Everything else (name, colours, services, hours) comes from the client's own dashboard, so you don't change any code per client.

## How it works

```
server.js            HTTP server, static files, security headers, CORS for the apps
lib/api.js           JSON API (public booking routes + PIN-protected admin routes)
lib/availability.js  Slot engine: hours, breaks, days off, holidays, notice, overlaps
lib/store.js         JSON file storage with atomic writes, scrypt-hashed PIN
lib/validate.js      Input checks for every write
public/              Customer app (index.html, app.js) and dashboard (admin.html, admin.js)
scripts/build-mobile.js  Copies public/ to www/ for Capacitor and sets the server URL
android/, ios/       Native projects generated by Capacitor
```

Slots are checked again on the server at the moment of booking, so two people can't take the same slot. Customers can see and cancel only their own bookings: each booking carries a private token kept on their device, or they can look it up with the booking code plus their phone number.
