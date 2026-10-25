# GymDesk: gym management you can sell, online and on Windows

A complete management app for a gym plus an app for its members, packaged as a product to sell worldwide:

- **Online (SaaS):** gyms sign up on your website, get a free trial and pay a monthly or yearly subscription through Paddle. Every gym gets its own address (`yourdomain.com/g/their-gym`), currency, time zone and data. You control every gym from the owner panel.
- **Windows licence:** a one-time purchase. The buyer gets a licence key, the Windows app activates it once and then runs the gym on their own computer.
- **Apps:** web, Windows and Android (iPhone project included).

"GymDesk" is a placeholder name: change it in the owner panel (website), `desktop/config.json` and `desktop/package.json` (Windows app).

## What's inside

**Gym manager dashboard (`/admin`)**, for the owner and front desk on a phone, tablet or computer:

- **Dashboard:** who is in the gym right now, today's check-ins, active members, memberships expiring this week, expired members, pending dues, members who stopped coming, birthdays, new enquiries, busiest hours, fees collected, expenses and profit, and a 6-month income vs expenses chart.
- **Front desk:** search by member number, name or phone and check people in or out with one tap. It warns when a fee has expired or money is due, and lets you collect the fee right there.
- **Members:** filters for active, expiring, expired, never paid, dues, not coming, in the gym, frozen and left. Each member has a full profile:
  - membership status, expiry date and days left
  - **month-by-month record**: for every month since joining, whether the fee was paid and how many times they came, so you see at a glance the months they skipped and the months with no fee
  - months as a member, months attended, months missed, months without fee, total visits, last visit and average workout time
  - an attendance calendar and recent check-in/check-out times
  - fee history with receipts, instalments, discounts and admission fee, sent on WhatsApp
  - body measurements (weight, body fat, waist, chest, arms) with progress
  - membership freeze, which extends the expiry automatically
  - app PIN reset, mark as left or rejoin, delete
- **Register:** one table of every member for today or any month: who came and how many days, who didn't come at all, whose fee covers the period and whose doesn't, and exactly who paid how much, on which date and by which method. It has a monthly total and CSV export.
- **Fees:** monthly, quarterly, half-yearly, annual or any custom plan. Collect or renew with the right start date filled in, take part payments and keep the rest as dues, and see what was collected by day, week or month and by payment method (Cash, Bank transfer, JazzCash, EasyPaisa, Card). Lists of dues, expiring, expired and never-paid members come with one-tap WhatsApp reminders in Roman Urdu.
- **Attendance:** daily log, check-ins by hour, average workout, and corrections for forgotten check-outs.
- **Classes:** weekly timetable, daily bookings with capacity, and adding members to a class.
- **Expenses:** rent, salaries, bills, equipment and your own categories.
- **Reports:** fees collected, expenses, profit, new members, renewals, lapsed members, visits, admission fees, discounts, daily collection, and breakdowns by method, plan and expense category. Members, fees, attendance and daily totals export to CSV for Excel.
- **Enquiries:** people who asked to join from the app, with WhatsApp follow-up and one-tap "make member".
- **Settings:** gym details, brand colour, admission fee, reminder days, blocking expired members at check-in, opening hours, plans, trainers and staff with salaries, staff logins, the owner PIN, and clearing the demo data.
- **Staff logins & access** (owner only, in Settings): every staff member gets their own name and PIN, and the owner switches on exactly what each one may do: check-in, letting in expired members, seeing/adding/editing/deleting members, taking fees, seeing collections, deleting receipts, register and attendance, classes, enquiries, expenses, reports, machines and gym settings. Ready choices are *Check-in only*, *Front desk* and *Manager (everything)*. Changes apply at once, and switching a login off signs that person out. The server checks every action, so hidden buttons can't be worked around. Gyms that had the old shared front desk PIN get it as a "Front desk" login with the same rights as before.

