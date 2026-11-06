# Phone app demo site

A static page that runs Ira's three iPhone apps, **Health** (`health-app` repo),
**Recipes** (`recipes-app`) and **Claro** (`claro-spanish`), plus **PickleCourts**
(`Juniper-Lane-Software/okc-courts-app`, co-developed; the other co-developer agreed to it
being shown), inside phone frames on invented data, with notes on what makes each app different, how they connect, how AI is
used, and "Try this" lists. It is written for people hiring for AI engineering roles.

- **Public site:** https://iramillington.github.io/app-demo/ (GitHub Pages from the top of
  this repo's `main`; `tools/` holds what builds it, `build.json` says which app commits it shows).
- **Automatic rebuilding:** `.github/workflows/rebuild.yml` every three hours
  checks whether health-app (`master`), claro-spanish or recipes-app (`main`) moved, and if so runs
  `ci/build.sh` and `ci/publish.sh`, which commits the new site to `main`. A push to `tools/`
  or a manual run always rebuilds. One secret, `DEMO_TOKEN` (read access to the three app
  repos), is needed; the foods the seed logs come from `stack/food_cache_rows.json`
  (public USDA data), so no USDA key is needed.
  A failed tour step, a server error or a real name in the recording fails the build
  (`ci/check_recordings.py`), and the old site stays up. Logs are kept as a run artifact.
- The tooling moved here from the private `home-infra` repo on Oct 30, because GitHub
  Actions are free in a public repo.

## What is real and what is stood in

- All three phones run the apps' **own source, unmodified**, exported for the web with
  `npx expo export --platform web`. The only build-time change is `health-web/metro.config.js`,
  which swaps two phone-only modules for web stand-ins in `health-web/demo-stubs/`:
  `expo-notifications` (no-ops) and `expo-image-picker` (a demo camera roll of the eight
  real meal photos in `demo-photos/`, credited in its `CREDITS.md` and made by `make-photos.py`). `web-polyfills.js` adds an iOS-style `Alert` dialog and
  one `TextInput` method react-native-web lacks.
- `demo-env.js` loads before each bundle. It pins "today" to the day the data was
  recorded (any time zone), fills in the saved state a signed-in phone would have, and
  draws a touch-style cursor with a tap ripple.
- **Claro** keeps all state on the device, so nothing else is needed. Its demo learner
  (`claro-seed.json`) is made by Claro's own functions: `claro-web/demo-seed.ts` runs
  reviews through its FSRS `rate()`, walks ten course units through every stage, and
  records slips; `check-seed.ts` validates it with the app's `parseBackup`.
- **Recipes** has its own server and Postgres (`stack/run-recipes.sh`, port 8092; the site
  reaches it as `https://health.tailc51c3c.ts.net/recipes`, like Funnel). `stack/seed_recipes.py`
  signs the demo people in with the one Health login, makes Sam friends with Jordan and
  Priya (Alex's request is left pending), and adds recipes (three of Ira's Instant Pot
  recipes and one invented) with every ingredient already matched to a USDA food. Matches
  are kept in `stack/recipe_foods.json`, so no USDA key is needed to rebuild. The same
  script gives Sam a "Spanish practice" habit filled in by Claro and its link code.
- **How they connect** is recorded too: the tour has Claro send today's minutes (which
  tick the habit), then Recipes "Save as a meal" and Health logging it. `demo-links.js`
  holds the two apps' saved state (signed in, linked).
- **Health** talks to the home server, so the page **replays** real server answers. All
  three phones load `replay.js` and share one `recordings.json` at the site root and one
  replay position in `sessionStorage`, so a change in one phone shows in the others. The
  page clears that state on load, so a reload starts over. Claro's sends are recorded
  first among the cross-app changes because the real Claro sends by itself shortly after
  opening.
  `replay.js` answers the app's fetches from `recordings.json`; each change the viewer
  makes moves the replay to the server's state right after that change was recorded.
  Settings changes (conditions, features) are kept on the page and laid over the profile.
  A change the tour never made gets the nearest recorded answer.
