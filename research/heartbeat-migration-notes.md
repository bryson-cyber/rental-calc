# Heartbeat Migration Notes

## Key Facts from periodic-updates.md

1. **setInterval is FORBIDDEN** — Cloud Run terminates idle instances; in-process timers will not survive.
2. **Heartbeat (HTTP cron)** — Platform POSTs to `/api/scheduled/*` on the site. Handler runs and returns.
3. **Callback path MUST start with `/api/scheduled/`**
4. **Site must be deployed before scheduling** — save checkpoint, ask user to Deploy, then create crons.
5. **Cron is 6-field** (with seconds): `sec min hour dom mon dow`, UTC, min interval 60s.
6. **Handlers must be idempotent** — platform retries 5xx and 429 up to 3 times.
7. **Handler timeout is 2 minutes per call.**
8. **Auth:** `sdk.authenticateRequest(req)` returns `user.isCron === true` with `user.taskUid` set.

## Project-level Heartbeat (no end-user) — for our crons

Created via sandbox CLI:
```bash
manus-heartbeat create \
  --name nightly-cleanup \
  --cron "0 0 3 * * *" \
  --path /api/scheduled/cleanup \
  --description "Nightly expired-row cleanup"
```

The cron lives on the Manus platform, survives sandbox hibernation/teardown.

## What We Need to Migrate

### 1. Import Cron (currently setInterval every 3 min)
- Runs `runWebinarImport()` to fetch new registrants from WebinarJam
- Needs: `/api/scheduled/webinar-import` handler
- Cron: `0 */3 * * * *` (every 3 minutes)

### 2. SMS Dispatcher (currently setInterval every 30 sec)
- Runs `processScheduledMessages()` to send due SMS messages
- Needs: `/api/scheduled/sms-dispatch` handler
- Cron: `0 * * * * *` (every 60 seconds — minimum allowed interval)
- NOTE: Currently runs every 30s, but Heartbeat minimum is 60s. This is acceptable.

## Implementation Steps

1. Extract `runImport()` and `processScheduledMessages()` into standalone exported functions
2. Create Express handlers at `/api/scheduled/webinar-import` and `/api/scheduled/sms-dispatch`
3. Mount handlers in `server/_core/index.ts` before Vite fallthrough
4. Auth: `sdk.authenticateRequest(req)` → check `user.isCron`
5. Keep setInterval as FALLBACK for dev mode (check `process.env.NODE_ENV`)
6. Save checkpoint, ask user to Deploy
7. Create crons via `manus-heartbeat create`

## Handler Template
```ts
import { sdk } from "../_core/sdk";

export async function webinarImportHandler(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    
    // Run the import
    await runImport();
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
  }
}
```
