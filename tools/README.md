# Phone app demo site

A static page that runs Ira's two iPhone apps, **Health** (`health-app` repo) and
**Claro** (`claro-spanish` repo), inside phone frames on invented data, with notes on
what makes each app different and a "Try this" list.

- **Public site:** https://iramillington.github.io/app-demo/ (GitHub Pages from the top of
  this repo's `main`; `tools/` holds what builds it, `build.json` says which app commits it shows).
- **Rebuilt automatically** by `.github/workflows/rebuild.yml`: every three hours it
  checks whether health-app (`master`) or claro-spanish (`main`) moved, and if so runs
  `ci/build.sh` and `ci/publish.sh`, which commits the new site to `main`. A push to `tools/`
  or a manual run always rebuilds. One secret, `DEMO_TOKEN` (read access to the two app
  repos), is needed; the foods the seed logs come from `stack/food_cache_rows.json`
  (public USDA data), so no USDA key is needed.
  A failed tour step, a server error or a real name in the recording fails the build
  (`ci/check_recordings.py`), and the old site stays up. Logs are kept as a run artifact.
- The tooling moved here from the private `home-infra` repo on Oct 30, because GitHub
  Actions are free in a public repo.

## What is real and what is stood in

- Both phones run the apps' **own source, unmodified**, exported for the web with
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
- **Health** talks to the home server, so the page **replays** real server answers.
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

## Rebuilding

`ci/build.sh` does everything, given checkouts of the two apps in `tools/health` and
`tools/claro`, an empty Postgres on 127.0.0.1:5432 (user `postgres`, `$PGPASSWORD`),
node 22, python 3.12 and Playwright's Chromium. It sets the demo date to the
build day, exports both apps, builds Claro's learner with `claro-web/*.ts`, creates the
schema with health-app's `scripts/local_db/init.sh`, deletes the migration's real profiles,
records `tour.js`, then `build-site.js` assembles `site/` and `site-test.js` checks it.
Verified Oct 30 from scratch (empty database, fresh `npm ci`).