**Fingerprint & face machines:** in **Settings → Fingerprint & face machines → Add machine** the owner picks the machine they have (ZKTeco fingerprint, ZKTeco face, eSSL/Identix, ZKTeco ZLink, Hikvision face terminal, or another brand). The app then asks only for what that machine needs (the serial number for ZKTeco-type machines, nothing for Hikvision), shows the exact settings to enter on the machine, and **Check connection** waits for the machine to call in. It shows ✅ *Connected* or ❌ *Not connected* with the reason and what to check. A mistyped serial number is detected and fixed with one tap.
- ZKTeco, eSSL and other "ADMS / Cloud server / Push" machines send punches to `/iclock/cdata`.
- Hikvision face terminals send events from **HTTP Listening** to a private address `/hik/<key>` (beta: built from Hikvision's event format, not yet tried on a real terminal).
- On the machine, each member's User ID / Employee No. is their member number. A punch checks the member in, the next one checks them out, and double taps within 2 minutes are ignored. IDs that match no member are listed so the enrollment can be fixed. Settings also has a "Punch" button to try it without a machine.

**Entry screen (`/display`):** open it on a TV or big monitor at the entrance and enter a PIN once. Every check-in from a machine, the kiosk or the front desk appears within 2 seconds, full size: the member's photo, name, member number, plan and days left, in green, amber (fee due soon or money pending) or red (expired). Check-outs show how long they trained. A side column lists the latest entries, how many are inside and today's total. It has an optional chime and a full-screen button.

**Entry screen on a second monitor:** connect the wall TV or monitor to the front desk computer with HDMI and press **Windows + P → Extend**. Then:
- In the **Windows app**, click **Entry screen (TV)** (or Ctrl+E). It opens full screen on the other monitor by itself and comes back there every time the app starts. Ctrl+Shift+E moves it to the next monitor, Esc leaves full screen.
- In **Chrome or Edge**, click **Entry screen (TV)** and allow "window management" when asked. The screen opens on the other monitor; press *Full screen* there. Without that permission it opens as a new window to drag onto the TV.

**Exercise videos:** in **Settings → Exercise videos** the gym adds a short clip (MP4 up to 40 MB, 15-60 seconds) or a YouTube / YouTube Shorts link to any exercise. Members see it playing at the top of the exercise, and a "Video" tag on it in their plan. Exercises without one get a **Watch short videos of the right form** button that opens YouTube Shorts for that exercise. Uploaded clips are stored next to the data file (`videos/`) and streamed with range requests so phones can start and seek.

**Calories and diet plan (member app → Workout → Diet & calories):** every exercise in the plan shows the calories it burns (in total and per set) and each day shows the whole workout's total and what's done so far, worked out from standard MET values and the member's weight. The member enters weight, height, age, goal (lose fat, stay fit, build muscle) and what they eat (chicken & meat, eggs only, vegetarian), and gets a daily calorie target (Mifflin-St Jeor with their training days), protein (1.6-2 g per kg), carbs, fat and water, plus a day of meals in everyday foods with exact amounts (how many eggs, grams of chicken, roti, daal, dahi, paneer, whey…) and the protein in each, and a table of protein in common foods. It is labelled as an estimate, not medical advice.

**Register members on the machine from the app:** after adding a member the desk picks what's easiest for them (fingerprint, face, near-infrared face, palm, card or PIN), presses **Start on machine**, and the machine asks the member to scan. The app shows "scan now", then "saved" or the machine's error, and the member's profile shows what is registered (**Machine access**). It works with ZKTeco-type machines in ADMS/push mode: new members are put on the machine automatically (and removed when deleted), commands go out through `/iclock/getrequest`, results come back on `/iclock/devicecmd`, and fingers, faces and cards added on the machine itself are picked up from its operation log. **Send members** in Settings puts every existing member on a machine. Some older firmware can't start a scan remotely; the app then says so and shows the menu path to do it on the machine. Hikvision terminals register faces on the terminal.

**Automatic WhatsApp reminders:** in **Settings → Automatic WhatsApp reminders** the gym connects its own number on the WhatsApp Business Platform (Meta Cloud API: phone number ID, permanent access token and one approved *Utility* template, whose text the app shows in English or Roman Urdu). From then on every member gets a message from 7 days before their membership ends (the number of days, every day or only on days 7/3/1/0, and the send time are adjustable): *"…your membership ends on 26 October (7 days left)…"*. Renewing stops the reminders, each one goes out once, failures are retried and listed with Meta's reason, and there is a test button. Meta charges a small fee per message and the number can't be used in the normal WhatsApp app at the same time. The one-tap WhatsApp buttons on the lists still work without any setup.

**Member photos:** members set or change their photo from the app (Profile → tap the picture), and the front desk can take one from the member's profile. Photos are cropped to a square on the phone before upload and show up in lists, the member profile, the desk, the kiosk and the entry screen. They are stored as files in a `photos/` folder next to the data file.

**Check-in kiosk (`/kiosk`):** put a tablet at the entrance. Members type their number to check in or out, and the screen shows days left or a "please renew" warning.

**Member app (`/`, Android and iPhone):** members sign in with their member number (or mobile) and PIN to see:

- a membership card with plan, days left, expiry and pending dues
- this month's visits and average workout
- an attendance calendar, month-by-month record and body progress
- fee receipts
- class booking

- **Weekly workout plan:** the member picks the muscles for each day (for example chest + biceps on Monday, back on Tuesday), or starts from a ready plan (body-part split, push/pull/legs, upper/lower, full body, fat loss) and changes it. Each day lists its exercises with sets and reps. Every exercise shows a two-photo animation of how to do it and step-by-step instructions, and members tick exercises off as they go. Trainers see and can set the plan from the member's profile.

Visitors who aren't members see plans, coaches, timings and a "Join" form.

The exercise library (84 exercises in 11 muscle groups) comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), which is public domain. `scripts/build-exercises.py` downloads it and shrinks the photos into `public/exercises/`. Edit the `GROUPS` list in that script to add or swap exercises.