- The recording: the real `health-app` server (`stack/demo_server.py`) ran against a
  throwaway local Postgres 16 + PostgREST 12.2.12 database (`stack/pgrst.conf`) with an
  empty environment (`stack/run-server.sh`: no real keys or databases reachable; only
  the USDA food-search key is passed). `stack/seed.py` and `seed_training.py` created
  four invented people (Sam, Jordan, Priya, Alex) with three weeks of history through the
  public API. Sam has no health conditions and a four-day Upper / Lower program with
  five sessions logged through the native workout logger. The migrations' real profiles were deleted first. The AI model is replaced
  by canned answers in `demo_server.py`; the server's handling of them is real.
  `tour.js` (with `rec.js` and `estimate-rewrite.js`) drove the web build through every
  screen and the "Try this" actions, saving each exchange.
- Not in this repo: the app sources. The built bundles are published (publicly, by
  Ira's choice) at the top of `main`.

## Page layout and demo shims (Nov 6)

- The page is tabs (Overview, Health, Recipes, Claro, PickleCourts); hidden tabs stay laid
  out off screen so every phone keeps running and the cross-app replay works.
- Each app fills its whole phone screen. `demo-env.js` reports iPhone safe-area insets
  (react-native-safe-area-context reads them through `getComputedStyle`) and lets tab-bar
  labels overflow, which react-native-web otherwise clips. Health starts in dark mode.
- `health-web/demo-stubs/healthkit.js` answers like a phone with today's activity, so
  reports don't open with "Apple Health did not have new data to sync".
- `replay.js` keeps habit ticks in `sessionStorage` and lays them over every habits read.
- Sam's program has a cover photo (`demo-photos/program.jpg`, CC0) set by `seed_training.py`.
- PickleCourts' map uses the `PC_MAPS_KEY` secret (a browser key limited to the site),
  filled into the snapshot's placeholder by `build-site.js`; without it the map is left out.

## PickleCourts (a committed snapshot)

The workflow's fine-grained `DEMO_TOKEN` can only cover one owner's repos, so CI cannot
check PickleCourts out. Its web build (`picklecourts/dist-web`), recorded tour
(`pc-recordings.json`) and MCP transcript (`pc-mcp.json`) are committed, and `build-site.js`
adds the phone only when they exist. They keep their own recorded day (`pc-mcp.json`
`demo_date`) and their own replay position (`sessionStorage` `demo_replay_pc`).
Rebuild them by hand with `ci/pc-snapshot.sh <okc-courts-app checkout>` (Nov 6: f3d96ef).

- The real Node API (`stack/run-picklecourts.sh`, `env -i`, `STRIPE_MOCK_MODE=true`, every
  outside integration unset) runs on a throwaway `pc_demo` database: its own migrations and
  dev seed, then `stack/picklecourts_demo.sql`, which **unpublishes every seeded venue**
  (they are real businesses) and adds three invented OKC clubs cloned from the seed's test venue.
- The build points at `https://picklecourts-demo.invalid`, so nothing can reach the live
  service. It is exported with `baseUrl` `/app-demo/picklecourts` (the Pages path; the local
  check serves the site under `srv/app-demo/` for the same reason), and
  `picklecourts-web/app-path.js` sets the frame's address to `/app/`, the app's legacy prefix,
  because its router reads regions from the path. `picklecourts-web/no-maps.js` reports the
  Google Maps script as failed (there is no key), so the app falls back to its list.
- `pc-tour.js` browses, books 6 PM at Lanternfield through mock checkout, then calls the
  server's MCP endpoint (`search_venues`, `find_availability_by_venue`). The page renders
  that transcript and says plainly that no model is in the loop.

## Rebuilding

`ci/build.sh` does everything, given checkouts of the two apps in `tools/health` and
`tools/claro`, an empty Postgres on 127.0.0.1:5432 (user `postgres`, `$PGPASSWORD`),
node 22, python 3.12 and Playwright's Chromium. It sets the demo date to the
build day, exports both apps, builds Claro's learner with `claro-web/*.ts`, creates the
schema with health-app's `scripts/local_db/init.sh`, deletes the migration's real profiles,
records `tour.js`, then `build-site.js` assembles `site/` and `site-test.js` checks it.
Verified Oct 30 from scratch (empty database, fresh `npm ci`).
