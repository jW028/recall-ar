# RecallAR Admin Dashboard

Operator dashboard for the whole RecallAR userbase. A standalone Vite + React app, deliberately
separate from the Expo app: the mobile codebase is native-bound at its core (`expo-sqlite`,
`react-native-vision-camera`, `react-native-fast-tflite`, `expo-secure-store`, `react-native-maps`),
none of which runs in a browser.

## Creating the first administrator

There are no admins yet, so the dashboard will reject every sign-in until you create one. Admin
access comes from membership in `public.admin_users` — not from any role on the account — so this is
two steps.

1. **Create the account.** Supabase Dashboard → Authentication → Users → *Add user*.
   Leave `user_metadata` **empty**. If you set `role: caregiver` there, the `on_auth_user_created`
   trigger fires and creates a `Caregiver` row, which would make your admin show up as a caregiver
   in its own dashboard.

2. **Grant admin.** Run this with the new user's id:

   ```sql
   insert into public.admin_users (user_id, note)
   values ('<the-new-user-uuid>', 'founder');
   ```

To revoke, delete the row. Nothing else about the account changes.

## Running it

```bash
cd admin
npm install
cp .env.example .env     # then fill in the two values from the root .env
npm run dev              # http://localhost:5173
npm run build            # static output in admin/dist
```

`.env` needs the same project the mobile app points at:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The publishable key is the same one the app ships with. It grants nothing on its own — every
`admin_*` view is gated by `is_admin()`, so a non-admin signed into this dashboard sees empty
results rather than an error.

## How it gets its data

**Reads** go straight from the browser to Postgres against nine `admin_*` views. They are all
`security_invoker`, so the additive `"<T>: admin read"` RLS policies do the gating.

**Writes** never touch the browser's key. Suspend, password reset, unpair and delete all go through
the `admin-actions` edge function, which holds the service-role key, re-checks `is_admin()` on the
caller's own JWT, and records every attempt — successful or not — in `admin_audit_log`. That table
has no insert policy, so an admin can read the history but cannot write to it from here.

## Shared code

`admin/vite.config.ts` aliases `@app` and `@` to the Expo app's `src/`. Only genuinely pure modules
may be imported through them:

| Module | Used for |
|---|---|
| `@app/utils/stats` | `median`, `rollingAverage`, `linearRegressionSlope` |
| `@app/utils/streak` | `computeStreak` |
| `@app/constants/config` | analytics deadbands, smoothing window, sufficiency gates |
| `@app/models/Analytics` | `DailyPoint`, `TrendDirection` (types only) |

This is why the degradation flag on the Clinical page matches what a caregiver sees on their own
Analytics tab: it is literally the same code over the same numbers. Postgres has `regr_slope` and
computing the trend in SQL would have been faster, but the app smooths over 7 days *before* fitting
the line, and a re-implementation would have drifted from the app's answer without anyone noticing.

Anything reaching `expo-sqlite`, `react-native` or `expo-secure-store` will not resolve in a browser
build — `AnalyticsService` itself is off-limits for exactly that reason.

## Keeping it out of the mobile build

`admin/` is excluded from Metro (`resolver.blockList`), the root `tsconfig.json`, and ESLint.
`admin/node_modules` holds its own copy of React; without the Metro blocklist the resolver can pick
it up and the app fails at runtime with two React instances.
