# Safe Run

**Run where it feels safe.**

Safe Run is a web app that gives every street a safety score from 0 to 100. The score changes with the time of day, so the same park path can be green at 14:00 and red at 22:00. The app uses the scores to plan running routes, warns about weak stretches, and adds a live safety net for every run.

Demo city: **Kraków, Poland**.

---

## Contents

1. [The problem](#1-the-problem)
2. [What the app does](#2-what-the-app-does)
3. [How the safety score works](#3-how-the-safety-score-works)
4. [Run it on your computer](#4-run-it-on-your-computer)
5. [Try it (2-minute demo)](#5-try-it-2-minute-demo)
6. [Troubleshooting](#6-troubleshooting)
7. [Known limits and what to improve](#7-known-limits-and-what-to-improve)
8. [How I used AI](#8-how-i-used-ai)
9. [Data sources and credits](#9-data-sources-and-credits)
10. [Appendix: database scripts](#appendix-a-database-script)

---

## 1. The problem

Many runners, especially women, change where and when they run because they do not feel safe, or stop running altogether. Surveys report:

| Finding | Source |
|---|---|
| 92% of women runners are concerned about their safety outdoors | Adidas survey of 9,000 runners in nine countries |
| 60% of women runners have been harassed while running | Runner's World and Women's Health survey, 2021 |
| 11% of women stopped running because of harassment | Runner's World and Women's Health survey, 2021 |
| 31% of adults worldwide do not get enough physical activity | World Health Organization |

These surveys are self-reported and mostly from the UK, the US, and other countries, not from Poland. Fear is one barrier to exercise that software can help with.

Most running apps plan routes by distance, speed, or scenery. They do not treat safety as something that changes with the time of day and with who is running.

---

## 2. What the app does

- **Time-aware street scores.** Every street piece is colored green, yellow, or red for the hour you choose. Click a street to see why it got its score.
- **Route planning.** Loop routes by distance, or A to B routes between two typed addresses. Up to three options per search, each with a score, a "safe window" (the hours when the whole route is green), and its weakest stretch.
- **Your profile counts.** Running alone, at night, with a dog, as a beginner, or with low vision changes how much each safety check weighs.
- **Avoid weak stretches.** One button re-plans a route around the streets that score low.
- **Safe stops.** Pharmacies, hospitals, police stations, and shops along the route.
- **Community reports.** Runners report broken lights, ice, harassment, and more. Reports fade after 7 days unless others confirm them, and moderators review them.
- **Health layer.** Air quality, ice risk, and a "how do you feel today" choice that suggests an easier loop when you are tired.
- **Live run.** A share link that expires, a check-in timer, an SOS panel with a one-tap call to 112, and optional text alerts to trusted contacts.
- **Accounts, history, settings.** Sign up, log in, run history, and a delete-my-account button.

---

## 3. How the safety score works

Each street piece gets six grades from 0 to 100:

| Check | Question it answers | Data |
|---|---|---|
| Lighting | Is the street lit? | OpenStreetMap `lit` tag |
| Isolation | Are streets and people around? | Street density around the piece |
| Foot traffic | Is it usually busy at this hour? | Street density and an hourly pattern |
| Traffic | Are fast cars there? | Road type, speed limit, sidewalk |
| Surface | Is the ground smooth? | OpenStreetMap `surface` tag |
| Reports | Has a problem been reported nearby? | Runner reports, fading with age |

The six grades are mixed with **day weights** or **night weights** (night counts lighting and isolation more). Your profile then changes the weights. The result becomes a color:

- **Green**: 70 to 100, good to run
- **Yellow**: 40 to 69, be careful
- **Red**: 0 to 39, avoid

Safety rules that sit on top of the average:

- If 100 m or more of a route is red, the whole route is capped at yellow.
- A confirmed harassment report turns a street red at any hour. Ice and flooding reports lower it by one level.
- Where the lighting tag is missing, the score is an estimate and is shown faded with a "low confidence" label.

---

## 4. Run it on your computer

### What you need

| Tool | Check |
|---|---|
| Node.js 20 or newer | `node -v` |
| A free Supabase account (supabase.com) | |
| About 1 GB of free disk space | |

### Folder layout

```
ImpactHer/
  BackEnd/              Express API (TypeScript)
    data/               the map file goes here (never committed)
    src/
    .env                your secrets (never committed)
  Frontend/
    safe-run-web/       React app (Vite + TypeScript)
      src/
      .env              your frontend settings (never committed)
```

The backend and the frontend are two separate projects with their own `package.json`, their own terminal, and their own `.env`.

### Quick summary

1. Create the Supabase project and run the database script.
2. Download the map file into `BackEnd/data/`.
3. Backend: add `.env`, `npm install`, run three imports, `npm run dev`.
4. Frontend: add `.env`, `npm install`, `npm run dev`.
5. Open `http://localhost:5173/`.

### Step 1. Create the Supabase project

1. Create a new project at supabase.com. Save the database password. Use letters and numbers only.
2. Open **Database**, then **Extensions**, search `postgis`, and switch it on.
3. Open **SQL Editor**, paste the script from **Appendix A**, and press **Run**.
4. Open **Authentication**, then **URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: add `http://localhost:5173/**`
5. Open **Authentication**, then **Sign In / Providers**, then **Email**, and turn **Confirm email** off (demo only).

Copy these four values. Keep them private.

| Value | Where to find it |
|---|---|
| Database connection string | Click **Connect**, open the **Direct** tab, set the method to **Session pooler**, and copy the string. Replace `[YOUR-PASSWORD]` with your password, with no brackets. |
| Project URL | **Project Settings**, **API Keys** |
| Publishable key (also called "anon") | **Project Settings**, **API Keys**. Safe for the browser. |
| Secret key (also called "service_role") | **Project Settings**, **API Keys**. Backend only. |

The connection string must start with `postgresql://postgres.` followed by your project reference, and the host must contain `pooler.supabase.com`.

### Step 2. Download the map file

1. Open `https://download.geofabrik.de/europe/poland/malopolskie.html`.
2. Download `malopolskie-latest.osm.pbf` (about 200 MB).
3. Save it as `BackEnd/data/malopolskie-latest.osm.pbf`. Create the `data` folder if needed. If the downloaded file has a date in its name, rename it.

The file is too large for GitHub (limit 100 MB), so it is ignored by Git. Everyone who runs the project downloads it once.

### Step 3. Backend

Open a terminal in the `BackEnd` folder.

1. Install:
   ```
   npm install
   ```
2. Create `BackEnd/.env`, next to `package.json`:
   ```
   PORT=3000
   CLIENT_URL=http://localhost:5173
   DATABASE_URL=postgresql://postgres.YOURPROJECTREF:YOURPASSWORD@aws-0-xx-xxxx-x.pooler.supabase.com:5432/postgres

   SUPABASE_URL=https://YOURPROJECTREF.supabase.co
   SUPABASE_ANON_KEY=your-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key

   SMS_PEPPER=any-long-random-text
   GEOCODER_CONTACT=your-email@example.com
   ```
   No quotes, and no spaces around `=`. Make a random `SMS_PEPPER` with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. Check `package.json` has these scripts:
   ```json
   "scripts": {
     "dev": "tsx watch src/index.ts",
     "import:pbf": "tsx src/workers/importFromPbf.ts",
     "compute:neighbors": "tsx src/workers/computeNeighbors.ts",
     "import:places": "tsx src/workers/importPlaces.ts"
   }
   ```
4. Load the map data. Run the three commands **one at a time**, and wait for each to print `Done.`:
   ```
   npm run import:pbf
   npm run compute:neighbors
   npm run import:places
   ```
   | Command | What it does | Time |
   |---|---|---|
   | `import:pbf` | stores the street pieces | 3 to 6 minutes |
   | `compute:neighbors` | measures how busy the area around each street is | 5 to 15 minutes |
   | `import:places` | stores pharmacies, hospitals, police, shops | 1 to 3 minutes |

   The terminal looks stuck while it works. Do not press `Ctrl + C`.
5. Check the data in the Supabase SQL Editor. The three numbers must be equal:
   ```sql
   select count(*) as total, count(source) as connected, count(neighbors) as ranked from segments;
   ```
6. Start the API (leave this terminal open):
   ```
   npm run dev
   ```
   You should see `API running on http://localhost:3000`.
7. Test: `http://localhost:3000/health` shows `{"status":"ok"}`, and `http://localhost:3000/db-check` shows `"database":"connected"`.

### Step 4. Frontend

Open a **second** terminal in `Frontend/safe-run-web`.

1. Install:
   ```
   npm install
   npm install maplibre-gl@4.7.1
   ```
   The map library must be version 4. Version 5 breaks with Vite.
2. Create `Frontend/safe-run-web/.env`:
   ```
   VITE_API_URL=http://localhost:3000
   VITE_SUPABASE_URL=https://YOURPROJECTREF.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-key
   ```
   Only the **publishable** key goes here, never the secret key.
3. Check `vite.config.ts` has no `optimizeDeps.exclude`:
   ```ts
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import tailwindcss from "@tailwindcss/vite";

   export default defineConfig({
     plugins: [react(), tailwindcss()],
   });
   ```
4. Start:
   ```
   npm run dev
   ```
5. Open `http://localhost:5173/`. The landing page shows first.

### Every day after setup

| Terminal | Folder | Command |
|---|---|---|
| 1 | `BackEnd` | `npm run dev` |
| 2 | `Frontend/safe-run-web` | `npm run dev` |

- Check for code errors in either project with `npx tsc --noEmit`. No output means no errors.
- After you change a `.env` file, stop the server with `Ctrl + C` and start it again.

### Make yourself a moderator

1. Sign up in the app first.
2. Run in the Supabase SQL Editor, with your own email:
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'you@example.com';
   ```
3. Log out and log in again. A **Moderation** button appears on the map page.

### Turn on row-level security (do this last)

Once everything works, run **Appendix B**. It stops anyone from reading your tables through Supabase's public API. The backend keeps working, because it connects directly.

### Optional: real text alerts

Without Twilio, the backend prints each alert in its terminal as `[SMS test mode]`. For real texts:

1. Create a Twilio account (a trial account texts only verified numbers) and enable the country you need.
2. Add to `BackEnd/.env`:
   ```
   TWILIO_ACCOUNT_SID=your-sid
   TWILIO_AUTH_TOKEN=your-token
   TWILIO_FROM=+1your-twilio-number
   PUBLIC_URL=https://your-public-site-address
   SMS_DAILY_CAP=50
   ```
3. Restart the backend. It prints `SMS alerts: live (Twilio)`.

---

## 5. Try it (2-minute demo)

1. Open `http://localhost:5173/` and click **Try as guest**.
2. On the map, drag **Time of day** from 14:00 to 22:00. Park paths turn yellow or red.
3. Click a park path. The popup shows each check and the weakest one.
4. Click **RUN NOW**. Choose **A to B**, type a start and an end address, press Enter on each, and click **Find routes**.
5. Open **Route details** and click **Avoid weak stretches**. The score goes up.
6. Create an account. Open **Report**, report "Ice" on a street, and watch the street's color drop.
7. Plan a route, tap **Start run**, copy the share link, and open it in a private window. That is the view of a trusted contact.
8. Open **Health** and tap **Tired** to get a shorter, well-lit loop.

---

## 6. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `ENOTFOUND db.xxxx.supabase.co` | You used the direct connection string. Use the **Session pooler** string. |
| `password authentication failed for user "postgres"` | The username must be `postgres.YOURPROJECTREF`. Check the password too. |
| `function postgis_version() does not exist` | Enable the `postgis` extension in Supabase. |
| `No inputs were found in config file tsconfig.json` | Your code is not inside `BackEnd/src`. |
| `Cannot find module '.../src/index.ts'` | The file is missing or empty. |
| `File not found: ...malopolskie-latest.osm.pbf` | The map file is missing or misnamed. See Step 2. |
| Streets never get colors, Console says `Worker failed to load` | Wrong maplibre-gl version. Run `npm install maplibre-gl@4.7.1`, remove `optimizeDeps.exclude`, delete `node_modules/.vite`, run `npm run dev -- --force`. |
| Map shows "API KEY REQUIRED" | That tile provider needs a key. Use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` in `src/map/MapView.tsx`. |
| CORS error in the browser Console | `CLIENT_URL` in `BackEnd/.env` must be exactly `http://localhost:5173`. Restart the backend. |
| `401 Please log in to do this.` | You are not logged in, or the Supabase values in `BackEnd/.env` are wrong. |
| Blank page and `Missing VITE_SUPABASE_URL` | The frontend `.env` is missing. Restart `npm run dev`. |
| `Property 'env' does not exist on type 'ImportMeta'` | `src/vite-env.d.ts` is missing, or the file is in the wrong project. |
| `Argument of type 'string \| string[]'` | Wrap the value in `String(...)`. |
| Landing page looks like the map | `src/pages/Landing.tsx` has the wrong code, or `App.tsx` does not route `/` to `Landing`. |
| "Address search is busy" | The free search service allows 1 request per second. Wait a few seconds. |
| "no street data here" | The map import did not finish. Repeat Step 3.4 and check Step 3.5. |
| `git push` rejected: file exceeds 100 MB | The map file is committed. Run `git rm -r --cached BackEnd/data`, add `BackEnd/data/` and `*.osm.pbf` to the top-level `.gitignore`, and amend the commit. |

---

## 7. Known limits and what to improve

I want to be honest about what this prototype does not do yet.

### Safety model

- **The scores are estimates, not measurements of danger.** They are built from OpenStreetMap tags and a street-density measure, and they have not been checked against real incident, crime, or accident data. Validating them is the most important next step.
- **Isolation and foot traffic are guessed from street density.** Better data: shops and bus stops with opening hours, public transport stops, pedestrian counts, or the city's own data.
- **Crossings and "open businesses nearby" were planned but are not built.**
- **Missing lighting tags.** Where OpenStreetMap has no `lit` tag, the app estimates. Using the city's street-lighting map would fix many of these.
- **Air quality is a model forecast** (Open-Meteo), not a station reading. Polish stations (GIOŚ) would be more accurate.
- **Ice risk is a simple rule** (temperature, rain, humidity), not a measurement.
- **Reports can be abused.** Ideas: report photos, reputation, per-IP limits, and a better moderation tool.

### Live safety

- **Text alerts need consent checks.** Today the runner ticks a box saying they told their contacts. A real launch needs contacts to confirm by replying YES, plus a STOP option.
- **Phones lock.** A website cannot track GPS reliably in the background. A native app, or a Progressive Web App with better background support, would fix this.
- **The SOS button does not contact emergency services.** It marks SOS on the share link, offers a call to 112, and texts contacts if alerts are on.
- **Heart rate and pace alerts, and "unlit stretch ahead" warnings,** are not built.

### Product

- **Not deployed.** Phones need HTTPS for location, so a real test needs hosting (for example Vercel for the frontend and Render for the backend).
- **English only.** A Polish translation would help the target users.
- **History and profile live only in the browser,** so they are lost on a new device. Syncing them needs more server storage and a privacy review.
- **Only Kraków.** Other cities need their own map file and area box.
- **Accessibility.** The app has labels and keyboard support, but needs a proper audit (screen reader, contrast, color-blind check for the green, yellow, red).

### Engineering

- **No automated tests.** The scoring and routing code should have unit tests.
- **Routes are computed on every request,** from streets loaded into memory. Caching or precomputed scores would be faster.
- **Rename `device_id`.** In the database it now stores the user's ID.
- **Accounts:** turn on email confirmation, add a CAPTCHA, and connect a real email provider.
- **Free services have usage rules.** The free map tiles and address search (Nominatim) are for light use. A public launch needs paid plans or self-hosting.
- **Privacy and law.** A launch needs a privacy policy and a GDPR review, because the app handles locations, emails, and phone numbers.
- **Security review.** Row-level security is on, but the app has not had a professional security test.

---

## 8. How I used AI



I built this project together with an AI assistant, **Claude (by Anthropic)**, in a chat. I am not hiding that: some of the code in this repository was written by the AI from my instructions, and I ran, tested, and fixed it step by step.

### What I did

- I chose the problem (runner safety) and wrote the feature list: time-aware scores, safety profiles, community reports, a health layer, and live safety features.
- I made the product decisions: the demo city, the purple look, the pages, which features to build first, and the design references I wanted the landing page and sign-up page to follow.
- I set up the accounts and services myself: Supabase, the database, the map data, the Git repository.
- I ran every step on my own computer, tested it in the browser, and reported errors with screenshots and terminal output so they could be fixed.
- I debugged setup problems, such as the database connection, the map library version, folder structure mistakes, and the large file that GitHub rejected.


### What the AI did

- It explained and designed the architecture: the folder structure, the layers of the backend, and the database tables.
- It proposed the safety scoring model: the six checks, the day and night weights, the profile adjustments, and the safety rules.
- It wrote most of the TypeScript and React code, the SQL scripts, the styling, and this README.
- It found and summarised the survey statistics in section 1 (I should double-check them against the original sources before presenting).
- It helped me fix errors when I pasted them.
- It help understand the math for the backend




---

## 9. Data sources and credits

- Map data: © OpenStreetMap contributors (ODbL license). openstreetmap.org/copyright
- Regional map extract: Geofabrik (download.geofabrik.de)
- Weather, air quality, and elevation: Open-Meteo (open-meteo.com)
- Address search: Nominatim, run by OpenStreetMap
- Database and logins: Supabase
- Text alerts (optional): Twilio
- Photo on the login pages: Filip Mroz on Unsplash [check the photo's page for the exact credit]
- Statistics: Adidas runner safety survey; Runner's World and Women's Health survey (2021); World Health Organization physical activity fact sheet

### Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, MapLibre GL, Lucide icons
- Backend: Node.js, Express, TypeScript, PostgreSQL with PostGIS

---

## Appendix A. Database script

Paste into the Supabase SQL Editor and run once.

```sql
create extension if not exists postgis;

-- street pieces from OpenStreetMap
create table if not exists segments (
  id bigserial primary key,
  osm_way_id bigint,
  name text,
  highway text,
  lit boolean,
  surface text,
  maxspeed int,
  sidewalk text,
  length_m real,
  geom geometry(LineString, 4326) not null,
  source bigint,
  target bigint,
  street_m real,
  neighbors int,
  created_at timestamptz not null default now()
);
create index if not exists segments_geom_idx on segments using gist (geom);
create index if not exists segments_osm_idx on segments (osm_way_id);

-- report types and their penalties
create table if not exists report_types (
  key text primary key,
  label text not null,
  penalty smallint not null
);

-- community reports
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  type text not null references report_types(key),
  note text,
  photo_url text,
  confirmations int not null default 1,
  gone_votes int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','approved','removed')),
  geom geometry(Point, 4326) not null,
  device_id text,
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index if not exists reports_geom_idx on reports using gist (geom);
create index if not exists reports_status_idx on reports (status, expires_at);

create table if not exists report_votes (
  report_id uuid not null references reports(id) on delete cascade,
  device_id text not null,
  vote text not null check (vote in ('confirm','gone')),
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);

-- score weights for day and night
create table if not exists scoring_config (
  factor text not null,
  period text not null check (period in ('day','night')),
  weight numeric(4,2) not null check (weight between 0 and 1),
  primary key (factor, period)
);

-- live runs
create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_key_hash text not null,
  device_id text,
  display_name text,
  expected_end timestamptz not null,
  grace_min int not null default 10,
  expires_at timestamptz not null,
  started_at timestamptz not null default now(),
  last_lng double precision,
  last_lat double precision,
  last_update_at timestamptz,
  trail jsonb not null default '[]'::jsonb,
  sos_at timestamptz,
  finished_at timestamptz,
  alert_phones jsonb not null default '[]'::jsonb,
  overdue_alert_at timestamptz,
  sos_alert_at timestamptz,
  alert_fail int not null default 0
);
create index if not exists live_sessions_expires_idx on live_sessions (expires_at);

-- text alert log (stores a hash of each number, never the number)
create table if not exists sms_log (
  id bigserial primary key,
  device_id text,
  session_id uuid,
  kind text not null,
  phone_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists sms_log_created_idx on sms_log (created_at);
create index if not exists sms_log_phone_idx on sms_log (phone_hash, created_at);
create index if not exists sms_log_device_idx on sms_log (device_id, created_at);

-- starting data
insert into report_types (key, label, penalty) values
  ('broken_light','Broken light',15),
  ('ice','Ice',30),
  ('flooding','Flooding',30),
  ('construction','Construction',20),
  ('aggressive_dog','Aggressive dog',25),
  ('harassment','Harassment',60),
  ('poor_visibility','Poor visibility',15)
on conflict (key) do nothing;

insert into scoring_config (factor, period, weight) values
  ('lighting','day',0.05),    ('lighting','night',0.30),
  ('isolation','day',0.15),   ('isolation','night',0.25),
  ('foot_traffic','day',0.15),('foot_traffic','night',0.20),
  ('traffic','day',0.30),     ('traffic','night',0.10),
  ('surface','day',0.20),     ('surface','night',0.05),
  ('reports','day',0.15),     ('reports','night',0.10)
on conflict (factor, period) do nothing;
```

Check the weights add up to 1.00 for both day and night:

```sql
select period, sum(weight) from scoring_config group by period;
```

## Appendix B. Row-level security

Run this after the three imports have finished and the app works.

```sql
alter table segments enable row level security;
alter table report_types enable row level security;
alter table reports enable row level security;
alter table report_votes enable row level security;
alter table scoring_config enable row level security;
alter table live_sessions enable row level security;
alter table sms_log enable row level security;
alter table places enable row level security;
```

Check that the public key can no longer read anything. This should return `[]`:

```
curl -H "apikey: YOUR_PUBLISHABLE_KEY" "https://YOURPROJECTREF.supabase.co/rest/v1/live_sessions?select=token"
```
