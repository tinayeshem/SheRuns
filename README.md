# Safe Run

A web app that gives every street a safety score from 0 to 100 that changes with the time of day, and plans running routes around it.

- Time-aware street scores (lighting, isolation, foot traffic, traffic, surface, community reports)
- Loop routes and A to B routes, with address search, a safe window, and the weakest stretch
- Community reports with moderation
- Health layer (air quality, ice risk, "how do you feel" suggestion)
- Live run with a share link, check-in timer, SOS, and optional text alerts
- Accounts, run history, settings

Demo city: **Kraków**.

---

## What you need

| Tool | Why | Check |
|---|---|---|
| Node.js 20 or newer | runs the backend and the frontend | `node -v` |
| A free Supabase account | database (PostgreSQL + PostGIS) and logins | supabase.com |
| About 1 GB of free disk space | map data file | |

Text alerts (Twilio) are optional. Without them the app prints each text in the backend terminal instead of sending it.

---

## Folder layout

```
ImpactHer/
  BackEnd/              Express API (TypeScript)
    data/               the map file goes here (not committed)
    src/
    .env                your secrets (not committed)
  Frontend/
    safe-run-web/       React app (Vite + TypeScript)
      src/
      .env              your frontend settings (not committed)
```

The backend and the frontend are two separate projects. Each has its own `package.json`, its own terminal, and its own `.env`.

---

## Step 1. Create the Supabase project

1. Go to supabase.com and create a new project. Save the **database password**. Use letters and numbers only, so you don't have to encode it.
2. Open **Database**, then **Extensions**, search `postgis`, and switch it on.
3. Open **SQL Editor**, then **New query**. Paste the whole script from **Appendix A** at the bottom of this file and press **Run**. It should say "Success".
4. Check the weights add up. Run this and expect `1.00` on both rows:
   ```sql
   select period, sum(weight) from scoring_config group by period;
   ```
5. Open **Authentication**, then **URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: add `http://localhost:5173/**`
6. Open **Authentication**, then **Sign In / Providers**, then **Email**. Turn **Confirm email** off for the demo.

### Copy your keys

You need four values. Keep them private.

| Value | Where to find it |
|---|---|
| Database connection string | Click **Connect** at the top, open the **Direct** tab, set the method to **Session pooler**, and copy the string. Replace `[YOUR-PASSWORD]` with your password, no brackets. |
| Project URL | **Project Settings**, **API Keys** |
| Publishable key (also called "anon") | **Project Settings**, **API Keys**. Safe for the browser. |
| Secret key (also called "service_role") | **Project Settings**, **API Keys**. Backend only. Never put it in the frontend or in Git. |

The connection string must start with `postgresql://postgres.` followed by your project reference, and the host must contain `pooler.supabase.com`. The plain `db.xxxx.supabase.co` address does not work on most home networks.

---

## Step 2. Download the map data

1. Open `https://download.geofabrik.de/europe/poland/malopolskie.html`.
2. Download `malopolskie-latest.osm.pbf` (about 200 MB).
3. Put it in `BackEnd/data/` (create the `data` folder if it is missing).
4. The file name must be exactly `malopolskie-latest.osm.pbf`. If your download has a date in the name, rename it. Check with `dir data` (Windows) or `ls data` (Mac and Linux).

---

## Step 3. Set up the backend

Open a terminal in the `BackEnd` folder.

1. Install the packages:
   ```
   npm install
   ```
2. Create a file named `.env` in `BackEnd` (next to `package.json`) with this content, using your own values:
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
   - No quotes, and no spaces around `=`.
   - Generate a random value for `SMS_PEPPER` with:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `GEOCODER_CONTACT` is sent with address searches, as the free search service requires.
3. Check that `.gitignore` lists `.env`, `node_modules`, `dist`, and `data`.
4. Check that `package.json` has these scripts:
   ```json
   "scripts": {
     "dev": "tsx watch src/index.ts",
     "import:pbf": "tsx src/workers/importFromPbf.ts",
     "compute:neighbors": "tsx src/workers/computeNeighbors.ts",
     "import:places": "tsx src/workers/importPlaces.ts"
   }
   ```
