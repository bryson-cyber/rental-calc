# SMS Features Implementation Notes

## Current Sequence (generateSequence)
- 9-message sequence with hardcoded timing offsets from webinarDate
- Steps: Registration Confirm (7d), 2 Days Before, Day Before, Morning Of (4hr), 1 Hour Warning, Going Live NOW (5min), Thank You Attended (1hr after), Missed You No-Show (2hr after), Follow-Up CTA (1d after)
- User wants: 1 hour before, 15 min before, "starting now" as the key pre-webinar reminders
- Need to make timing editable per step

## SimpleTexting API
- Base URL: https://api-app2.simpletexting.com/v2/api
- Auth: Bearer token (SIMPLETEXTING_API_KEY)
- Send: POST /messages with { contactPhone, mode, text }
- Need to find: GET endpoint for incoming messages/replies

## Scheduled SMS Messages Table
- Already exists: scheduledSmsMessages with webinarId, sequenceName, sequenceOrder, messageBody, scheduledAt, audience, status

## Key Approach
1. Replies: SimpleTexting likely has webhooks or GET /messages?direction=inbound. If no API, can use webhooks.
2. Sequence timing: Add editable offsets to the UI, save as settings or directly update scheduledAt
3. No-show nudge: Query registrants with attended=0 where webinar started 10+ min ago, send bulk SMS