## Sell it: the platform

```bash
cd gym-app
PLATFORM=1 OWNER_EMAIL=you@example.com OWNER_PASSWORD='a-long-password' npm start
# website http://localhost:3100 · owner panel http://localhost:3100/owner
```

| Page | What it is |
|---|---|
| `/` | Sales website: features, screenshots, pricing, FAQ |
| `/signup` | A gym creates its account: name, web address, country (sets currency, time zone, payment methods and plan prices), owner PIN |
| `/billing?gym=…` | Subscribe monthly or yearly through Paddle |
| `/thanks` | After payment; shows the licence key for Windows purchases |
| `/download` | Windows and Android downloads |
| `/terms`, `/privacy`, `/refund` | Legal pages (templates, have them checked) |
| `/owner` | **Your owner panel** |
| `/g/<gym>/`, `/g/<gym>/admin` | One gym's member app and dashboard |

**Owner panel (`/owner`):** totals (gyms, paying, on trial, locked, monthly income, licences) and recent activity; every gym with its status, plan, paid-until date and member count; per gym: **open their dashboard** as owner, **add paid time** (for bank or wallet payments), **pause / switch back on**, **reset the owner PIN**, make free, private notes, delete. Also: create gyms and licence keys by hand, switch licences off, free up their computers, see fingerprint machines that call with unknown serials, and every setting (product name, prices, trial length, Paddle keys, download links). Without `OWNER_EMAIL`/`OWNER_PASSWORD`, the first visit asks for a setup code printed in the server log.

**Trials and locking:** new gyms get a free trial (14 days by default). When the trial or the paid time ends, plus a few grace days, the gym's app shows *"Subscription ended · Renew now"* and its API answers 402; nothing is deleted. The dashboard shows a banner during the trial.

**Paddle (card payments):** Paddle is the merchant of record, so it handles tax and VAT worldwide and pays you out.
1. Create a Paddle account (start in **sandbox**), and three prices: online monthly, online yearly (both recurring) and the Windows licence (one-time).
2. In the owner panel → Settings: paste the price IDs (`pri_…`), the **client-side token**, and choose sandbox or live.
3. In Paddle → Notifications, add the webhook URL shown in Settings (`https://yourdomain.com/paddle/webhook`) for `subscription.*` and `transaction.completed`, and paste its **secret** into Settings.
4. Paddle reviews your website before going live: the pricing, terms, privacy and refund pages are there for that.

Until Paddle is set up, the pay buttons show your WhatsApp/email so buyers can pay you directly; then use **Add paid time** or **New licence** in the owner panel.

**Windows licences:** keys look like `GYM-7K2M-9QXF-4HTP-WN3B`. Activation (once, online) ties the key to the computer and returns a token signed with the platform's Ed25519 key (`license-private.pem` in the data folder; **back it up**). The app checks the signature on every start and asks the server every few days whether the key was switched off. Each key allows 2 computers by default.

### Put the platform online

On any Linux server (a €5 VPS is enough to start) with Docker:

```bash
git clone <this repo> && cd <repo>/gym-app/deploy
cp .env.example .env      # DOMAIN, OWNER_EMAIL, OWNER_PASSWORD
docker compose up -d --build
```

Point the domain's DNS at the server first; Caddy gets the HTTPS certificate by itself. Fingerprint machines connect over plain HTTP on `MACHINE_PORT` (8081): open it in the firewall. Machines reach the right gym by their serial number, which the gym enters in **Settings → Fingerprint & face machines**. Run `deploy/backup.sh` daily (cron) to keep copies of every gym.

Then in GitHub → Settings → Secrets and variables → Actions → **Variables**, add `GYM_PLATFORM_URL` (e.g. `https://gymdesk.com`), `PRODUCT_NAME`, and `LICENSE_PUBLIC_KEY` (shown in owner panel → Settings) so the next build of the apps knows your website: the Android app then accepts a gym code, and the Windows app activates licences there.

## Run one gym (development)

```bash
cd gym-app
npm start          # http://localhost:3100
npm test
```

- Member app: `http://localhost:3100` (demo member **1001**, PIN **1111**)
- Manager: `http://localhost:3100/admin` (owner PIN **1234**, front desk PIN **0000**)
- Kiosk: `http://localhost:3100/kiosk`
- Entry screen for a TV: `http://localhost:3100/display`

