# RecallAR

A mobile memory-assistance app for people living with dementia, and the caregivers who look after
them. The patient points their phone at a person or object and RecallAR names it; between those
moments it runs Spaced Retrieval Training so the names stay learnable. Everything the patient does
becomes signal on a caregiver dashboard — accuracy and response-latency trends, safe-zone
departures, fall alerts.

Recognition runs entirely on-device (TensorFlow Lite), so the app works without a network. Supabase
is the remote source of truth; SQLite is the local store, and `SyncService` bridges the two whenever
connectivity returns.

## What's in it

**Patient app** — AR recognition of enrolled faces and objects, a daily training session, a photo
album of their memories, a panic button, and passive fall detection.

**Caregiver app** — patient management and device pairing, memory enrollment, training pool
configuration, cognitive analytics with PDF report export, geofences and location alerts, context
alerts, and support tickets.

**Admin dashboard** (`admin/`) — a separate Vite + React web app for operators. See
[`admin/README.md`](admin/README.md).

## Stack

- Expo SDK 54 (React Native 0.81, React 19) with Expo Router file-based routing
- MVVM: screens → `viewmodels/` hooks → `services/` → data. Zustand for global auth/patient state
- `expo-sqlite` locally, Supabase (Postgres + Storage + Edge Functions) remotely
- `react-native-vision-camera` + `react-native-fast-tflite` for on-device inference
  (MobileFaceNet 512-d for faces, MobileNetV2 1280-d for objects)

## Requirements

- Node 24+ (the test runner needs native TypeScript and `node:sqlite`)
- Xcode / Android Studio — **Expo Go will not work.** The app depends on native modules that are not
  in the Expo Go runtime, so you need a development build.
- A Supabase project

## Setup

```bash
npm install
```

Create `.env` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_ACCESS_TOKEN=...          # only needed for CLI/migration work
```

Apply the SQL in `supabase/migrations/`:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy admin-actions
```

These are incremental migrations — RLS policies, admin views, support tables — layered on a base
schema (`Caregiver`, `Patient`, `MemoryAsset`, and the rest) that was created in the Supabase
dashboard rather than checked in. On a fresh project, create those tables first to mirror
`src/database/local/schema.ts`.

## Running

```bash
npm run ios        # build and launch the dev client on iOS
npm run android    # same for Android
npm start          # Metro only, once a dev build is installed
```

`android/` and `ios/` are committed, so `expo prebuild` is not part of the normal loop — run it only
after changing native config in `app.json`.

## Tests

```bash
npm test
```

Pure-logic and SQL tests for the service layer, run under plain Node against real SQLite with the
native modules stubbed out — no device or test framework involved. Details and how to add a suite:
[`tests/README.md`](tests/README.md).

## Layout

```
src/
  app/          Expo Router routes, grouped (auth) / (patient) / (caregiver)
  viewmodels/   one hook per feature domain — the only thing screens call
  services/     business logic and data access
  models/       TypeScript shapes shared across layers
  database/     local/ (SQLite schema + versioned migrations), remote/ (Supabase client)
  ml/           embedding models, image preprocessing, vector store
  components/   presentational UI
  constants/    config.ts holds every tunable threshold
admin/          operator dashboard (separate app, excluded from the mobile build)
supabase/       SQL migrations and the admin-actions edge function
tests/          off-device service tests
```

Local tables: `Caregiver`, `Patient`, `MemoryAsset`, `TrainingSession`, `DailyReviewEntry`,
`CognitiveReport`, `Geofence`, `GeofenceEvent`, `Threat`, `ContextAlert`, `SyncLog`. Schema changes
go in `src/database/local/migrations/` as a new `vN_*.ts` **and** in `supabase/migrations/` — never
by editing `CREATE_TABLES` in `schema.ts`.

## Design docs

Read these before touching the corresponding area; they override the original spec where they
disagree with it.

| Doc | Covers |
|---|---|
| [`SDD.md`](SDD.md) | System design and the full use-case set |
| [`TRAINING_FLOW.md`](TRAINING_FLOW.md) | Spaced Retrieval scheduling — elapsed-time, not session timers |
| [`ANALYTICS.md`](ANALYTICS.md) | Biomarkers, smoothing, trend slopes, the degradation flag |
| [`PULL_SYNC.md`](PULL_SYNC.md) | Sync direction and conflict handling |
| [`TESTING.md`](TESTING.md) | Manual test plans and results |
