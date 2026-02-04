# Simplified Nurture SMS Templates (CTA-Focused)

These SMS messages use HubSpot contact tokens only - no AirDNA API calls required.
All messages are under 160 characters for single SMS delivery.

## Available HubSpot Tokens for SMS
- `{{contact.firstname}}` - First name
- `{{contact.data_perfection__city}}` - City
- `{{contact.data_perfection__state}}` - State

---

## Day 1: Welcome SMS (Immediately after opt-in)

```
Hey {{contact.firstname}}! Your free {{contact.data_perfection__city}} rental calculator is ready: coachinayahturnkeytool.com Can't wait to break it all down Sunday at 7pm ET 🙌 - Inayah
```

**Character count:** ~155

---

## Day 3: Engagement SMS

```
{{contact.firstname}}! Had to text you - been looking at {{contact.data_perfection__city}} numbers and the opportunities are real. Check it out: coachinayahturnkeytool.com
```

**Character count:** ~148

---

## Day 5: Social Proof SMS

```
Quick thought {{contact.firstname}} - some hosts in {{contact.data_perfection__city}} are crushing it. Want to see the numbers? coachinayahturnkeytool.com Sunday I'll show you how
```

**Character count:** ~156

---

## Day 6: Reminder SMS (Day before webinar)

```
Hey! Tomorrow at 7pm ET we're meeting live. If you haven't tried the calculator yet: coachinayahturnkeytool.com You coming? - Inayah
```

**Character count:** ~130

---

## Day 7: Day-Of SMS (2 hours before webinar)

```
{{contact.firstname}}! We start in 2 hours. Grab your coffee and I'll see you there ☕ [WEBINAR_LINK]
```

**Character count:** ~95 (plus link)

---

## SimpleTexting Setup Instructions

### Option 1: Manual Campaigns
1. Create 5 separate campaigns in SimpleTexting
2. Use HubSpot list as your contact source
3. Schedule each campaign with appropriate delays
4. Use merge tags: `{firstname}`, `{city}`, `{state}`

### Option 2: Zapier Automation
1. Create a Zap triggered by "Contact added to list" in HubSpot
2. Add a "Send SMS" action via SimpleTexting
3. Map HubSpot fields to SimpleTexting merge tags
4. Create separate Zaps for each day with delay steps

### Option 3: SimpleTexting Autoresponders
1. Set up keyword opt-in (e.g., "WEBINAR")
2. Create autoresponder sequence with 5 messages
3. Set delays: Day 1 = immediate, Day 3 = 2 days, Day 5 = 2 days, Day 6 = 1 day, Day 7 = 1 day

---

## Notes

1. Replace `[WEBINAR_LINK]` with your actual webinar join link
2. All messages end with opt-out compliance (SimpleTexting handles this automatically)
3. Messages are conversational and relationship-focused per brand guidelines
4. Each message drives to coachinayahturnkeytool.com for engagement
5. No AirDNA data = no API costs for SMS nurture sequence