The first start creates **demo data**: 100 members with 14 months of fees, visits and expenses. Clear it in **Settings → Data** before going live, or start with `SEED=empty`.

| Setting | Meaning |
|---|---|
| `PORT` | Port to listen on (default 3100) |
| `DATA_FILE` | Where everything is saved (default `data/db.json`) |
| `SEED` | `demo` (default) or `empty`, used only when the data file doesn't exist yet |
| `OWNER_PIN` / `STAFF_PIN` | First PINs, used only when the data file doesn't exist yet |
| `CORS_ORIGINS` | Extra comma-separated origins allowed to call the API |

## Put a gym online

1. Deploy the `gym-app` folder with the `Dockerfile` to a host with a **persistent disk** (Railway, Fly.io, a VPS). Mount the disk at `/data`.
2. Point a domain at it with https, for example `app.ironrepublic.pk`.
3. Open `/admin`, change both PINs, clear the demo data, and add your plans, staff and members.

Back up `db.json` regularly. It is a single file holding the whole gym.

## Windows app (front desk computer)

`desktop/` holds an [Electron](https://www.electronjs.org) app. On first start it asks how the computer will be used:
- **Online account:** the gym types its address (or code) and the app opens its online dashboard.
- **Windows licence:** the buyer enters the licence key, then the gym's name, country and owner PIN. The gym server runs on this computer: phones on the gym Wi-Fi use the computer's address and the fingerprint machine sends punches to it.
- **Demo:** sample data to look around.

The **Gym** menu has the entry screen, the kiosk, **Phones and machines…** (the address to type into phones and machines), **Back up data…**, the data folder and switching mode.

Every push builds `gym-app-setup.exe` and puts it on the `app-latest` release. It is not code-signed, so Windows may say *"Windows protected your PC"*: click **More info → Run anyway** (a code-signing certificate removes this). Data is kept in `%APPDATA%\GymDesk`. Keep the computer on while the gym is open.

```bash
cd desktop && npm install && npm start      # try it
npm run dist                                # build the Windows installer
```

## Android and iPhone apps

The apps use [Capacitor](https://capacitorjs.com) to package the same screens as native apps. The projects are in `android/` and `ios/`.

**Android APK without installing anything:** every push that changes `gym-app/` runs the GitHub Action **"Gym app · Android & iOS"**. Download the **android-apk** artifact from the run and install it on a phone.

**Point the app at your server:** add a repository variable `GYM_API_URL` (Settings → Secrets and variables → Actions → Variables), for example `https://app.ironrepublic.pk`. Without it, the app asks for the server address the first time it opens.

**Build locally:**

```bash
npm install
API_URL=https://app.ironrepublic.pk npm run mobile:android   # Android Studio
API_URL=https://app.ironrepublic.pk npm run mobile:ios       # Xcode, Mac only
```

- **Play Store:** a Google Play developer account (one-time $25). In Android Studio use *Build → Generate Signed App Bundle*.
- **App Store:** a Mac with Xcode and an Apple Developer account ($99 a year). Choose your team under *Signing & Capabilities*, then *Product → Archive*.

### Rebrand for another gym

1. In `capacitor.config.json`, set `appId` (for example `pk.fitzone.app`) and `appName`. Change the same ID in `android/app/build.gradle` and in Xcode's bundle identifier.
2. Replace the images in `assets/`, then run `npm run mobile:icons`.
3. Build with that gym's `API_URL`.

## How it works

```
server.js              HTTP server, static files, security headers, CORS for the apps
lib/api.js             JSON API: public, member app, and owner/front-desk routes
lib/members.js         Membership maths: status, expiry, freezes, dues, month-by-month record
lib/availability.js    Class timetable with live spots
lib/store.js           JSON file storage with atomic writes, scrypt-hashed PINs
lib/demo.js            Demo gym generator
lib/validate.js        Input checks for every write
lib/access.js          Staff rights the owner can give each login
lib/web.js             Serves one gym (pages, API, photos, machines), also under /g/<gym>
lib/platform/          Multi-gym platform: sign-ups, trials, owner panel API, Paddle, licences, countries
site/                  Sales website and owner panel
desktop/               Windows app (Electron)
deploy/                Docker Compose with Caddy (HTTPS) and a backup script
public/                Member app (index), manager (admin), kiosk, shared styles
scripts/build-mobile.js  Copies public/ to www/ for Capacitor and sets the server URL
```

- A membership's expiry is the end of the latest paid period plus any freeze days.
- Revenue is counted on the day money is received, so instalments land in the right month.
- A month counts as "paid" when any fee period covers part of it, and as "attended" when there was at least one check-in.
