# Coach Inayah Turnkey Tool — Slack Integration Setup Guide

**Author:** Manus AI
**Last Updated:** February 13, 2026

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [What's Already Built](#whats-already-built)
3. [What You Need to Do](#what-you-need-to-do)
4. [How to Send a Deal to a Client](#how-to-send-a-deal-to-a-client)
5. [Admin Panel Features](#admin-panel-features)
6. [Strategic Roadmap: What Else to Build](#strategic-roadmap-what-else-to-build)
7. [Troubleshooting](#troubleshooting)

---

## How It Works

You find a property deal using the Turnkey Tool. You run the analysis (Steps 1-5) or generate a Premium Report. When you're looking at the report, you click **"Send to Slack"** — a button that appears in the report header for admin users only. A modal opens where you search for the client's Slack channel, the AI generates a deal summary pitched as an investment opportunity, and you send it. The client sees the deal summary, a link to the full report, and Zillow/Redfin links — all in their Slack channel. Every send is tracked in your admin panel.

There is no slash command. There is no bot that clients interact with. You control what gets sent, to whom, and when. The tool is your deal delivery pipeline.

---

## What's Already Built

Everything is built and ready to use. There is nothing to configure in Slack — the integration uses the existing Slack MCP connection that's already authenticated with your workspace.

| Feature | Where It Lives | What It Does |
|---------|---------------|--------------|
| **Send to Slack button** | Report page header (admin only) | Opens a modal to send this report to any Slack channel |
| **Send to Slack button** | Build Full Report dialog (Step 5) | After generating a report, send it directly to a client channel |
| **Send to Slack tab** | Admin panel | Full Slack management: send reports, batch send, delivery history |
| **Dynamic channel search** | Inside every Send to Slack modal | Search all workspace channels (public and private) in real-time |
| **AI deal summary** | Inside every Send to Slack modal | Gemini generates a 3-5 sentence pitch presenting the property as an opportunity |
| **Delivery tracking** | Database + Admin panel History tab | Every send is logged with channel, report, status, timestamp, and message permalink |
| **Batch send** | Admin panel > Send to Slack > Batch Send | Send the same report to multiple client channels at once |

---

## What You Need to Do

**Nothing.** The Slack MCP connection is already authenticated with your workspace. The Send to Slack button works out of the box for admin users.

If the bot needs to post to a **private channel**, you need to invite it to that channel first. In Slack, go to the private channel and type `/invite @Coach Inayah Turnkey Bot`. Public channels work without an invite.

---

## How to Send a Deal to a Client

This is the step-by-step workflow for delivering a deal to a client via Slack.

### From a Property Report

1. Log in to **coachinayahturnkeytool.com** as an admin user
2. Navigate to any property report. You can get there by:
   - Running a new analysis through Steps 1-5 and clicking "View Full Report"
   - Going to the Admin panel > Reports tab and clicking on any existing report
   - Opening a shared report link (e.g., `coachinayahturnkeytool.com/report/abc123`)
3. In the report header, you will see a button labeled **"Send to Slack"** with a paper plane icon. It appears next to "Copy Link" and "Regenerate." Click it.
4. A modal opens with these sections:

**Select Channel:**
- A search box appears at the top. Type the name of the client's channel (e.g., "john" to find `#client-john-smith`)
- Results appear as you type. Click the channel you want
- The selected channel appears as a tag below the search box

**Report Info:**
- The property address, bedrooms, bathrooms, and report link are pre-filled from the current report. You do not need to change anything here.

**AI Deal Summary:**
- Click the **"Generate AI Summary"** button
- Gemini reads the report data (revenue, ADR, occupancy, comps, seasonality) and writes a 3-5 sentence pitch
- The pitch presents the property as an investment opportunity. It leads with the most compelling number and ends with an encouraging statement. It does NOT give investment advice — it presents data.
- You can edit the summary text before sending. Add personal notes, adjust the tone, or rewrite entirely.

**Custom Message (optional):**
- Below the AI summary, there's a text box for a custom message
- This appears above the deal summary in the Slack message
- Use it for personal notes like "Hey John, this one just hit the market in your target area"

5. Click **"Send to Channel"**
6. The modal shows a success confirmation with a link to the Slack message
7. The delivery is logged in Admin > Send to Slack > History

### From Step 5 (Build Full Report Dialog)

1. After completing Step 5 (Validate the Deal), click **"Build Full Report"**
2. The report generates. In the success dialog, you'll see a **"Send to Slack Channel"** button
3. Click it — the same Send to Slack modal opens, pre-filled with the report data
4. Follow steps 4-7 above

### What the Client Sees in Slack

The Slack message contains:

- **Your custom message** (if you wrote one) — appears first, in plain text
- **AI Deal Summary** — the Gemini-generated pitch, formatted as a quote block
- **Full Report link** — clickable link to the Validate the Deal page, pre-filled with the property address and bedroom/bathroom count
- **Zillow link** — direct search link for the property on Zillow
- **Redfin link** — direct search link for the property on Redfin
- **Footer** — "Sent by Coach Inayah's Turnkey Tool"

---

## Admin Panel Features

### Send to Slack Tab

Located in the Admin panel, the Send to Slack tab has three sub-tabs:

**Send Report** — Pick an existing report from a dropdown (shows all shared reports and universal shareable reports), search for a channel, generate the AI summary, and send. This is the same as clicking the button on the report page, but lets you send older reports without navigating to them.

**Batch Send** — Send the same report to multiple channels at once. Select a report, search and select multiple channels (they appear as tags), generate the AI summary, and click "Send to All Channels." The system sends to each channel with a 500ms delay to avoid rate limits. After sending, you see a results table showing which channels succeeded and which failed.

**History** — View every Slack delivery you've ever made. The table shows:
- Date and time
- Channel name
- Property address
- Report type (Shared Report or Universal Report)
- Status (Sent or Failed)
- Message permalink (clickable link to the Slack message)

The History tab also shows summary stats at the top: total deliveries, successful sends, failed sends, unique channels reached, and unique reports sent. You can filter by channel, status, or search by address.

---

## Strategic Roadmap: What Else to Build

Based on your deal pipeline — where you find opportunities, package them as data reports, and deliver them to clients via Slack for approval — here are the features that would add the most value, ordered by impact.

### Tier 1: High Impact

**Deal Status Tracking.** After you send a deal to a client's channel, track what happens next. Add Slack reaction-based responses: the client reacts with a checkmark to accept the deal, an X to pass, or a question mark to request more info. The system watches for these reactions and updates a deal pipeline in your admin panel. You would see a kanban-style board showing deals as Sent, Viewed, Interested, Accepted, or Passed. This gives you visibility into which clients are engaging and which deals are converting.

**Client Preferences Profile.** Store each client's investment criteria in the database: target markets (cities/states), budget range, minimum revenue threshold, preferred bedroom count, maximum distance from a specific location. When you look at a report, the system suggests which clients to send it to based on matching criteria. This saves you from manually remembering who wants what.

**Scheduled Deal Drops.** Instead of sending deals one at a time throughout the week, queue up 3-5 deals and schedule them to drop at a specific time (e.g., every Tuesday at 10am). The client gets a "Deal Drop" message with all properties in one clean summary. This creates anticipation and a routine — clients start expecting their Tuesday deals.

### Tier 2: Medium Impact

**Market Alert Bot.** Set up automated monitoring for specific markets. When AirDNA data shows a significant change (revenue spike, new high-performing comp, occupancy trend shift), the system posts an alert to the relevant client channels. This positions you as proactive — clients see you're watching the market for them without you having to manually check.

**Report Read Receipts.** Track when a client actually opens the report link. When they click "View Full Report" from the Slack message, log the click with timestamp. Show this in your admin panel so you know which clients are engaged and which ones need a follow-up nudge.

**Multi-Property Comparison Packages.** Bundle 3-5 properties into a single "Investment Package" that compares them side-by-side. Send the package to a client's channel with a summary like "Here are 4 properties in the Atlanta market, ranging from $45k-$85k annual revenue." This is more compelling than individual deals because it shows breadth and gives the client options.

### Tier 3: Advanced

**CRM-to-Slack Bridge.** Connect HubSpot lead data to the Slack pipeline. When a new lead comes in through HubSpot, auto-create their Slack channel, send a welcome message, and pre-populate their preferences from the HubSpot form data. When you send a deal via Slack, log the activity back to HubSpot so your CRM stays in sync. This eliminates the manual step of creating channels and ensures every lead gets the same onboarding experience.

**AI Deal Scoring.** Before you send a deal, the AI scores it against the client's preferences and market benchmarks. A deal that's in the client's target market, within budget, and above-average revenue gets a high score. You see the score in the admin panel and can prioritize which deals to send first. The score is your internal tool for efficiency — it is NOT shown to the client.

**Client Dashboard.** Give each client a login to the tool where they can see all deals you've sent them, their response history, and saved favorites. The Slack channel becomes the notification layer, and the app becomes the reference layer. Clients can go back and review deals they passed on, compare properties, and track their pipeline.

---

## Troubleshooting

### "Send to Slack button doesn't appear on the report page"

The button only shows for admin users. Make sure you are logged in with an admin account. Your user role in the database must be set to `admin`. Check the `users` table in the database — the `role` column must say `admin`.

### "Channel search returns no results"

The Slack MCP connection may need to be re-authenticated. Try searching for a common channel name like "general." If that returns nothing, the MCP OAuth token may have expired. Re-authenticate the Slack MCP connection.

### "Bot says 'not_in_channel' when sending to a private channel"

The bot needs to be invited to private channels before it can post. In Slack, go to the private channel, type `/invite @Coach Inayah Turnkey Bot`, and try again. Public channels work without an invite.

### "Delivery history shows 'failed' status"

Click on the failed delivery to see the error message. Common causes: channel was deleted, bot was removed from the channel, or Slack API rate limit was hit. For rate limits, the batch send feature adds a 500ms delay between sends, but if you're sending to 20+ channels, some may fail. Re-send the failed ones individually from the Send Report tab.

### "AI summary doesn't generate"

The Gemini API may be temporarily unavailable. Wait 30 seconds and try again. If it continues to fail, check the Gemini API key in the admin settings. You can also skip the AI summary and write your own message in the custom message field.

---

## Quick Reference

| What | Where |
|------|-------|
| Send from report | Report page header > "Send to Slack" button (admin only) |
| Send from Step 5 | Build Full Report dialog > "Send to Slack Channel" button |
| Send older reports | Admin panel > Send to Slack tab > Send Report |
| Batch send | Admin panel > Send to Slack tab > Batch Send |
| Delivery history | Admin panel > Send to Slack tab > History |
| Invite bot to private channel | In Slack: `/invite @Coach Inayah Turnkey Bot` |