5. Load the map data into the database. Run these three commands **one at a time**, and wait for each to print `Done.` before starting the next one.
   ```
   npm run import:pbf
   npm run compute:neighbors
   npm run import:places
   ```
   | Command | What it does | Time |
   |---|---|---|
   | `import:pbf` | reads the map file and stores the street pieces | 3 to 6 minutes |
   | `compute:neighbors` | counts how busy the area around each street is | 5 to 15 minutes |
   | `import:places` | stores pharmacies, hospitals, police, shops | 1 to 3 minutes |

   The terminal looks stuck while it works. Do not press `Ctrl + C`. All three are safe to run again.
6. Check the data in the Supabase SQL Editor. All three numbers must be equal and in the hundreds of thousands:
   ```sql
   select count(*) as total, count(source) as connected, count(neighbors) as ranked from segments;
   ```
7. Start the API:
   ```
   npm run dev
   ```
   You should see `API running on http://localhost:3000`. Leave this terminal open.
8. Test it in the browser:
   - `http://localhost:3000/health` shows `{"status":"ok"}`
   - `http://localhost:3000/db-check` shows `"database":"connected"` and a PostGIS version

---

## Step 4. Set up the frontend

Open a **second** terminal in `Frontend/safe-run-web`.

1. Install the packages:
   ```
   npm install
   ```
2. Install the pinned map library. Version 4 is required, because version 5 breaks with Vite:
   ```
   npm install maplibre-gl@4.7.1
   ```
3. Create a file named `.env` in `Frontend/safe-run-web`:
   ```
   VITE_API_URL=http://localhost:3000
   VITE_SUPABASE_URL=https://YOURPROJECTREF.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-key
   ```
   Only the **publishable** key goes here, never the secret key.
4. Check that `vite.config.ts` has no `optimizeDeps.exclude` for maplibre-gl:
   ```ts
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import tailwindcss from "@tailwindcss/vite";

   export default defineConfig({
     plugins: [react(), tailwindcss()],
   });
   ```
5. Start the app:
   ```
   npm run dev
   ```
6. Open `http://localhost:5173/`. The landing page shows first.

---

## Step 5. Try it

1. On the landing page, click **Try as guest**. You see the map with colored streets. Drag the **Time of day** slider to 22:00 and park paths turn yellow or red.
2. Click any street to see why it got its score.
3. Click **RUN NOW** to open the planner. Choose **Loop** or **A to B**, type addresses and press Enter, and click **Find routes**.
4. Click **Get started** to create an account. Reporting a problem and starting a live run need an account.
5. Report an issue, then open **Reports** and confirm it from a second account (use a private browser window).
6. Start a run. Copy the share link and open it in a private window: that is what a trusted contact sees.

### Make yourself a moderator

