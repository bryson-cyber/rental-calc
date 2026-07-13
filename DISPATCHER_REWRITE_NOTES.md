# Dispatcher Rewrite Notes

## What to replace in webinar-sms.ts:

### SMS Dispatcher (lines 5046-5431):
- Replace `runScheduledDispatch()` (line 5056) — currently uses global mutex + Promise.allSettled
- Replace `dispatchSingleMessage()` (line 5124) — currently uses batch-of-50 loop
- DELETE: `smsDispatcherRunning` flag (declared somewhere above line 5056)
- DELETE: the `smsDispatcherInterval` early-return inside runScheduledDispatch (line 5064)

### Email Dispatcher (starts at line 5452):
- `emailDispatcherInterval` and `emailDispatcherRunning` at line 5459-5460
- EMAIL_SEQUENCE_MAP at line 5463
- Need to read the full email dispatcher to understand its structure

### Key imports/variables already available:
- `scheduledSmsMessages` from drizzle schema (now has `claimedAt` column)
- `webinarSmsCampaigns`, `webinarSmsDeliveries` tables
- `webinarRegistrants`, `webinarCredentials` tables
- `sendSms()` function (line 62-193)
- `normalizePhone()`, `isUsCanadaPhone()`, `renderMessage()` helpers
- `getRecipientsForMessage()` helper
- `notifyOwner()` from server/_core/notification
- `getDb()` for database access
- `eq`, `and`, `lte`, `count`, `sql` from drizzle-orm

### The setInterval SMS dispatcher (startSmsDispatcher):
- Need to find where it's declared — it's the FORCE_CRON=true path
- After rewrite, its body just calls `runScheduledDispatch()`

### New module-level state per Claude spec:
```typescript
const armedSmsTimers = new Map<number, NodeJS.Timeout>();
const SMS_LOOKAHEAD_MS = 90_000;
const SMS_SEND_CONCURRENCY = 50;
const SMS_STUCK_SENDING_MS = 10 * 60 * 1000;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
```

### Key functions to implement:
1. `runScheduledDispatch()` — look-ahead scheduler, arms timers
2. `fireMessageGroup(msgIds)` — claims in order, fires blasts concurrently
3. `claimScheduledMessage(msgId)` — atomic UPDATE WHERE status='pending'
4. `dispatchSingleMessage(db, msg, now)` — keep attendance sync, use worker pool
5. `failStuckMessages(db)` — watchdog for claimedAt > 10min
6. `sendWorker()` — pulls from shared cursor
7. `deliveryFlusher()` — concurrent DB writes while sends continue

### sendSms needs:
- AbortSignal.timeout(10_000) on the fetch call
