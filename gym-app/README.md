# Gym app: members, fees and attendance, with Android and iPhone apps

A complete management app for a gym, plus an app for its members. It is built to be sold to gyms: each gym gets its own server, name, colour and plans, and nothing in the code changes per client.

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
- **Expenses** (owner only): rent, salaries, bills, equipment and your own categories.
- **Reports** (owner only): fees collected, expenses, profit, new members, renewals, lapsed members, visits, admission fees, discounts, daily collection, and breakdowns by method, plan and expense category. Members, fees, attendance and daily totals export to CSV for Excel.
- **Enquiries:** people who asked to join from the app, with WhatsApp follow-up and one-tap "make member".
- **Settings** (owner only): gym details, brand colour, admission fee, reminder days, blocking expired members at check-in, opening hours, plans, trainers and staff with salaries, PINs, and clearing the demo data.
- **Two PINs:** the owner PIN opens everything. The front desk PIN can check members in, add members and collect fees, but cannot see money reports, expenses or settings.

**Fingerprint machine:** ZKTeco and other attendance machines that support "Cloud server / ADMS" push send every thumb punch to `/iclock/cdata`. Enroll each member's thumb on the machine with User ID = member number, set the machine's server address to your domain, and approve it in **Settings → Fingerprint machine**. The first punch of the day checks the member in, the next one checks them out, and double taps within 2 minutes are ignored. Punches from IDs that aren't members are listed so you can fix the enrollment. Settings also has a "Punch" button to try it without a machine.

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

## Run it

```bash
cd gym-app
npm start          # http://localhost:3100
npm test
```

- Member app: `http://localhost:3100` (demo member **1001**, PIN **1111**)
- Manager: `http://localhost:3100/admin` (owner PIN **1234**, front desk PIN **0000**)
- Kiosk: `http://localhost:3100/kiosk`

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
public/                Member app (index), manager (admin), kiosk, shared styles
scripts/build-mobile.js  Copies public/ to www/ for Capacitor and sets the server URL
```

- A membership's expiry is the end of the latest paid period plus any freeze days.
- Revenue is counted on the day money is received, so instalments land in the right month.
- A month counts as "paid" when any fee period covers part of it, and as "attended" when there was at least one check-in.