1. Sign up in the app first.
2. Run this in the Supabase SQL Editor, with your own email:
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'you@example.com';
   ```
3. Log out and log in again. A **Moderation** button appears on the map page, and `/admin` opens the review queue.

### Turn on row-level security (do this last)

After everything works, run **Appendix B**. It stops anyone from reading your tables through Supabase's public API. The backend keeps working, because it connects directly.

---

## Text alerts (optional)

Without Twilio, the backend prints each alert in its terminal. The message starts with `[SMS test mode]`. To send real texts:

1. Create a Twilio account. A trial account can text only numbers you have verified in the Twilio Console.
2. Enable the country you need under Messaging, Geo permissions.
3. Add to `BackEnd/.env`:
   ```
   TWILIO_ACCOUNT_SID=your-sid
   TWILIO_AUTH_TOKEN=your-token
   TWILIO_FROM=+1your-twilio-number
   PUBLIC_URL=https://your-public-site-address
   SMS_DAILY_CAP=50
   ```
4. Restart the backend. It prints `SMS alerts: live (Twilio)`.
5. Links in the texts use `PUBLIC_URL`. With `localhost` the link will not open on a contact's phone.

---

## Everyday use

Start both terminals:

| Terminal | Folder | Command |
|---|---|---|
| 1 | `BackEnd` | `npm run dev` |
| 2 | `Frontend/safe-run-web` | `npm run dev` |

Check for code errors in either project:
```
npx tsc --noEmit
```
No output means no errors.

After you change a `.env` file, stop the server with `Ctrl + C` and start it again. Environment files are only read at startup.

---

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `ENOTFOUND db.xxxx.supabase.co` | You used the direct connection string. Use the **Session pooler** string. |
| `password authentication failed for user "postgres"` | The username must be `postgres.YOURPROJECTREF`, not `postgres`. Check the password too. Reset it in **Project Settings**, **Database**. |
| `function postgis_version() does not exist` | Enable the `postgis` extension in Supabase, Step 1.2. |
| `No inputs were found in config file tsconfig.json` | Your code is not inside `BackEnd/src`. Move the folders into `src`. |
| `Cannot find module '.../src/index.ts'` | The file is missing or empty. Check `dir src`. |
| `File not found: ...malopolskie-latest.osm.pbf` | The map file is missing or misnamed. See Step 2. |
| Streets never get colors, Console says `Worker failed to load` | Wrong maplibre-gl version. Run `npm install maplibre-gl@4.7.1`, remove `optimizeDeps.exclude` from `vite.config.ts`, delete `node_modules/.vite`, and run `npm run dev -- --force`. |
| Map shows "API KEY REQUIRED" | The map tile provider needs a key. Use the OpenStreetMap tile address in `src/map/MapView.tsx`: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. |
| CORS error in the browser Console | `CLIENT_URL` in `BackEnd/.env` must be exactly `http://localhost:5173`. Restart the backend. |
| `401 Please log in to do this.` | You are not logged in, or `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `BackEnd/.env` are wrong. |
| Blank page and `Missing VITE_SUPABASE_URL` | The frontend `.env` is missing. Restart `npm run dev` after creating it. |
| `Property 'env' does not exist on type 'ImportMeta'` | `src/vite-env.d.ts` is missing, or the file is inside `BackEnd` instead of the frontend. |
| `Argument of type 'string \| string[]'` | Wrap the value in `String(...)`, for example `String(req.params.id)`. |
| Landing page looks like the map | `src/pages/Landing.tsx` contains the wrong code, or `App.tsx` does not route `/` to `Landing`. |
| "Address search is busy" | The free search service allows 1 request per second. Wait a few seconds. |
| "no street data here" | The map import did not finish. Rerun Step 3.5 and check Step 3.6. |
| Everything is slow after a restart | The first request after a restart loads data. Wait a few seconds and try again. |

---

## Good to know

- **Demo scope.** Street data, address search, and the places shown cover the Kraków box in `importFromPbf.ts`. To use another city, download its region file and change the file name and the four coordinates at the top of the import scripts and of `src/integrations/geocoder.ts`.
- **Scores are estimates.** They come from OpenStreetMap tags (lighting, surface, road type), a street-density measure, and runner reports. Streets with no lighting tag are shown faded with a low confidence label.
- **Privacy.** A live run sends the runner's position to the server every 10 seconds. It is deleted when the run ends, and the share link expires. Phone numbers for text alerts are sent only when the runner ticks the consent box, and are deleted when the run ends. Profile, contacts, and run history stay in the browser.
- **Before a public launch.** Turn on email confirmation and add a CAPTCHA, connect a real email provider, replace the free map tiles and address search with plans that allow public use, host the backend on an always-on server (text alerts need it), add a privacy policy, and review data protection rules.
- **Safety.** The SOS button does not contact emergency services. It marks SOS on the share link, offers a call to 112, and texts the runner's contacts if alerts are on.

---

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, MapLibre GL, Lucide icons
- Backend: Node.js, Express, TypeScript, PostgreSQL with PostGIS
- Services: Supabase (database and logins), OpenStreetMap (map data and tiles), Open-Meteo (weather, air quality, elevation), Nominatim (address search), Twilio (optional text alerts)

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

If the map, routes, reports, or live runs stop working afterwards, tell whoever maintains the project right away.
