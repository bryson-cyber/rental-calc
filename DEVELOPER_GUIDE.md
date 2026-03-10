# Coach Inayah Rental Revenue Calculator — Deep Developer Guide

**Last Updated:** March 10, 2026
**Live URL:** https://coachinayahturnkeytool.com
**GitHub:** Connected via `user_github` remote
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL (TiDB)

---

## Table of Contents

1. [What This App Actually Does (Business Logic)](#1-what-this-app-actually-does)
2. [Architecture: How Every Piece Connects](#2-architecture-how-every-piece-connects)
3. [How tRPC Works In This Codebase (With Examples)](#3-how-trpc-works-in-this-codebase)
4. [Server Startup Sequence (What Happens When the Server Boots)](#4-server-startup-sequence)
5. [The 10-Step Lead Magnet System (End-to-End)](#5-the-10-step-lead-magnet-system)
6. [WebinarJam Import System (Deep Dive)](#6-webinarjam-import-system)
7. [SMS Scheduling and Dispatch System](#7-sms-scheduling-and-dispatch-system)
8. [Google Calendar Invite System (All 4 Sending Paths)](#8-google-calendar-invite-system)
9. [Shareable Reports System](#9-shareable-reports-system)
10. [Revenue Override System (Admin Feature)](#10-revenue-override-system)
11. [External API Integrations (Every API, How It's Called)](#11-external-api-integrations)
12. [Database Schema (Every Table, What It Stores, Why)](#12-database-schema)
13. [Every Backend File Explained](#13-every-backend-file-explained)
14. [Every Frontend File Explained](#14-every-frontend-file-explained)
15. [Admin Portal (All 13 Tabs)](#15-admin-portal)
16. [Background Jobs and Cron Systems](#16-background-jobs-and-cron-systems)
17. [Rate Limiting and Access Control](#17-rate-limiting-and-access-control)
18. [Environment Variables (Every Key, What It Does)](#18-environment-variables)
19. [Safe Editing Rules (What You Can and Cannot Touch)](#19-safe-editing-rules)
20. [How to Add a New Feature Without Breaking Anything](#20-how-to-add-a-new-feature)
21. [Bugs That Were Fixed and Why They Happened](#21-bugs-that-were-fixed)
22. [Troubleshooting Playbook](#22-troubleshooting-playbook)

---

## 1. What This App Actually Does

This is not just a calculator. It is a **multi-system lead generation and webinar management platform** for Coach Inayah's Airbnb rental arbitrage coaching business. There are two completely separate audiences using this app:

**Public Users (Leads):** A visitor arrives at coachinayahturnkeytool.com, enters a property address, and the app pulls real market data from AirDNA, Rentometer, Zillow, and Redfin. Before seeing the full results, the visitor enters their name, email, and phone number — that is the lead capture. The lead is automatically sent to HubSpot CRM. The visitor then walks through a multi-step analysis tool (the "10-Step Lead Magnet") that helps them evaluate whether a rental property is a good investment. Each step uses different data sources and AI analysis. At any step, the visitor can share their report via a unique link.

**Admin (Coach Inayah / Bryson):** The admin accesses `/admin/dashboard` and manages everything: viewing all leads and their reports, running WebinarJam SMS campaigns (auto-importing registrants from WebinarJam, scheduling SMS sequences via SimpleTexting, sending Google Calendar invites), managing newsletters, monitoring API usage, generating social media content, and configuring deal alerts.

The business model is straightforward: the free tool generates leads. Those leads get enrolled in webinar funnels. The webinar sells coaching packages. The SMS/Calendar systems keep leads engaged and attending webinars.

---

## 2. Architecture: How Every Piece Connects

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                          │
│                                                                     │
│  LeadMagnet.tsx ─── 10 tabs, each calling different tRPC procedures │
│  UnifiedAdmin.tsx ── 13 tabs for admin management                   │
│  ShareableReportViewer.tsx ── public shared report pages             │
│                                                                     │
│  All API calls go through:  trpc.routerName.procedureName.useQuery  │
│                              trpc.routerName.procedureName.useMutation│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP POST to /api/trpc/*
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (server/_core/index.ts)            │
│                                                                     │
│  1. Express app with body parser (50MB limit)                       │
│  2. OAuth routes registered (/api/oauth/callback)                   │
│  3. SSE endpoints for progress tracking and listing streams         │
│  4. tRPC middleware mounted at /api/trpc                            │
│  5. Vite dev server (development) or static file serving (prod)     │
│  6. SPA fallback (all non-API routes serve index.html)              │
│                                                                     │
│  ON STARTUP (after server.listen):                                  │
│    → startWebinarImportCron()  (imports registrants every N min)    │
│    → startSmsDispatcher()      (sends due SMS every 30 sec)        │
│    → initWebinarMode()         (loads demo/live toggle from DB)     │
│    → resumeIncompleteJobs()    (resumes video generation)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     tRPC ROUTER TREE (server/routers.ts)            │
│                                                                     │
│  appRouter = {                                                      │
│    system:          systemRouter,        // health, notifications    │
│    auth:            { me, logout },      // session management       │
│    rental:          rentalRouter,        // AirDNA property reports  │
│    advanced:        advancedRouter,      // multi-year trends, etc.  │
│    webinarSms:      webinarSmsRouter,    // 3753 lines of SMS/cal   │
│    shareableReports: shareableReportsRouter, // share links          │
│    sharedReports:   sharedReportsRouter, // legacy share system      │
│    newsletter:      newsletterRouter,    // email campaigns          │
│    ... 30+ more routers                                             │
│  }                                                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────────────┐
│   MySQL (TiDB)   │ │  External APIs  │ │   Background Workers     │
│                  │ │                 │ │                          │
│  65 tables       │ │  AirDNA         │ │  Cron: Registrant Import │
│  Drizzle ORM     │ │  Rentometer     │ │  Cron: SMS Dispatcher    │
│  drizzle/schema  │ │  WebinarJam     │ │  Cron: Calendar Auto-Send│
│                  │ │  SimpleTexting  │ │  Cron: Newsletter Jobs   │
│                  │ │  Google Calendar│ │                          │
│                  │ │  Gmail API      │ │                          │
│                  │ │  HubSpot CRM   │ │                          │
│                  │ │  Zillow (HasData)│ │                          │
│                  │ │  Redfin (HasData)│ │                          │
│                  │ │  Claude AI      │ │                          │
│                  │ │  Gemini AI      │ │                          │
│                  │ │  Zapier Webhooks│ │                          │
└──────────────────┘ └─────────────────┘ └──────────────────────────┘
```

The critical thing to understand is that **the server does two jobs simultaneously**: it serves HTTP requests from the browser via tRPC, AND it runs background cron jobs (registrant import, SMS dispatch, calendar auto-send). These background jobs share the same database connection and the same external API clients. This dual nature is what caused several of the bugs we fixed — the cron jobs and the HTTP handlers can step on each other if not carefully coordinated.

---

## 3. How tRPC Works In This Codebase

tRPC is the API layer. Instead of writing REST endpoints like `GET /api/registrants` and then writing a separate fetch call on the frontend, tRPC lets you define a **procedure** on the server and call it from the frontend with full TypeScript type safety. Here is exactly how it works in this codebase:

### 3.1 Defining a Procedure (Server Side)

Every procedure lives in a file under `server/routers/`. Here is a real example from `server/routers/webinar-sms.ts`:

```typescript
// server/routers/webinar-sms.ts
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";

export const webinarSmsRouter = router({
  // This defines a procedure called "listRegistrants"
  listRegistrants: adminProcedure          // <-- requires admin login
    .input(z.object({                      // <-- validates input shape
      webinarId: z.string().optional(),
      page: z.number().default(0),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {          // <-- .query = read-only (GET)
      const db = await getDb();
      // ... fetch registrants from database ...
      return { registrants, total, page: input.page };
    }),

  // This defines a mutation (write operation)
  sendTestSms: adminProcedure
    .input(z.object({
      phone: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {       // <-- .mutation = write (POST)
      const result = await sendSms(input.phone, input.message);
      return result;
    }),
});
```

**Key concepts:**
- `adminProcedure` means the user must be logged in AND have `role === 'admin'`. If not, tRPC automatically returns a 403 error. You never write auth checks manually.
- `publicProcedure` means anyone can call it, no login required.
- `protectedProcedure` means the user must be logged in (any role).
- `.input(z.object({...}))` uses Zod to validate the input. If the frontend sends bad data, tRPC rejects it before your code runs.
- `.query()` is for reading data (like GET). `.mutation()` is for writing data (like POST/PUT/DELETE).

### 3.2 Registering the Router

All routers are imported in `server/routers/index.ts` (barrel exports) and then composed into the `appRouter` in `server/routers.ts`:

```typescript
// server/routers.ts
export const appRouter = router({
  rental: rentalRouter,           // trpc.rental.*
  webinarSms: webinarSmsRouter,   // trpc.webinarSms.*
  shareableReports: shareableReportsRouter,  // trpc.shareableReports.*
  // ... 30+ more
});
```

The key in the object (`webinarSms`) becomes the namespace on the frontend. So `webinarSmsRouter.listRegistrants` is called as `trpc.webinarSms.listRegistrants` on the frontend.

### 3.3 Calling a Procedure (Frontend Side)

On the frontend, you import `trpc` from `@/lib/trpc` and call procedures like this:

```typescript
// Reading data (query):
const { data, isLoading, error } = trpc.webinarSms.listRegistrants.useQuery({
  webinarId: "374",
  page: 0,
  limit: 50,
});
// data is fully typed — TypeScript knows it has { registrants, total, page }

// Writing data (mutation):
const sendSms = trpc.webinarSms.sendTestSms.useMutation({
  onSuccess: () => toast.success("SMS sent!"),
  onError: (err) => toast.error(err.message),
});
// Call it:
sendSms.mutate({ phone: "+15551234567", message: "Hello!" });
```

**The type safety is automatic.** If you change the server procedure's input or output shape, TypeScript will show errors on the frontend wherever the old shape is used. This is why tRPC is used instead of REST — you cannot have a mismatch between what the server expects and what the frontend sends.

### 3.4 The Three Procedure Types and When to Use Each

| Procedure Type | Who Can Call It | Defined In | Use For |
|---|---|---|---|
| `publicProcedure` | Anyone, no login needed | `server/_core/trpc.ts` | Lead capture forms, shared report viewing, property estimates |
| `protectedProcedure` | Any logged-in user | `server/_core/trpc.ts` | Saving favorites, viewing own reports, account settings |
| `adminProcedure` | Admin users only (`role === 'admin'`) | `server/_core/trpc.ts` | All WebinarJam/SMS features, API-heavy reports, admin dashboard |

### 3.5 How the Context Object Works

Every procedure receives a `ctx` object that contains the current user (if logged in) and the Express request/response objects. This is built by `server/_core/context.ts`:

```typescript
// Inside any procedure:
.query(async ({ ctx, input }) => {
  ctx.user       // { id, email, name, role, openId } or null
  ctx.user.role  // 'admin' or 'user'
  ctx.req        // Express Request object
  ctx.res        // Express Response object
})
```

The user is extracted from a JWT session cookie that was set during OAuth login. The cookie is named `__session` and is signed with `JWT_SECRET`.

---

## 4. Server Startup Sequence

When the server starts (via `pnpm dev` or in production), here is exactly what happens, in order:

1. **`server/_core/index.ts`** is the entry point. It imports dotenv, sets up global error handlers (`unhandledRejection`, `uncaughtException`) so the server never crashes from a stray promise rejection.

2. **Mock API check:** `installMockApi()` from `server/dev-mock-api.ts` is called. If `DEV_MOCK_API=true` in the environment, it intercepts all outgoing HTTP requests to AirDNA, Rentometer, etc. and returns fake data. This is for local development without burning API credits.

3. **Express app creation:** Standard Express setup with 50MB body parser limit (needed for file uploads like lease PDFs), trust proxy enabled (for HTTPS detection behind reverse proxies).

4. **OAuth routes:** `/api/oauth/callback` is registered for Manus OAuth login flow.

5. **SSE endpoints:** Two Server-Sent Events endpoints are registered:
   - `/api/progress/:sessionId` — streams real-time progress updates during long-running property analyses
   - `/api/stream/listings` — streams market listing data progressively (for the Explore Listings step)

6. **tRPC middleware:** The entire `appRouter` is mounted at `/api/trpc` with the context builder that extracts the user from the session cookie.

7. **Custom API routes:** Several non-tRPC routes are registered for special cases:
   - `/api/share-redirect/:shareCode` — redirects short share URLs
   - `/api/seo/:shareCode` — returns SEO metadata for shared reports
   - `/api/admin/reports` — admin report listing with pagination
   - `/api/zapier/lead` — webhook endpoint for Zapier lead ingestion

8. **Vite/Static serving:** In development, Vite dev server is attached for hot module replacement. In production, static files are served from `dist/public`.

9. **SPA fallback:** Any route that does not match `/api/*` serves `index.html` so client-side routing works.

10. **Port binding:** Server listens on the configured port (auto-finds available port if default is busy).

11. **Post-startup initialization (async, non-blocking):**
    - `initWebinarMode()` — reads the `webinar_mode` setting from DB to determine if the app is in demo mode or live mode
    - `resumeIncompleteJobs()` — finds any video generation jobs that were interrupted by a server restart and resumes them
    - **`startWebinarImportCron()`** — starts the registrant import cron job (see Section 6)
    - **`startSmsDispatcher()`** — starts the SMS dispatch loop (see Section 7)

The post-startup jobs are all wrapped in `.catch()` so if any of them fail, the server keeps running. They are not critical for the HTTP server to function.

---

## 5. The 10-Step Lead Magnet System

The lead magnet is the main public-facing feature. It lives in `client/src/pages/LeadMagnet.tsx` (the largest frontend file) and presents a tabbed interface where each tab is a "step" in evaluating a rental property.

### 5.1 Tab System Architecture

The tabs are defined as a TypeScript union type:

```typescript
type TabType = 'ebook' | 'regulations' | 'prove' | 'find' | 'validate'
             | 'compare' | 'map' | 'advisor' | 'market' | 'opportunity' | 'explore' | 'lease';
```

The tabs are displayed in a specific order, and **some tabs are admin-only** (they require heavy AirDNA API usage that would be too expensive for every visitor):

| Step # | Tab ID | Display Name | Admin Only? | What It Does |
|--------|--------|-------------|-------------|--------------|
| — | `ebook` | Learn the System | No | Inline e-book about Airbnb arbitrage |
| 1 | `regulations` | Check Regulations | No | Checks local STR regulations for a city |
| 2 | `opportunity` | Find a Property | No | Browses Zillow listings to find opportunities |
| 3 | `prove` | See Real Revenue | **Yes** | Full AirDNA property report (15-30 API calls) |
| 4 | `find` | Explore Listings | **Yes** | Shows all Airbnb/VRBO listings in an area |
| 5 | `validate` | Validate the Deal | No* | Property validator with revenue estimate |
| 6 | `compare` | Compare Favorites | No | Side-by-side comparison of saved properties |
| 7 | `map` | See the Map | No | Interactive map with listings overlay |
| 8 | `market` | Market Advisor | **Yes** | AI-powered market analysis |
| 9 | `advisor` | AI Advisor | **Yes** | Conversational AI property advisor |
| 10 | `lease` | Lease Reader | No | Upload a lease PDF for AI analysis |

*Step 5 (`validate`) is available to non-admins but uses a lighter API call (`getEstimate` = 1 AirDNA call) instead of the full `getPropertyReport` (15-30 AirDNA calls) that admins get.

### 5.2 How Non-Admin vs Admin Steps Differ

The `ADMIN_ONLY_TABS` array controls which tabs are hidden for non-admin users:

```typescript
const ADMIN_ONLY_TABS: TabType[] = ['prove', 'find', 'market', 'advisor'];
const ALL_TABS: TabType[] = ['ebook', 'regulations', 'opportunity', 'prove', 'find',
                              'validate', 'compare', 'map', 'market', 'advisor', 'lease'];
const TAB_ORDER: TabType[] = isAdmin
  ? ALL_TABS
  : ALL_TABS.filter(t => !ADMIN_ONLY_TABS.includes(t));
```

Non-admin users see: ebook → regulations → opportunity → validate → compare → map → lease (7 steps).
Admin users see all 11 tabs.

### 5.3 URL Deep Linking

The lead magnet supports URL parameters for deep linking (used in HubSpot email campaigns):

- `?tab=validate` — opens directly to the Validate tab
- `?step=5` — opens to step 5 (mapped to `validate`)
- `?address=123+Main+St&bedrooms=3&bathrooms=2` — pre-fills the property form
- `?autoAnalyze=true` — automatically triggers analysis after loading

The step-to-tab mapping is:

```typescript
const stepMapping: Record<string, TabType> = {
  '1': 'regulations',    '2': 'opportunity',   '3': 'prove',
  '4': 'find',           '5': 'validate',      '6': 'compare',
  '7': 'map',            '8': 'market',        '9': 'advisor',
};
```

### 5.4 Data Flow: What Happens When a User Analyzes a Property

Here is the complete data flow when a user enters an address in Step 5 (Validate the Deal):

1. **User types address** → `AddressAutocomplete` component uses Google Places API (via Manus proxy) to suggest addresses
2. **User clicks "Analyze"** → `trpc.rental.getEstimate.useMutation()` is called (for non-admin) or `trpc.rental.getPropertyReport.useMutation()` (for admin)
3. **Server receives the call** → The procedure in `server/routers/rental.ts` runs:
   - For `getEstimate`: Makes 1 AirDNA API call to get basic revenue estimate
   - For `getPropertyReport`: Makes 15-30 AirDNA API calls (property details, revenue, comps, market stats, historical data, supply trends, booking patterns, forward demand)
4. **Rate limit check** → `checkReportRateLimit()` verifies the user hasn't exceeded 5 reports/day (admins are exempt)
5. **AirDNA rate limiter** → `rateLimitedAirDNARequest()` in `server/routers/advanced.ts` ensures we don't exceed AirDNA's API rate limits. Uses `AsyncLocalStorage` via `server/request-context.ts` to detect if the caller is admin (admins bypass the soft limit of 400 calls/day)
6. **Results returned** → The `TeslaDashboard` component renders the results with revenue projections, occupancy rates, comparable properties, and investment analysis
7. **Lead capture** → If the user hasn't already provided their info, a lead capture form appears. On submit, `trpc.rental.submitLead.useMutation()` sends the data to the server, which stores it in the `leads` table and optionally sends it to HubSpot CRM via webhook

---

## 6. WebinarJam Import System

This is one of the most complex subsystems. It automatically pulls registrant data from WebinarJam's API and stores it in the local database so SMS campaigns and calendar invites can be sent.

### 6.1 How the Import Works (Step by Step)

The import is handled by `runWebinarImport()` in `server/routers/webinar-sms.ts` (line ~2997):

```
WebinarJam API                    Our Database
┌──────────────┐                  ┌──────────────────────┐
│ /webinar/    │  HTTP POST       │ webinar_registrants  │
│ registrants  │ ──────────────►  │                      │
│              │  (paginated,     │ phone, email, name,  │
│ Returns:     │   500/page)      │ attended, source,    │
│ - first_name │                  │ calendarInviteSent,  │
│ - last_name  │                  │ calendarEventId      │
│ - email      │                  └──────────────────────┘
│ - phone      │                           │
│ - attended   │                           │ After import, check for
│ - phone_code │                           │ pending calendar invites
└──────────────┘                           ▼
                                  ┌──────────────────────┐
                                  │ autoSendCalendarInvites│
                                  │ (fire-and-forget)     │
                                  └──────────────────────┘
```

Here is what `runWebinarImport()` does:

1. **Paginated fetch:** Calls `fetchWebinarJamRegistrants()` in a loop, page by page (500 registrants per page, up to 100 pages max). The WebinarJam API requires a POST request with `api_key` and `webinar_id`.

2. **Schedule ID fallback:** If a `schedule_id` is configured and it returns 0 registrants, the function automatically retries WITHOUT the schedule_id filter. This was added because WebinarJam sometimes changes schedule IDs when a webinar is recreated, and the old schedule_id returns nothing.

3. **Deduplication:** Fetches all existing phone numbers from the database for this webinar. Normalizes phone numbers (strips non-digits, handles country codes) and skips any registrant whose normalized phone already exists.

4. **Batch insert:** New registrants are inserted in batches of 500 to avoid hitting MySQL's max packet size.

5. **Calendar auto-send:** After import, queries ALL registrants who have `calendarInviteSent = 0` and no error message. This catches both newly imported registrants AND any existing registrants who were imported before calendar was configured. Fires `autoSendCalendarInvites()` as a background task (fire-and-forget, does not block the import response).

### 6.2 The Cron Job

`startWebinarImportCron()` (line ~3121) sets up a `setInterval` that runs the import on a configurable schedule (default: every 30 minutes). Critical details:

- **Re-reads settings from DB on every run.** This was a bug fix — the original code captured `webinarId` and `scheduleId` in a closure at startup and never refreshed them. If you changed the selected webinar in the UI, the cron kept importing from the old webinar.
- **Re-reads API credentials on every run.** Same reason — credentials stored in the `webinar_credentials` table might be updated.
- **Writes results to `webinar_sms_settings`** table with keys `last_auto_import_at` and `last_auto_import_result` so the admin UI can show when the last import ran and what happened.

### 6.3 How to Change the Selected Webinar

The admin UI calls `trpc.webinarSms.saveWebinarSelection` which:
1. Saves the new webinar ID, schedule ID, and webinar name to `webinar_sms_settings`
2. Calls `restartWebinarImportCron()` which clears the old interval and starts a new one with the fresh settings

### 6.4 Per-Webinar API Keys

WebinarJam gives each webinar its own API credentials. These are stored in the `webinar_credentials` table. The import function checks this table first and uses the per-webinar key if available, falling back to the global `WEBINARJAM_API_KEY` environment variable.

---

## 7. SMS Scheduling and Dispatch System

The SMS system allows the admin to schedule a sequence of text messages to be sent to webinar registrants at specific times (e.g., "1 hour before webinar", "going live now", "replay available").

### 7.1 How SMS Sequences Work

An SMS sequence is a series of `scheduled_sms_messages` rows in the database. Each row has:

| Field | Purpose |
|-------|---------|
| `webinarId` | Which webinar's registrants to target |
| `sequenceName` | Human-readable label (e.g., "1 Hour Before") |
| `sequenceOrder` | Position in sequence (1-9) |
| `messageBody` | The SMS text. Supports `%FIRST_NAME%` variable substitution |
| `scheduledAt` | UTC timestamp of when to send |
| `status` | `pending` → `sending` → `sent` or `failed` or `cancelled` |
| `audience` | `all`, `attended`, or `not_attended` |

The admin creates these via the UI, which calls `trpc.webinarSms.upsertScheduledMessage`. The AI can also generate a full sequence via `trpc.webinarSms.generateSequence`, which uses Claude AI to write contextually appropriate messages.

### 7.2 The SMS Dispatcher (How Messages Actually Get Sent)

`startSmsDispatcher()` (line ~3226) runs a loop every 30 seconds that:

1. **Mutex check:** If a previous dispatch run is still in progress (`smsDispatcherRunning === true`), the new tick is skipped entirely. This prevents duplicate sends when a large batch (e.g., 341 recipients) takes longer than 30 seconds.

2. **Startup recovery:** On first run, finds any messages stuck in `sending` status (from a previous server crash) and resets them to `pending`. This MUST complete before the first `processScheduledMessages()` runs — it is `await`ed, not fire-and-forget.

3. **Find due messages:** Queries for messages where `status = 'pending'` AND `scheduledAt <= now`.

4. **Stale message check:** If a message is more than 30 minutes past its scheduled time, it is automatically cancelled (marked as `cancelled`). This prevents sending stale messages from a previous webinar or after a long server outage.

5. **Attendance-targeted messages (HARD RULES):** If a message targets `attended` or `not_attended` audience:
   - **RULE 1:** Force a fresh attendance sync from WebinarJam API before sending. This re-fetches all registrants and updates their `attended` flag in the database.
   - **RULE 2:** If the sync fails, the message is BLOCKED (marked as `failed`). It will NOT send to the wrong audience.
   - **RULE 3:** After sync, count how many registrants match the target audience. If zero, the message is cancelled.

6. **Recipient selection:** Based on the `audience` field:
   - `all` → all registrants for this webinar who haven't opted out
   - `attended` → only registrants with `attended = 1`
   - `not_attended` → only registrants with `attended = 0`

7. **Send loop:** For each recipient:
   - Substitute `%FIRST_NAME%` in the message body
   - Call `sendSms()` which hits the SimpleTexting v2 API
   - Wait 100ms between sends to avoid overwhelming SimpleTexting
   - Track sent/failed counts

8. **Multi-channel:** If the message's `sequenceName` matches a configured reminder schedule, it also triggers calendar reminder updates and/or Gmail reminder emails alongside the SMS.

### 7.3 The sendSms() Function

`sendSms()` (line ~58) is the actual SimpleTexting API call:

1. Strips phone to digits only
2. Rejects international numbers (SimpleTexting only supports US/Canada NANP numbers)
3. Normalizes to 10 digits (strips leading "1" if 11 digits)
4. POSTs to `https://api-app2.simpletexting.com/v2/api/messages` with Bearer auth
5. Uses `AUTO` mode for messages ≤160 chars, `MMS_PREFERRED` for longer messages
6. Returns `{ success, smsId, error }`

---

## 8. Google Calendar Invite System

The calendar system sends Google Calendar invites to webinar registrants so the webinar appears on their calendar with reminders. The invites come from `support@coachinayah.com` using Google Workspace domain-wide delegation.

### 8.1 Authentication

`server/google-calendar.ts` uses a Google Service Account with domain-wide delegation:

1. The service account JSON credentials are stored in `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` environment variable
2. The service account impersonates `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` (support@coachinayah.com)
3. This allows creating calendar events on behalf of support@coachinayah.com and sending invites to attendees

### 8.2 The Timezone Fix (Critical Bug That Was Fixed)

WebinarJam returns schedule dates like `"2026-03-11 19:00"` in the webinar's timezone (e.g., America/New_York). The original code did this:

```typescript
// BROKEN: new Date("2026-03-11 19:00:00") parses as UTC
const startTime = new Date(scheduleDate).toISOString();
// Result: "2026-03-11T19:00:00.000Z" — the Z means UTC
// Google Calendar sees the Z and ignores the timeZone field
// Event shows at 3:00 PM ET instead of 7:00 PM ET (4 hours early)
```

The fix passes raw date strings WITHOUT the Z suffix:

```typescript
// FIXED: Pass "2026-03-11T19:00:00" (no Z) so Google respects timeZone
startDateTimeLocal = params.startTime.replace(" ", "T");
// Strip any trailing Z or timezone offset
startDateTimeLocal = startDateTimeLocal.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
```

Google Calendar API accepts two formats:
- `"2026-03-11T19:00:00Z"` → treats as UTC, ignores `timeZone` field
- `"2026-03-11T19:00:00"` → treats as local time, uses `timeZone` field

We use format #2 so the `timeZone: "America/New_York"` field is respected.

### 8.3 The Four Sending Paths

Calendar invites can be sent through four different code paths. ALL FOUR must use the same timezone-safe date handling:

| Path | Trigger | Function | Location |
|------|---------|----------|----------|
| **Single invite** | Admin clicks "Send Invite" on one registrant | `sendCalendarInviteToRegistrant` procedure | webinar-sms.ts line ~2097 |
| **Bulk invite** | Admin clicks "Send All" button | `sendBulkCalendarInvites` procedure | webinar-sms.ts line ~2187 |
| **Auto-send** | Cron imports new registrants | `autoSendCalendarInvites()` function | webinar-sms.ts line ~2846 |
| **Reminder update** | Admin sends reminder to existing invitees | `sendCalendarReminder` procedure | webinar-sms.ts line ~2388 |

All four paths:
1. Fetch webinar details from WebinarJam API to get the schedule date
2. Check `webinar_sms_settings` for time/timezone overrides
3. Build the event with the raw date string (no Z suffix)
4. Call `sendCalendarInvite()` from `server/google-calendar.ts`

### 8.4 Rate Limiting for Calendar API

Google Calendar API allows approximately 60 write requests per minute per user. The code uses:
- **1500ms delay** between each invite (≈40/min, safely under the limit)
- **Exponential backoff** on rate limit errors: 5s → 10s → 20s
- **3 retries** per invite on rate limit errors
- **Adaptive cooldown:** If consecutive rate limits are hit, the base delay increases by 2000ms per consecutive failure
- **Progress logging** every 25 invites

### 8.5 Calendar Settings Override

The admin can override the calendar invite time and timezone via the UI. These are stored in `webinar_sms_settings`:

| Setting Key | Purpose | Default |
|-------------|---------|---------|
| `calendar_auto_send` | Enable/disable auto-send on import | `"false"` |
| `calendar_event_name` | Custom event title | "LIVE: Coach Inayah's 5-Step Airbnb Masterclass" |
| `calendar_event_description` | Custom event description | (long default text) |
| `calendar_invite_time` | Override time (HH:mm format) | Uses WebinarJam schedule time |
| `calendar_invite_timezone` | Override timezone | Uses WebinarJam timezone |


---

## 9. Shareable Reports System

Any analysis result can be shared via a unique URL. There are two share systems (legacy and universal), but the universal system is the one actively used.

### 9.1 How Sharing Works (End-to-End)

```
Admin clicks "Share" on a report
        │
        ▼
UniversalShareButton.tsx
  → trpc.shareableReports.create.useMutation()
  → Sends: reportType, reportData (full JSON), address, metrics, revenueOverride
        │
        ▼
server/routers/shareable-reports.ts → server/shareable-reports.ts
  → createShareableReport()
  → Generates random 10-char share code
  → Extracts _revenueOverride from reportData and stores in DB column
  → Inserts into universal_shareable_reports table
  → Returns { shareCode, shareUrl }
        │
        ▼
Frontend receives shareCode
  → Copies https://coachinayahturnkeytool.com/share/{shareCode} to clipboard
  → Optionally sends SMS/email notification to the lead
        │
        ▼
Lead opens the link
  → Route: /share/:shareCode → ShareableReportViewer.tsx
  → trpc.shareableReports.get.useQuery({ shareCode })
  → Server fetches from universal_shareable_reports
  → Returns reportData + revenueOverride
  → Viewer renders the appropriate report type
```

### 9.2 Revenue Override in Shared Reports

When the admin manually adjusts the revenue number (via the +/- buttons or by clicking the number to type a custom value), that override needs to persist in the shared report. Here is how it works:

1. **TeslaDashboard** has an `onRevenueOverrideChange` callback that fires whenever the admin changes the revenue
2. **LeadMagnet** receives this via `setCurrentRevenueOverride` state
3. **UniversalShareButton** receives `revenueOverride` as a prop
4. When creating a share, the override is stored in TWO places:
   - `reportData._revenueOverride` (embedded in the JSON blob)
   - `revenueOverride` column (dedicated DB column)
5. **After share creation**, a `useEffect` in UniversalShareButton watches for changes to `revenueOverride` and auto-syncs to the DB via `trpc.shareableReports.updateRevenueOverride`
6. **ShareableReportViewer** reads the override from the DB column first, with a fallback to `reportData._revenueOverride` for backwards compatibility

The amber text color on the revenue number only appears for the owner/admin. Non-owner viewers see the overridden number in normal black text with no visual indication it was adjusted.

### 9.3 Report Types Supported

Each report type maps to a different viewer component in `ShareableReportViewer.tsx`:

| Report Type | Step | Viewer Component | What It Shows |
|-------------|------|-----------------|---------------|
| `revenue` | Step 3 | TeslaDashboard | Full revenue analysis with charts, comps, investment calc |
| `validator` | Step 5 | TeslaDashboard (lighter) | Revenue estimate with basic metrics |
| `market` | Step 8 | MarketAdvisorViewer | Market-level analysis and trends |
| `ai_advisor` | Step 9 | AIAdvisorViewer | AI conversation transcript |
| `listings` | Step 4 | ListingsViewer | Airbnb/VRBO listing grid |
| `comparison` | Step 6 | ComparisonViewer | Side-by-side property comparison |
| `map` | Step 7 | MapViewer | Interactive map snapshot |
| `regulation` | Step 1 | RegulationViewer | STR regulation summary |

---

## 10. Revenue Override System

This is an admin-only feature that lets the owner manually adjust the headline revenue number shown to a lead. The business reason: sometimes the AirDNA data is slightly off, or the owner wants to show a more conservative/aggressive number based on their local knowledge.

### 10.1 How It Works in the UI

The `TeslaDashboard` component (3948 lines, `client/src/components/TeslaDashboard.tsx`) contains the revenue display. When `isOwner` is true:

1. **+/- buttons** appear next to the revenue number, adjusting by $5,000 per click
2. **Click the number** to type a custom value directly (input with auto-formatting)
3. **Pencil icon** hints that the number is clickable
4. **Amber text color** indicates an override is active (only visible to admin)
5. **"Admin override active" label** appears below the number (only visible to admin)

### 10.2 Data Flow

```
TeslaDashboard (isOwner=true)
  → User clicks +/- or types custom value
  → setRevenueOverride(newValue)
  → onRevenueOverrideChange(newValue)  // callback to parent
        │
        ▼
LeadMagnet.tsx
  → setCurrentRevenueOverride(newValue)
  → Passes to UniversalShareButton as prop
        │
        ▼
UniversalShareButton
  → If share already exists: useEffect auto-syncs to DB
  → If creating new share: includes in create mutation
```

---

## 11. External API Integrations

### 11.1 AirDNA (Primary Data Source)

**What it provides:** Short-term rental market data — revenue estimates, occupancy rates, comparable properties, market trends, supply data, booking patterns, forward demand.

**How it's called:** All AirDNA calls go through `rateLimitedAirDNARequest()` in `server/routers/advanced.ts`. This wrapper:
- Adds the API key from `ENV.airdnaApiKey`
- Enforces a soft limit of 400 calls/day for non-admin users
- Uses `AsyncLocalStorage` (via `server/request-context.ts`) to detect admin requests and bypass the soft limit
- Logs all calls to the `api_call_logs` table for usage tracking

**Key endpoints used:**

| Endpoint | Purpose | Calls Per Report |
|----------|---------|-----------------|
| `/api/v2/market/search` | Search for markets by name | 1 |
| `/api/v2/property/details` | Get property details | 1 |
| `/api/v2/property/revenue` | Revenue estimate | 1 |
| `/api/v2/property/comps` | Comparable properties | 1 |
| `/api/v2/market/stats` | Market-level statistics | 1 |
| `/api/v2/market/supply` | Supply trends | 1 |
| `/api/v2/market/demand` | Forward demand data | 1 |
| `/api/v2/market/listings` | Individual listings | 1-10 (paginated) |
| `/api/v2/property/historical` | Historical performance | 1 |

A full `getPropertyReport` makes 15-30 of these calls. A simple `getEstimate` makes 1.

### 11.2 WebinarJam

**What it provides:** Webinar registrant data, webinar details, schedule information.

**How it's called:** Direct HTTP POST requests in `server/routers/webinar-sms.ts`.

**Key endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `https://api.webinarjam.com/everwebinar/webinars` | List all webinars |
| `https://api.webinarjam.com/everwebinar/webinar` | Get webinar details + schedules |
| `https://api.webinarjam.com/everwebinar/registrants` | Get registrants (paginated) |

**Authentication:** POST body includes `api_key`. Each webinar can have its own API key stored in `webinar_credentials` table, falling back to the global `WEBINARJAM_API_KEY`.

### 11.3 SimpleTexting (SMS)

**What it provides:** SMS sending to US/Canada phone numbers.

**How it's called:** `sendSms()` function in `server/routers/webinar-sms.ts`.

**Endpoint:** `POST https://api-app2.simpletexting.com/v2/api/messages`

**Authentication:** Bearer token in Authorization header (`SIMPLETEXTING_API_KEY`).

**Limitations:** US/Canada numbers only (NANP). Messages >160 chars use MMS mode.

### 11.4 Google Calendar API

**What it provides:** Calendar event creation and management for webinar invites.

**How it's called:** `server/google-calendar.ts` using the `googleapis` npm package.

**Authentication:** Service account with domain-wide delegation, impersonating `support@coachinayah.com`.

**Rate limit:** ~60 writes/minute per user. Code uses 1500ms delay + exponential backoff.

### 11.5 Gmail API

**What it provides:** Email sending for webinar reminders and no-show follow-ups.

**How it's called:** `server/gmail-reminders.ts` using the `googleapis` npm package.

**Authentication:** Same service account as Calendar, impersonating `support@coachinayah.com`.

### 11.6 HubSpot CRM

**What it provides:** Contact management, email campaigns, lead tracking.

**How it's called:** `server/hubspot.ts` and `server/hubspot-email.ts`.

**Endpoint:** `https://api.hubapi.com/crm/v3/objects/contacts`

**Authentication:** Bearer token (`HUBSPOT_API_KEY`).

**Used for:** Creating/updating contacts when leads are captured, sending newsletter emails, tracking contact properties.

### 11.7 Rentometer

**What it provides:** Long-term rental market data (median rent, percentiles, comps).

**How it's called:** `server/rentometer.ts`.

**Endpoint:** `https://www.rentometer.com/api/v1/summary`

**Authentication:** API key in query parameter.

### 11.8 HasData (Zillow + Redfin Scraping)

**What it provides:** Property listings, Zestimates, property details from Zillow and Redfin.

**How it's called:** `server/hasdata-zillow.ts` and `server/hasdata.ts`.

**Endpoint:** HasData's web scraping API.

**Authentication:** API key (`HASDATA_API_KEY`).

### 11.9 Claude AI (Anthropic) and Gemini

**What it provides:** AI-generated property analysis, market insights, SMS message generation, newsletter content.

**How it's called:** `server/llm-provider.ts` (Claude) and `server/gemini-provider.ts` (Gemini). The `server/model-router.ts` selects between them based on task type and availability.

**Authentication:** `ANTHROPIC_API_KEY` for Claude, `GEMINI_API_KEY` for Gemini.

**Model router logic:** Claude is the primary model. Gemini is used as a fallback when Claude is rate-limited or for specific tasks where Gemini performs better (e.g., structured data extraction).

### 11.10 Zapier Webhooks

**What it provides:** Lead data forwarding to external systems.

**How it's called:** POST to `ZAPIER_WEBHOOK_URL` when a lead is captured.

---

## 12. Database Schema

The database has 65 tables. Here are the most important ones grouped by feature:

### 12.1 Core User and Lead Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Registered users (via OAuth) | `id`, `email`, `name`, `role` (admin/user), `openId`, `reportMode` (pro/guided) |
| `leads` | Captured leads from the tool | `id`, `email`, `phone`, `name`, `address`, `city`, `state`, `bedrooms`, `bathrooms`, `source`, `hubspotContactId` |
| `email_optins` | Email opt-in tracking | `email`, `source`, `city`, `state`, `optedIn` |

### 12.2 Webinar and SMS Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `webinar_registrants` | Imported registrants | `phone`, `email`, `name`, `webinarId`, `attended` (0/1), `calendarInviteSent` (0/1), `calendarEventId`, `calendarInviteError`, `source` |
| `webinar_sms_settings` | Key-value config store | `settingKey`, `settingValue` — stores selected_webinar_id, cron_enabled, calendar_auto_send, calendar_invite_time, etc. |
| `webinar_credentials` | Per-webinar API keys | `webinarId`, `apiKey`, `webinarHash`, `memberId` |
| `scheduled_sms_messages` | SMS sequence messages | `webinarId`, `sequenceName`, `messageBody`, `scheduledAt`, `status`, `audience`, `sentCount`, `failedCount` |
| `webinar_sms_templates` | Reusable SMS templates | `name`, `body` |
| `webinar_sms_campaigns` | Campaign tracking | `name`, `webinarId`, `templateId`, `status`, `sentCount` |
| `webinar_sms_deliveries` | Per-recipient delivery log | `campaignId`, `registrantId`, `status`, `smsId`, `error` |
| `webinar_reminder_schedule` | Multi-channel reminder config | `webinarId`, `reminderName`, `smsEnabled`, `emailEnabled`, `calendarEnabled`, `scheduledAt` |
| `email_send_log` | Gmail send tracking | `registrantId`, `emailType`, `subject`, `status`, `sentAt` |
| `webinar_transcripts` | Stored webinar transcripts | `webinarId`, `transcript`, `summary` |

### 12.3 Report and Sharing Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `universal_shareable_reports` | Shared report links | `shareCode`, `reportType`, `reportData` (JSON), `revenueOverride`, `address`, `annualRevenue`, `verdict`, `viewCount` |
| `shared_reports` | Legacy share system | `shareId`, `reportData`, `createdAt` |
| `analysis_reports` | Saved full analyses | `address`, `reportData`, `userId`, `reportType` |
| `deep_analysis` | Deep AI analyses | `reportId`, `analysisData`, `status` |

### 12.4 Market and Property Tables

| Table | Purpose |
|-------|---------|
| `saved_searches` | User's saved search criteria |
| `favorite_properties` | User's favorited properties |
| `favorite_listings` | User's favorited Airbnb/VRBO listings |
| `favorite_markets` | User's favorited markets |
| `market_alerts` | Price/occupancy alert configurations |
| `market_evaluations` | One-click market evaluation results |
| `market_research_reports` | Cached market research data |
| `regulation_cache` | Cached STR regulation data |

### 12.5 System Tables

| Table | Purpose |
|-------|---------|
| `api_call_logs` | Every external API call logged |
| `api_cache` | Cached API responses (TTL-based) |
| `api_usage_summary` | Daily API usage aggregates |
| `user_usage` | Per-user daily usage counts |
| `usage_limits_config` | Configurable usage limits |
| `activity_logs` | User activity tracking |
| `tool_usage_events` | Tool-level usage analytics |
| `bug_reports` | User-submitted bug reports |
| `notification_analytics` | Notification delivery tracking |
| `tos_acceptances` | Terms of service acceptance records |
| `translation_cache` | Cached translations |

### 12.6 Newsletter Tables

| Table | Purpose |
|-------|---------|
| `newsletter_cities` | Cities with active subscribers |
| `newsletter_deals` | Discovered rental deals |
| `newsletter_sends` | Email send log |
| `newsletter_preferences` | Per-contact preferences |
| `newsletter_jobs` | Job execution history |

### 12.7 Content and Media Tables

| Table | Purpose |
|-------|---------|
| `content_scripts` | AI-generated content scripts |
| `video_jobs` | Video generation job tracking |
| `property_images` | Stored property images |

---

## 13. Every Backend File Explained

### 13.1 Server Core (`server/_core/`)

These files are **framework-level plumbing**. Do not edit them unless you are changing infrastructure.

| File | What It Does |
|------|-------------|
| `index.ts` | **THE entry point.** Creates Express app, mounts tRPC, registers routes, starts cron jobs. ~1189 lines. |
| `trpc.ts` | Defines `publicProcedure`, `protectedProcedure`, `adminProcedure`. The auth middleware lives here. |
| `context.ts` | Builds the tRPC context from each HTTP request — extracts user from JWT cookie. |
| `env.ts` | Centralizes all environment variables into a typed `ENV` object. **If you add a new env var, add it here first.** |
| `oauth.ts` | Handles the Manus OAuth callback at `/api/oauth/callback`. |
| `cookies.ts` | Session cookie configuration (SameSite, Secure, etc.). |
| `llm.ts` | `invokeLLM()` helper for calling the built-in LLM API. |
| `notification.ts` | `notifyOwner()` helper for sending notifications to the app owner. |
| `sdk.ts` | HTTP client for the Manus built-in API (forge). |
| `vite.ts` | Vite dev server integration for development mode. |
| `imageGeneration.ts` | Image generation helper. |
| `voiceTranscription.ts` | Audio transcription helper. |
| `map.ts` | Google Maps proxy helper for server-side geocoding. |
| `dataApi.ts` | Built-in data API helper. |
| `systemRouter.ts` | System health check and notification procedures. |

### 13.2 Router Files (`server/routers/`)

Each file exports a tRPC router. Here is what each one does and its key procedures:

**`rental.ts` (2013 lines) — Core Property Analysis**

The heart of the app. Contains all AirDNA-powered property analysis procedures.

| Procedure | Access | What It Does |
|-----------|--------|-------------|
| `getEstimate` | public | Light revenue estimate (1 AirDNA call). Used by non-admin Step 5. |
| `getPropertyReport` | admin | Full property report (15-30 AirDNA calls). Revenue, comps, market stats, historical data. |
| `getAIPropertyReport` | admin | Same as above but adds AI-generated narrative analysis via Claude. |
| `getMarketReport` | admin | Market-level analysis for a city/region. |
| `getSubmarketReport` | admin | Submarket breakdown within a larger market. |
| `searchMarkets` | public | Search AirDNA markets by name. |
| `searchZipCodes` | public | Search by zip code. |
| `getLocationQuality` | public | Neighborhood quality score. |
| `submitLead` | public | Captures lead data (name, email, phone) and sends to HubSpot/Zapier. |
| `smartSearch` | public | AI-powered property search. |
| `getBookingPatterns` | admin | Booking pattern analysis for a property. |
| `getSupplyTrend` | admin | Supply trend data for a market. |
| `getForwardDemand` | admin | Forward-looking demand indicators. |

**`webinar-sms.ts` (3753 lines) — WebinarJam + SMS + Calendar**

The largest router. Completely isolated — only imports from schema, _core, and db. Contains 50+ procedures for managing registrants, SMS campaigns, calendar invites, email reminders, and AI message composition.

Key procedure groups:
- **Registrant CRUD:** `listRegistrants`, `addRegistrant`, `updateRegistrant`, `deleteRegistrants`, `importCsv`, `importFromWebinarJam`, `triggerManualImport`
- **SMS:** `sendCampaign`, `resendCampaign`, `sendTestSms`, `listScheduledMessages`, `upsertScheduledMessage`, `generateSequence`
- **Calendar:** `sendCalendarInviteToRegistrant`, `sendBulkCalendarInvites`, `sendCalendarReminder`, `saveCalendarSettings`, `calendarInviteStats`, `sendMissingCalendarInvites`
- **Email:** `composeEmail`, `emailNoShows`, `sendNoShowNudge`, `sendGmailReminder`, `enableAutoReminders`
- **WebinarJam:** `listWebinars`, `listWebinarsWithSchedules`, `getWebinarDetails`, `saveWebinarSelection`, `testWebinarJamConnection`
- **Config:** `getSettings`, `saveCronConfig`, `getWebinarCredentials`, `getDashboardStats`, `getApiStatus`
- **AI Compose:** `composeMessage`, `composeEmail` — uses Claude to generate contextual SMS/email content

**`advanced.ts` (1353 lines) — Advanced Analytics**

Contains `rateLimitedAirDNARequest()` (the central AirDNA rate limiter), multi-year trend analysis, booking patterns, supply trends, and forward demand procedures. This file is the gateway for all AirDNA API calls — even `rental.ts` procedures call through here.

**`shareable-reports.ts` (197 lines) — Universal Share Links**

Thin router that delegates to `server/shareable-reports.ts`. Procedures: `create`, `get`, `notify`, `createAndNotify`, `updateRevenueOverride`, `getAnalytics`.

**`shared-reports.ts` (1416 lines) — Legacy Share System**

The older share system. Still functional for backwards compatibility. Handles shared property reports, market reports, and comparison reports.

**`regulation-tracker.ts` (701 lines) — STR Regulation Checking**

Checks short-term rental regulations for a city. Uses AI to analyze regulation data and provide a summary.

**`admin-tracking.ts` (637 lines) — Usage Analytics**

Tracks tool usage events, generates dashboard summaries, and provides per-user analytics. Key procedures: `trackEvent`, `getDashboardSummary`, `getUserActivity`, `getToolUsageBreakdown`.

**`voice-bug-report.ts` (565 lines) — Voice Bug Reports**

Allows users to record voice messages describing bugs. Transcribes audio via Whisper, then uses AI to extract structured bug report data.

**`content-studio.ts` (373 lines) — Social Media Content**

AI-powered content generation for social media posts, ad scripts, and marketing copy.

**`comp-data.ts` (366 lines) — Comparable Properties**

Fetches and formats comparable property data from AirDNA.

**`my-reports.ts` (333 lines) — Saved Reports**

CRUD for user's saved analysis reports.

**`ai.ts` (256 lines) — AI Chat**

Conversational AI advisor that answers property investment questions.

**`favorite-listings.ts` (237 lines) — Saved Listings**

CRUD for saving Airbnb/VRBO listings from the map/explore views.

**`favorites.ts` (204 lines) — Saved Properties**

CRUD for saving properties the user has analyzed.

**`saved-searches.ts` (199 lines) — Search History**

Saves and retrieves the user's past property searches.

**`market-explorer.ts` (193 lines) — Market Browsing**

Browse and explore different rental markets.

**`webhook.ts` (193 lines) — Zapier Integration**

Receives webhook data from Zapier for lead ingestion.

**`translation.ts` (176 lines) — Multi-language**

Translates report content to other languages via AI.

**`notifications.ts` (164 lines) — In-App Notifications**

CRUD for the notification bell in the header.

**`export.ts` (153 lines) — PDF/Excel Export**

Triggers PDF and Excel report generation.

**`email-optin.ts` (143 lines) — Email Collection**

Manages email opt-in forms and subscriptions.

**`rentometer.ts` (140 lines) — Rent Data**

Fetches long-term rental data from Rentometer API.

**`market-alerts.ts` (139 lines) — Market Alerts**

Configures automated alerts for market changes.

**`deal-alerts.ts` (137 lines) — Deal Scanning**

Configures criteria for automated deal alerts.

**`favorite-markets.ts` (126 lines) — Saved Markets**

CRUD for saving favorite markets.

**`lease-reader.ts` (94 lines) — Lease Analysis**

Uploads and analyzes lease PDFs using AI.

**`deep-analysis.ts` (81 lines) — Deep Analysis**

Triggers deep AI analysis on a property report.

**`zillow.ts` (78 lines) — Zillow Data**

Fetches Zillow property data via HasData.

**`bug-reports.ts` (430 lines) — Bug Reports**

User-submitted bug reports with screenshots and system info.

### 13.3 Service Files (Business Logic)

These files contain the actual business logic that routers call. They are in `server/` (not in `server/routers/`):

| File | Lines | What It Does |
|------|-------|-------------|
| `sop-reports.ts` | 4310 | Generates comprehensive SOP (Standard Operating Procedure) reports. The largest service file. |
| `report-generator.ts` | 2495 | Generates formatted property analysis reports with AI narratives. |
| `newsletter-email-sender.ts` | 1727 | Newsletter email sending via HubSpot Single Send API. |
| `opportunity-finder.ts` | 1371 | Scans Zillow listings to find rental arbitrage opportunities. |
| `market-research-simple.ts` | 1192 | Simplified market research for non-admin users. |
| `nurture-sequence-service.ts` | 1032 | Lead nurture email sequences. |
| `regulation-tracker.ts` | 929 | STR regulation data fetching and AI analysis. |
| `dev-mock-api.ts` | 897 | Mock API responses for development without burning API credits. |
| `hasdata.ts` | 810 | HasData API base client for web scraping. |
| `llm-provider.ts` | 756 | Claude API client with retry logic and error handling. |
| `hubspot.ts` | 706 | HubSpot CRM integration — contact CRUD, search, property updates. |
| `newsletter-orchestrator.ts` | 687 | Coordinates the full newsletter automation flow. |
| `hasdata-zillow.ts` | 649 | Zillow-specific HasData queries and data parsing. |
| `google-calendar.ts` | 583 | Google Calendar API integration — `sendCalendarInvite()`, `sendBulkCalendarInvites()`, `checkCalendarHealth()`. |
| `market-research.ts` | 581 | Market research report generation (v1). |
| `market-research-v2.ts` | 568 | Updated market research with more data sources. |
| `video-generation.ts` | 543 | AI video generation for content studio. |
| `lease-reader.ts` | 543 | Lease PDF parsing and AI analysis. |
| `shareable-reports.ts` | 539 | Creates shareable report links, generates share codes, sends notifications. |
| `export-pdf.ts` | 457 | PDF report generation using the built-in PDF library. |
| `rentometer.ts` | 443 | Rentometer API integration for long-term rental data. |
| `usage-limits.ts` | 431 | Configurable usage limits per user/session. |
| `newsletter-sms.ts` | 417 | SMS notifications for newsletter system. |
| `gmail-reminders.ts` | 407 | Gmail API integration for sending reminder emails. |
| `sms-email-notifications.ts` | 399 | SMS and email notification helpers used by the share system. |
| `model-router.ts` | 393 | Routes AI requests to Claude or Gemini based on task type. |
| `newsletter-content-generator.ts` | 371 | AI-generated newsletter content. |
| `hubspot-email.ts` | 365 | HubSpot email sending via Single Send API. |
| `newsletter-deal-finder.ts` | 360 | Scans markets for deals to include in newsletters. |
| `notification-service.ts` | 332 | In-app notification system. |
| `property-chat.ts` | 318 | AI chatbot for property-specific questions. |
| `newsletter-market-data.ts` | 315 | Market data aggregation for newsletters. |
| `webinar-cache.ts` | 302 | Caches webinar mode (demo/live) in memory. Reads from DB on startup. |
| `location-quality.ts` | 291 | Neighborhood quality scoring algorithm. |
| `export-excel.ts` | 272 | Excel report generation. |
| `translation-service.ts` | 270 | Translation via AI models. |
| `request-context.ts` | ~55 | `AsyncLocalStorage`-based request context for detecting admin requests deep in the call chain. |
| `rate-limiter.ts` | ~100 | Report generation rate limiter (5/day per user, admins exempt). |
| `db.ts` | varies | Database connection singleton and query helpers. |
| `storage.ts` | varies | S3 storage helpers (`storagePut`, `storageGet`). |

---

## 14. Every Frontend File Explained

### 14.1 Pages (`client/src/pages/`)

| File | Route | What It Does |
|------|-------|-------------|
| `Home.tsx` | `/` | Landing page with property search form. Redirects to LeadMagnet. |
| `LeadMagnet.tsx` | `/` | **THE main page.** 10-step tabbed analysis tool. Largest frontend file. |
| `UnifiedAdmin.tsx` | `/admin/dashboard` | Admin portal with 13 tabs (see Section 15). |
| `WebinarSmsTab.tsx` | (tab in admin) | WebinarJam SMS management UI. |
| `WebinarEnvTab.tsx` | (tab in admin) | Demo/live mode toggle. |
| `WebinarCampaignManager.tsx` | `/webinar-campaigns` | Standalone SMS campaign manager. |
| `ShareableReportViewer.tsx` | `/share/:shareCode` | Public shared report viewer. Routes to correct viewer based on reportType. |
| `SharedReportPage.tsx` | `/report/:shareId` | Legacy shared report viewer. |
| `MapViewPage.tsx` | `/map` | Full-screen map with Zillow/Redfin listings and revenue overlays. |
| `MarketAdvisor.tsx` | `/market-advisor` | Standalone market analysis page. |
| `MarketComparisonPage.tsx` | `/compare-markets` | Side-by-side market comparison. |
| `MarketDiscoveryPage.tsx` | `/discover-markets` | Browse top US markets by criteria. |
| `DealAlertsPage.tsx` | `/deal-alerts` | Automated deal scanning configuration. |
| `InvestmentCalculator.tsx` | `/investment-calculator` | Property investment calculator (mortgage, ROI, break-even). |
| `FullReportGenerator.tsx` | `/full-report` | Generate full report from address. |
| `MarketEvaluationPage.tsx` | `/evaluate-market` | One-click market evaluation. |
| `OpportunityFinder.tsx` | `/opportunity-finder` | Browse Zillow listings with revenue estimates. |
| `ContentStudioPage.tsx` | (tab in admin) | AI content generation for social media. |
| `AccountPage.tsx` | `/account` | User account settings. |
| `MyReportsPage.tsx` | `/my-reports` | User's saved reports. |
| `MyFavoritesPage.tsx` | `/my-favorites` | User's favorite markets. |
| `SavedItemsPage.tsx` | `/saved-items` | User's saved items (searches, properties, listings). |
| `BugReportPage.tsx` | `/bug/:shareCode` | Bug report viewer. |
| `TermsOfService.tsx` | `/terms-of-service` | TOS page. |
| `PrivacyPolicy.tsx` | `/privacy-policy` | Privacy policy. |
| `RefundPolicy.tsx` | `/refund-policy` | Refund policy. |
| `Contact.tsx` | `/contact` | Contact page. |

### 14.2 Key Components (`client/src/components/`)

**Data Display Components:**

| Component | Lines | What It Does |
|-----------|-------|-------------|
| `TeslaDashboard.tsx` | 3948 | **The main results dashboard.** Revenue projections, occupancy, comps, investment analysis, revenue charts. Contains the revenue override feature. Named "Tesla" because of its dashboard-style design. |
| `CompDataTable.tsx` | varies | Comparable properties table with sorting and filtering. |
| `HistoricalCharts.tsx` | varies | Historical revenue/occupancy charts using Chart.js. |
| `RevenueCharts.tsx` | varies | Monthly revenue forecast charts. |
| `RentometerSection.tsx` | varies | Rentometer data display (median rent, percentiles). |
| `STRvsLTRComparison.tsx` | varies | Short-term vs long-term rental comparison table. |
| `BreakEvenCalculator.tsx` | varies | Investment break-even analysis with charts. |
| `LoanCalculator.tsx` | varies | Mortgage/loan calculator. |
| `MaxPurchasePriceCalculator.tsx` | varies | Max purchase price calculator. |
| `AmortizationSchedule.tsx` | varies | Loan amortization table. |

**Step Components (used inside LeadMagnet tabs):**

| Component | What It Does |
|-----------|-------------|
| `AIAdvisorStep.tsx` | AI chat interface for property advice (Step 9). |
| `RegulationTrackerStep.tsx` | STR regulation checker UI (Step 1). |
| `OpportunityFinderStep.tsx` | Zillow listing browser (Step 2). |
| `LeaseReaderStep.tsx` | Lease upload and analysis (Step 10). |

**Map Components:**

| Component | What It Does |
|-----------|-------------|
| `CompsMapView.tsx` | Map showing comparable properties with pins. |
| `MapViewContent.tsx` | Map content with listing pins and filters. |
| `MapFirstLayoutV2.tsx` | Map-centric layout for Step 7. |

**Sharing and Actions:**

| Component | Lines | What It Does |
|-----------|-------|-------------|
| `UniversalShareButton.tsx` | 511 | Creates shareable links for any report. Handles share creation, clipboard copy, SMS/email notification. |
| `AddressAutocomplete.tsx` | varies | Google Places autocomplete for property addresses. |
| `MarketAutocomplete.tsx` | varies | AirDNA market search autocomplete. |

**Layout and Navigation:**

| Component | What It Does |
|-----------|-------------|
| `DashboardLayout.tsx` | Admin dashboard layout with sidebar navigation. |
| `AuthButton.tsx` | Login/logout button. |
| `NotificationBell.tsx` | In-app notification bell with unread count. |
| `ScrollToTopButton.tsx` | Floating scroll-to-top button. |
| `TrustBanner.tsx` | Trust/credibility banner shown on public pages. |
| `SEOHead.tsx` | Dynamic SEO meta tags for shared reports. |

**Utility Components:**

| Component | What It Does |
|-----------|-------------|
| `BugReportButton.tsx` | Bug report submission button (screenshot + system info). |
| `VoiceBugReportButton.tsx` | Voice-based bug reporting (records audio, transcribes, submits). |
| `InteractiveTour.tsx` | First-time user onboarding tour. |
| `TermsAcceptanceModal.tsx` | TOS acceptance modal (blocks usage until accepted). |
| `MockModeBadge.tsx` | Shows "DEMO MODE" badge when mock API is active. |
| `DataScopeIndicator.tsx` | Shows data source indicator (AirDNA, mock, etc.). |
| `GlobalLanguageSelector.tsx` | Language selection dropdown. |
| `GlobalAutoTranslator.tsx` | Auto-translation wrapper component. |
| `ErrorBoundary.tsx` | React error boundary (catches rendering crashes). |

### 14.3 Contexts (`client/src/contexts/`)

| Context | What It Provides |
|---------|-----------------|
| `PropertyContext.tsx` | Global property state — the user's selected property address, bedroom/bathroom counts, global mode (property-centric vs market-centric). Used across all steps so changing the address in one step updates all steps. |

### 14.4 Hooks (`client/src/hooks/`)

| Hook | What It Does |
|------|-------------|
| `useSavedItems.ts` | Manages saved searches, favorites, and bookmarks across the app. |
| `useAuth.ts` (in `_core/hooks/`) | Authentication state — current user, loading, isAuthenticated, logout function. |

---

## 15. Admin Portal

The admin portal lives at `/admin/dashboard` and is rendered by `UnifiedAdmin.tsx`. It has 13 tabs:

| # | Tab | What It Shows | Key tRPC Calls |
|---|-----|-------------|----------------|
| 1 | **Overview** | Dashboard stats: total users, reports generated, API calls today, active leads | `admin.getDashboardStats`, `adminTracking.getDashboardSummary` |
| 2 | **Activity** | Real-time activity feed showing all user actions with names and emails | `admin.getActivityFeed` |
| 3 | **Users** | User management: search, filter by role, view usage, promote to admin | `admin.listUsers`, `admin.updateUserRole` |
| 4 | **API Usage** | AirDNA/Rentometer/HasData call counts, daily trends, cost estimates | `admin.getApiUsage`, `admin.getApiUsageTrends` |
| 5 | **HubSpot** | CRM integration status, contact sync, recent leads | `admin.getHubspotStatus`, `admin.getRecentLeads` |
| 6 | **Notifications** | Notification delivery analytics, SMS/email success rates | `admin.getNotificationStats` |
| 7 | **Properties** | All generated property reports, searchable and viewable | `admin.getReports` |
| 8 | **Newsletter** | Newsletter campaign management, subscriber stats | `newsletter.*` procedures |
| 9 | **Cache** | API cache management, clear stale entries | `admin.getCacheStats`, `admin.clearCache` |
| 10 | **Content Studio** | AI content generation for social media | `contentStudio.*` procedures |
| 11 | **Webinar SMS** | Full WebinarJam SMS/Calendar management (Sections 6-8) | `webinarSms.*` procedures |
| 12 | **Webinar Env** | Toggle between demo mode and live mode | `webinarEnv.*` procedures |
| 13 | **Data Policy** | Data retention and privacy settings | `admin.getDataPolicy` |

Each tab's queries use `enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'tab-name'` so data is only fetched when the tab is active. This prevents unnecessary API calls when the admin first loads the dashboard.


---

## 16. Background Jobs and Cron Systems

The server runs several background jobs that execute independently of HTTP requests. All are started in `server/_core/index.ts` after the server begins listening.

### 16.1 Registrant Import Cron

- **Frequency:** Configurable (default 30 minutes), stored in `webinar_sms_settings` as `cron_interval_minutes`
- **Toggle:** `cron_enabled` setting in `webinar_sms_settings` (also requires `FORCE_CRON=true` env var in dev)
- **Function:** `startWebinarImportCron()` in `server/routers/webinar-sms.ts`
- **What it does:** Calls `runWebinarImport()` which fetches registrants from WebinarJam and inserts new ones
- **After import:** Triggers `autoSendCalendarInvites()` for any registrants with `calendarInviteSent = 0`
- **Logging:** Writes `last_auto_import_at` and `last_auto_import_result` to `webinar_sms_settings`
- **Restart:** `restartWebinarImportCron()` clears the old interval and starts a new one. Called when the admin changes the selected webinar.

### 16.2 SMS Dispatcher

- **Frequency:** Every 30 seconds (`setInterval` with 30000ms)
- **Function:** `startSmsDispatcher()` in `server/routers/webinar-sms.ts`
- **What it does:** Finds `scheduled_sms_messages` where `status = 'pending'` and `scheduledAt <= now`, sends them via SimpleTexting
- **Mutex:** `smsDispatcherRunning` boolean prevents concurrent dispatch runs
- **Startup recovery:** On first tick, resets any messages stuck in `sending` status to `pending` (from previous server crash). This is `await`ed before the first dispatch.
- **Stale check:** Messages >30 minutes past schedule are auto-cancelled
- **Attendance sync:** For audience-targeted messages, forces a fresh WebinarJam attendance sync before sending

### 16.3 Video Generation Resume

- **Runs:** Once on startup
- **Function:** `resumeIncompleteJobs()` in `server/video-generation.ts`
- **What it does:** Finds video generation jobs with status `processing` (interrupted by server restart) and resumes them

### 16.4 Webinar Mode Init

- **Runs:** Once on startup
- **Function:** `initWebinarMode()` in `server/webinar-cache.ts`
- **What it does:** Reads the `webinar_mode` setting from DB (`demo` or `live`) and caches it in memory. This controls whether the WebinarJam SMS tab shows demo data or real data.

---

## 17. Rate Limiting and Access Control

### 17.1 Report Generation Rate Limit

- **Limit:** 5 reports per day per user
- **Admins:** Exempt (unlimited)
- **Implementation:** In-memory counter in `server/rate-limiter.ts`, resets at midnight UTC
- **Enforcement:** `checkReportRateLimit()` is called at the start of `getPropertyReport` and `getAIPropertyReport`
- **Error message:** "Daily report limit reached (5/day). Your limit resets at midnight — come back tomorrow!"

### 17.2 AirDNA API Rate Limit

- **Soft limit:** 400 calls/day for non-admin users (configurable in `usage_limits_config` table)
- **Admins:** Bypass the soft limit entirely
- **Implementation:** `rateLimitedAirDNARequest()` in `server/routers/advanced.ts`
- **Admin detection:** Uses `AsyncLocalStorage` via `server/request-context.ts`. The tRPC procedure wraps the call in `runWithRequestContext({ isAdmin: true })`, and deep in the call chain, `isAdminRequest()` checks the context without needing the user object passed through every function.

### 17.3 Google Calendar Rate Limit

- **Limit:** ~60 writes/minute per user (Google's limit)
- **Implementation:** 1500ms delay between calls + exponential backoff on 429 errors
- **Backoff strategy:** 5s → 10s → 20s, with 3 retries per invite
- **Adaptive cooldown:** Base delay increases by 2000ms per consecutive rate limit failure

### 17.4 Role-Based Access

| Role | How Detected | Can Access |
|------|-------------|-----------|
| **Anonymous** | No session cookie | Public procedures only (getEstimate, searchMarkets, submitLead, shared reports) |
| **User** | Valid session cookie, `role === 'user'` | Protected procedures (save favorites, view own reports, account settings) |
| **Admin** | Valid session cookie, `role === 'admin'` | Everything, including all AirDNA-heavy procedures and the admin portal |
| **Owner** | `openId === OWNER_OPEN_ID` or `email === 'bryson@stayly.com'` | Admin + revenue override + owner-specific features (e.g., revenue +/- buttons) |

**How to make someone an admin:** Update their `role` field in the `users` table to `'admin'` via the database UI or SQL:
```sql
UPDATE users SET role = 'admin' WHERE email = 'someone@example.com';
```

---

## 18. Environment Variables

Every environment variable and what it does. Variables prefixed with `VITE_` are exposed to the frontend JavaScript bundle — **never put secrets in VITE_ variables**.

### 18.1 Required (App Won't Work Without These)

| Variable | What It Does |
|----------|-------------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Signs session cookies for authentication |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend redirect) |
| `OWNER_OPEN_ID` | Owner's Manus OpenID (for owner detection in UI) |
| `OWNER_NAME` | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Manus API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Manus API URL |

### 18.2 External API Keys (Features Degrade Without These)

| Variable | What It Does | What Breaks Without It |
|----------|-------------|----------------------|
| `AIRDNA_API_KEY` | AirDNA API key | All property revenue analysis stops working |
| `ANTHROPIC_API_KEY` | Claude AI API key | AI analysis, SMS generation, content studio stop working |
| `GEMINI_API_KEY` | Google Gemini API key | Fallback AI stops working (Claude still works) |
| `RENTOMETER_API_KEY` | Rentometer API key | Long-term rental data unavailable |
| `HASDATA_API_KEY` | HasData API key | Zillow/Redfin data unavailable |
| `SIMPLETEXTING_API_KEY` | SimpleTexting API key | SMS sending stops working |
| `WEBINARJAM_API_KEY` | WebinarJam global API key | Registrant import stops (unless per-webinar keys exist) |
| `HUBSPOT_API_KEY` | HubSpot CRM API key | Lead sync and newsletter emails stop working |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` | Google service account credentials (JSON string) | Calendar invites stop working |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Email to impersonate for Calendar/Gmail | Calendar and Gmail reminders stop working |
| `ZAPIER_WEBHOOK_URL` | Zapier webhook for lead forwarding | Lead forwarding to external systems stops |
| `VITE_GOOGLE_PLACES_API_KEY` | Google Places API key | Address autocomplete stops working |

### 18.3 Optional / Development

| Variable | What It Does |
|----------|-------------|
| `VITE_APP_TITLE` | App title displayed in browser tab and header |
| `VITE_APP_LOGO` | App logo URL |
| `DEV_MOCK_API` | Set to `"true"` to use mock API responses (saves API credits in dev) |
| `FORCE_CRON` | Set to `"true"` to force cron jobs to run even in dev mode |

### 18.4 Adding a New Environment Variable

1. Add it to `server/_core/env.ts` in the `ENV` object
2. Add it to Manus secrets via the Settings panel or `webdev_request_secrets`
3. Access it in server code via `ENV.myNewVar`
4. If it's a frontend variable, prefix with `VITE_` and access via `import.meta.env.VITE_MY_VAR`
5. Restart the server after adding

---

## 19. Safe Editing Rules

### 19.1 Files You Should NEVER Edit

| Path | Why |
|------|-----|
| `server/_core/*` | Framework plumbing. Editing these can break auth, tRPC, or the entire server. |
| `drizzle/meta/*` | Migration metadata. Drizzle manages these automatically. |
| `drizzle/migrations/*` | Auto-generated SQL. Drizzle manages these. |
| `node_modules/*` | Dependencies. Use `pnpm add` to install packages. |
| `dist/*` | Build output. Regenerated on every build. |
| `client/src/lib/trpc.ts` | tRPC client binding. Auto-generated configuration. |
| `client/src/main.tsx` | App bootstrap with tRPC provider. Only edit if changing global providers. |
| `client/src/_core/*` | Auth hook. Framework-level. |
| `shared/_core/*` | Framework-level shared types. |

### 19.2 Files That Are Safe to Edit (With Specific Warnings)

| File | What You Can Change | Danger Zones |
|------|--------------------|-----------------------|
| `server/routers/webinar-sms.ts` | SMS templates, message content, audience logic | The cron functions (`startWebinarImportCron`, `startSmsDispatcher`) are sensitive. Any change to the dispatch loop must preserve the mutex lock (`smsDispatcherRunning`) and stale message check (30-min cutoff). |
| `server/google-calendar.ts` | Event description, reminders, duration | **NEVER add a Z suffix to date strings.** Always use format `"YYYY-MM-DDTHH:mm:ss"` without Z. See Section 8.2 for why. |
| `server/routers/rental.ts` | Analysis logic, what data is fetched | Adding more AirDNA API calls increases cost per report. Each call costs ~$0.01. A full report already makes 15-30 calls. |
| `client/src/pages/LeadMagnet.tsx` | Tab content, UI layout, step order | The `ADMIN_ONLY_TABS` and `TAB_ORDER` arrays control access. Changing them affects what non-admin users see. |
| `client/src/components/TeslaDashboard.tsx` | Revenue display, charts, investment analysis | The revenue override logic is intertwined with the share system. If you change how `revenueOverride` state works, test that shared reports still show the correct number. |
| `client/src/components/UniversalShareButton.tsx` | Share dialog UI, notification options | The `useEffect` that auto-syncs revenue overrides is critical. Don't remove it or shares will show stale revenue numbers. |
| `drizzle/schema.ts` | Add new tables or columns | After editing, run `pnpm db:push` to sync. Never delete columns that existing code reads from — this will crash the server. |
| `server/routers.ts` | Add new routers | Just add a new key-value pair. Don't rename existing router keys (breaks all frontend calls using the old name). |

### 19.3 The Golden Rule for Editing

Before editing any file, search the codebase for every place that imports from it:

```bash
grep -rn "from.*filename" server/ client/src/
```

If 10 files import from the file you're editing, you need to understand all 10 call sites before making changes. A change in a service file can cascade through routers, components, and background jobs.

---

## 20. How to Add a New Feature

### 20.1 Adding a New tRPC Procedure

1. **Choose the right router file.** If it's related to webinars/SMS, add it to `server/routers/webinar-sms.ts`. If it's a new feature area, create a new file in `server/routers/`.

2. **Define the procedure:**
```typescript
// In server/routers/my-feature.ts
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

export const myFeatureRouter = router({
  getData: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      // ... your logic ...
      return { data: result };
    }),
});
```

3. **Export from barrel** in `server/routers/index.ts`:
```typescript
export { myFeatureRouter } from "./my-feature";
```

4. **Add to appRouter** in `server/routers.ts`:
```typescript
myFeature: myFeatureRouter,
```

5. **Call from frontend:**
```typescript
const { data } = trpc.myFeature.getData.useQuery({ id: "123" });
```

### 20.2 Adding a New Database Table

1. **Define the table** in `drizzle/schema.ts`:
```typescript
export const myTable = mysqlTable("my_table", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

2. **Push the migration:**
```bash
pnpm db:push
```

3. **Import and use** in your router or service file:
```typescript
import { myTable } from "../../drizzle/schema";
import { getDb } from "../db";

const db = await getDb();
const rows = await db.select().from(myTable).where(eq(myTable.name, "test"));
```

### 20.3 Adding a New Admin Tab

1. Add a new `TabsTrigger` and `TabsContent` in `client/src/pages/UnifiedAdmin.tsx`
2. Create a new component for the tab content (can be inline or a separate file)
3. Add any necessary tRPC queries with `enabled: isAuthenticated && user?.role === 'admin' && activeTab === 'my-tab'` to prevent data fetching when the tab isn't active
4. If the tab is complex, use `lazy()` import like the existing Content Studio and Webinar SMS tabs

### 20.4 Adding a New Step to the Lead Magnet

1. Add the new tab type to the `TabType` union in `client/src/pages/LeadMagnet.tsx`
2. Add it to `ALL_TABS` array (and `ADMIN_ONLY_TABS` if it requires admin access or heavy API usage)
3. Add the step mapping in `stepMapping` for URL deep linking
4. Add the tab trigger and content in the JSX
5. Create the step component in `client/src/components/`
6. If the step generates shareable data, add a new `reportType` to the `universalShareableReports` enum in `drizzle/schema.ts` and run `pnpm db:push`

---

## 21. Bugs That Were Fixed and Why They Happened

These are real bugs that were found and fixed. Understanding them helps you avoid similar issues.

### 21.1 WebinarJam Import Returning 0 Registrants

**Symptom:** The cron job reported "imported 0, skipped 0" even though the webinar had 337 registrants.

**Root causes (three bugs stacked on top of each other):**

1. **Stale schedule_id:** The DB stored schedule_id 658 but WebinarJam had changed it to 660 when the webinar was recreated. The API returned 0 results for the old schedule_id.
   - **Fix:** Added fallback logic — if schedule_id returns 0 results, retry without it.

2. **Stale closure:** `startWebinarImportCron()` captured `webinarId` and `scheduleId` at startup in a closure and never refreshed them. If you changed the selected webinar in the UI, the cron kept importing from the old webinar.
   - **Fix:** Cron now re-reads all settings from DB on every tick.

3. **No cron restart:** `saveWebinarSelection` saved new settings to DB but didn't restart the cron interval. The cron kept running with the old interval timing.
   - **Fix:** Added `restartWebinarImportCron()` call after saving selection.

**Lesson:** Never capture mutable configuration in closures. Always re-read from DB. And when settings change, restart the systems that depend on them.

### 21.2 Calendar Invites Showing Wrong Time (4 Hours Early)

**Symptom:** Calendar events showed at 12:00 PM PDT instead of 7:00 PM ET.

**Root cause:** JavaScript's `new Date("2026-03-11 19:00:00")` parses the string as UTC. Calling `.toISOString()` outputs `"2026-03-11T19:00:00.000Z"`. The Z suffix tells Google Calendar API to treat it as UTC, which means it ignores the `timeZone: "America/New_York"` field entirely. So 19:00 UTC = 3:00 PM ET (or 12:00 PM PDT).

**Fix:** Pass raw date strings without the Z suffix: `"2026-03-11T19:00:00"` (no Z). When there's no Z, Google Calendar respects the `timeZone` field and treats 19:00 as 7:00 PM Eastern.

**Lesson:** Never convert date strings through JavaScript's `Date` object when you need to preserve the original timezone intent. Pass raw strings and let the receiving API handle timezone interpretation.

### 21.3 Duplicate SMS Sends (341 People Got the Same Message Twice)

**Symptom:** 341 recipients each received the same SMS twice.

**Root cause:** Race condition in `startSmsDispatcher()`. The startup recovery code (which resets stuck `sending` messages back to `pending`) ran as a fire-and-forget async IIFE. At the same time, `processScheduledMessages()` ran immediately on the first tick. Both found the same messages and processed them in parallel.

**Fix (two changes):**
1. Made startup recovery `await`ed — it must complete before the first dispatch tick runs
2. Added `smsDispatcherRunning` mutex boolean — if a dispatch is already in progress, the next tick skips entirely

**Lesson:** Never fire-and-forget async operations that modify shared state. Use mutexes for concurrent access to shared resources.

### 21.4 Calendar Invite Rate Limiting (All Invites Failing After ~10)

**Symptom:** After sending ~10 calendar invites, all remaining invites failed with "Rate Limit" error.

**Root cause:** The delay between Google Calendar API calls was 200ms, which equals 300 requests/minute. Google's limit is 60 writes/minute per user.

**Fix:** Increased delay to 1500ms (~40/min, safely under the 60/min limit) + added exponential backoff (5s → 10s → 20s on consecutive rate limit errors) + 3 retries per invite.

**Lesson:** Always calculate the actual request rate: `1000ms / delay_ms * 60 = requests_per_minute`. Then compare against the API's documented rate limit.

### 21.5 Shared Report Not Showing Revenue Override

**Symptom:** Admin edited revenue to $57,930, shared the link, but the shared page showed the original AirDNA number ($45,000).

**Root cause (three issues):**
1. `revenueOverride` wasn't being passed to the share creation mutation
2. No mechanism to sync override changes made AFTER the share was already created
3. The viewer component didn't know where to read the override from

**Fix (three changes):**
1. Added explicit `revenueOverride` parameter to the `create` mutation input
2. Added a `useEffect` in `UniversalShareButton` that watches for `revenueOverride` prop changes and auto-syncs to DB via `trpc.shareableReports.updateRevenueOverride`
3. Added fallback chain in viewer: read `revenueOverride` DB column first, fall back to `reportData._revenueOverride` for backwards compatibility

**Lesson:** When data flows through multiple systems (UI → mutation → DB → viewer), test the entire chain end-to-end. A break at any point in the chain causes silent data loss.

### 21.6 Admin Users Being Rate-Limited by AirDNA Soft Limit

**Symptom:** Admin got "rate limit exceeded" errors when running property reports, even though admins should be exempt.

**Root cause:** The `runWithRequestContext()` wrapper was missing from the tRPC procedures that call AirDNA. The rate limiter's `isAdminRequest()` function uses `AsyncLocalStorage` to check if the current request is from an admin. Without the wrapper, the context was never set, so `isAdminRequest()` always returned `false`.

**Fix:** Added `runWithRequestContext({ isAdmin: ctx.user.role === 'admin', userId: ctx.user.id })` wrapper to all procedures that call `rateLimitedAirDNARequest()`.

**Lesson:** `AsyncLocalStorage` context must be explicitly set at the procedure level. It does not propagate automatically from the tRPC middleware. If you add a new procedure that calls rate-limited functions, you must wrap it in `runWithRequestContext()`.

---

## 22. Troubleshooting Playbook

### "Registrants aren't importing"

1. Check `webinar_sms_settings` table for `cron_enabled = "true"` and a valid `selected_webinar_id`
2. Check `last_auto_import_at` and `last_auto_import_result` for the last run status
3. Check server logs for `[WebinarSMS Cron]` entries
4. Verify the WebinarJam API key is valid: use `trpc.webinarSms.testWebinarJamConnection`
5. Check if the `selected_schedule_id` is still valid (WebinarJam may have changed it when recreating the webinar)
6. In dev mode, check that `FORCE_CRON=true` is set (cron is disabled by default in dev)

### "SMS messages aren't sending"

1. Check `scheduled_sms_messages` table for messages with `status = 'pending'` and `scheduledAt` in the past
2. Check if messages are being auto-cancelled (status = `cancelled`) — this means they were >30 min past schedule
3. Check server logs for `[SMS Dispatcher]` entries
4. Verify SimpleTexting API key: use `trpc.webinarSms.testSimpleTextingConnection`
5. Check if `smsDispatcherRunning` mutex is stuck (server restart fixes this)
6. For attendance-targeted messages: check if the WebinarJam attendance sync succeeded (logs show `[Attendance Sync]`)

### "Calendar invites failing"

1. Check server logs for `[Calendar Auto]` or `[Calendar]` entries
2. Verify Google Calendar health: use `trpc.webinarSms.testCalendarConnection`
3. Check `webinar_registrants` table for `calendarInviteError` column — it stores the specific error
4. If rate limit errors: wait 1-2 minutes and retry (the exponential backoff handles this automatically)
5. Check that `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` and `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` are set correctly
6. Verify the service account has domain-wide delegation enabled in Google Workspace admin

### "Calendar invites showing wrong time"

1. Check the `calendar_invite_time` and `calendar_invite_timezone` settings in `webinar_sms_settings`
2. Check server logs for the date string being passed to Google Calendar API — it should NOT have a Z suffix
3. If it has a Z suffix, the timezone fix in `server/google-calendar.ts` is not being applied correctly

### "Shared report shows wrong revenue"

1. Check `universal_shareable_reports` table for the share code
2. Look at both `revenueOverride` column AND `reportData._revenueOverride` in the JSON blob
3. If they don't match, the auto-sync `useEffect` may have failed — manually update the `revenueOverride` column
4. Check that the `UniversalShareButton` component received the `revenueOverride` prop correctly

### "API calls are being rate limited"

1. Check `api_call_logs` table for today's call count: `SELECT COUNT(*) FROM api_call_logs WHERE DATE(createdAt) = CURDATE()`
2. If admin is being limited: verify `runWithRequestContext({ isAdmin: true })` is wrapping the procedure
3. If non-admin: they hit the 5 reports/day limit — this is by design
4. Check `api_usage_summary` for daily totals per API
5. Check `usage_limits_config` for the current soft limit value

### "Server won't start"

1. Check for port conflicts: `lsof -i :3000`
2. Check `DATABASE_URL` is valid and the database is reachable: `mysql -h <host> -u <user> -p`
3. Check server logs for `[FATAL]` entries (unhandled rejections)
4. Check if `pnpm install` needs to run (missing dependencies)
5. Try `pnpm dev` and watch the console output for the specific error

### "Frontend shows blank page"

1. Check browser console for JavaScript errors
2. Check if the tRPC client can reach the server: look for network errors in DevTools
3. Check if the session cookie is present (Application → Cookies → `__session`)
4. If after a deploy: clear browser cache or hard refresh (Ctrl+Shift+R)

### "Mock mode is stuck on"

1. Check `DEV_MOCK_API` environment variable — it should be `"false"` or unset in production
2. Check the `webinar_mode` setting in `webinar_sms_settings` — it should be `"live"` not `"demo"`
3. The `MockModeBadge` component shows a red "DEMO MODE" badge when mock mode is active

---

*This guide was written based on direct analysis of every file in the codebase as of March 10, 2026. If you find something that doesn't match the actual code, the code is the source of truth — update this guide accordingly.*
