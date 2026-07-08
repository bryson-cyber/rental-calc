# Webinar System Audit Findings

## Current System Inventory

### SMS Sequence (10 messages, fully automated via dispatcher)
1. **2 Days Before Reminder** (-2880 min / -48h) → audience: all
2. **Day Before Reminder** (-1440 min / -24h) → audience: all
3. **Morning Of** (-720 min / -12h) → audience: all
4. **1 Hour Warning** (-60 min) → audience: all
5. **15 Min Before** (-15 min) → audience: all ✅ EXISTS
6. **Starting NOW** (-5 min) → audience: all
7. **No-Show Nudge** (+10 min) → audience: not_attended
8. **Thank You (Attended)** (+60 min) → audience: attended
9. **Missed You (No-Show)** (+120 min) → audience: not_attended
10. **Follow-Up CTA** (+1440 min / +24h) → audience: all

### Multi-Channel Firing (automatic alongside SMS)
When SMS dispatcher sends certain sequence messages, it also fires:
- **Calendar Event Updates** (updates event description → triggers Google Calendar notification email)
- **Gmail Reminder Emails** (sends branded HTML emails via Gmail API)

Mapped sequences:
- "2 Days Before Reminder" → 24h reminder type
- "Day Before Reminder" → 24h reminder type
- "1 Hour Warning" → 1h reminder type
- "Starting NOW" → starting reminder type

### Email Templates (Gmail API)
Only 3 reminder types exist: "24h", "1h", "starting"
- No registration confirmation email
- No replay email
- No post-webinar nurture email sequence (exists in docs as HubSpot templates but not automated in-app)
- No missed-you email (only SMS)

### Calendar Integration (Google Calendar API)
- Auto-sends calendar invite on registration (fire-and-forget)
- Calendar event has reminders: 24h email, 1h email, 30min popup, 10min popup
- Bulk send for missing invites
- Retry failed invites
- ICS file generation for non-Google users
- Calendar reminder updates (modifies event to trigger notification)

### Confirmation SMS
- Sent automatically on cron cycle to new registrants
- Customizable template in settings
- Deduplicates by phone number
- Also adds to SimpleTexting contact list

### Cron / Background Automation
- **Import Cron**: Runs every N minutes (default 3), imports from WebinarJam, auto-sends calendar invites, auto-sends confirmation SMS, syncs to SimpleTexting list, auto-refreshes attendance
- **SMS Dispatcher**: Runs every 30 seconds, picks up pending scheduled messages, sends them
- Both are in-process `setInterval` (NOT Heartbeat cron) — CRITICAL RELIABILITY ISSUE per periodic-updates.md which says setInterval is FORBIDDEN because Cloud Run terminates idle instances

### Monitoring & Alerting (CURRENT STATE)
- **Owner notification helper exists** (`notifyOwner({ title, content })`) but is NOT called anywhere in webinar system
- **Console.log/console.error** throughout — no structured logging, no external log aggregation
- **Email send log table** (emailSendLog) tracks: webinarId, recipientEmail, channel, reminderType, status, error, triggeredBy
- **Campaign history** with per-delivery tracking (webinarSmsDeliveries table)
- **Calendar invite stats** (sent/pending/failed counts + failed registrant details)
- **No alerting on failures** — if SMS fails, email bounces, or cron stops, nobody is notified
- **No health check endpoint** — no way to verify system is running
- **No dashboard for operational metrics** — must manually check campaign history

### Admin Tools (CURRENT STATE)
- Webinar selection + per-webinar credentials
- Attendance dashboard (total/attended/no-show/opted-out/calendar-invites)
- Manual import + refresh attendance
- Quick Send + AI SMS composer with test send
- Sequence Builder (editable messages, timing, Send Now)
- Campaign History with live progress, stop, resend failed, per-delivery drilldown
- Calendar panel: invite stats, retry failed, re-send all, auto-reminder schedule, manual reminders, ICS download, email/calendar log
- Settings: cron config, list sync, confirmation template, transcript upload
- HubSpot no-show email composer
- SMS Replies inbox
- Live no-show nudge

### What's Missing (Initial Assessment)

#### CRITICAL RELIABILITY ISSUES
1. **setInterval-based crons will die on Cloud Run** — periodic-updates.md explicitly forbids this
2. **No alerting** — failures are silent
3. **No health monitoring** — no way to know if dispatcher stopped

#### MISSING MESSAGES
- No registration confirmation EMAIL (only SMS)
- No "morning of" EMAIL (only SMS)
- No replay delivery email (only SMS "Thank You" with replay link)
- No post-webinar nurture sequence (day 2-7 follow-up emails exist in docs but not automated)
- No "last chance" replay expiring message
- No "application received" confirmation after CTA click

#### MISSING FEATURES
- No A/B testing for message copy
- No AI-generated personalized copy per send (LLM exists but only for manual AI composer)
- No delivery receipt tracking (SimpleTexting webhooks not consumed)
- No open/click tracking for emails
- No unsubscribe management for emails (only SMS opt-out)
- No webinar-to-webinar registrant migration tool (only no-show reimport exists)
- No automated post-webinar replay sequence
- No conditional branching (if opened email, skip SMS)
