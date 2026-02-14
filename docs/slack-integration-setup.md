# Slack Integration Setup Guide

**Coach Inayah's Turnkey Tool — Slack Property Analysis Bot**

This document walks through every step required to connect your Slack workspace to the Turnkey Tool so that (A) anyone in a Slack channel can type a property address and get an instant revenue estimate posted back, and (B) you can send existing property reports directly to client channels from the admin panel.

---

## Table of Contents

1. [Overview: What the Integration Does](#1-overview-what-the-integration-does)
2. [Prerequisites](#2-prerequisites)
3. [Part 1: Create a Slack App](#3-part-1-create-a-slack-app)
4. [Part 2: Add the Slash Command](#4-part-2-add-the-slash-command)
5. [Part 3: Set Up an Incoming Webhook](#5-part-3-set-up-an-incoming-webhook)
6. [Part 4: Install the App to Your Workspace](#6-part-4-install-the-app-to-your-workspace)
7. [Part 5: Configure the SLACK_WEBHOOK_URL Secret](#7-part-5-configure-the-slack_webhook_url-secret)
8. [Part 6: Set Up Slack Workflow Builder (Optional)](#8-part-6-set-up-slack-workflow-builder-optional)
9. [Part 7: Test the Integration](#9-part-7-test-the-integration)
10. [Part 8: Using the Admin "Send to Slack" Panel](#10-part-8-using-the-admin-send-to-slack-panel)
11. [Endpoint Reference](#11-endpoint-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview: What the Integration Does

The Slack integration has two independent capabilities:

| Capability | Who Uses It | How It Works |
|---|---|---|
| **Slash Command** (`/analyze`) | Anyone in your Slack workspace | User types `/analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA` in any channel. The bot parses the address, calls AirDNA for revenue data, and posts a formatted estimate back to that same channel within 5–15 seconds. |
| **Admin Send to Slack** | Admin users only (via the web dashboard) | From the admin panel, you select an existing property report, pick one or more Slack channels, and the system generates an AI deal summary (via Gemini) and posts the report link, Zillow link, Redfin link, and deal pitch to those channels. |

The slash command posts results back to the **same channel** the command was typed in. The admin feature can post to **any channel** in the workspace.

---

## 2. Prerequisites

Before you begin, confirm you have the following:

| Requirement | Where to Get It |
|---|---|
| **Slack workspace admin access** | You must be an admin or owner of the `coachinayah.slack.com` workspace. If you are not, ask the workspace admin to create the app for you. |
| **Deployed Turnkey Tool** | The app must be published and accessible at `https://coachinayahturnkeytool.com`. The slash command will not work with a localhost URL. |
| **Admin account on the Turnkey Tool** | You need an admin-role account to access the "Send to Slack" panel. |

---

## 3. Part 1: Create a Slack App

If you already have a Slack App for this workspace, skip to Part 2.

**Step 1.** Open your browser and go to: **https://api.slack.com/apps**

**Step 2.** Click the green **"Create New App"** button in the top-right corner.

**Step 3.** A modal will appear. Select **"From scratch"** (not "From an app manifest").

**Step 4.** Fill in the form:
- **App Name:** Type exactly `Coach Inayah Revenue Bot`
- **Pick a workspace to develop your app in:** Select `Coach Inayah` from the dropdown

**Step 5.** Click **"Create App"**. You will be taken to the app's settings page. Keep this page open — you will need it for the next steps.

---

## 4. Part 2: Add the Slash Command

This creates the `/analyze` command that users type in Slack channels.

**Step 1.** On the left sidebar of your Slack App settings page, click **"Slash Commands"**.

**Step 2.** Click the **"Create New Command"** button.

**Step 3.** Fill in the form with these exact values:

| Field | Value |
|---|---|
| **Command** | `/analyze` |
| **Request URL** | `https://coachinayahturnkeytool.com/api/slack/analyze` |
| **Short Description** | `Analyze a property's rental revenue potential` |
| **Usage Hint** | `[address] [bedrooms]BR [bathrooms]BA` |
| **Escape channels, users, and links sent to your app** | Leave this **unchecked** |

**Step 4.** Click **"Save"** at the bottom-right of the form.

You will see a yellow banner at the top of the page saying "You've changed the permission scopes your app uses. Please reinstall your app for these changes to take effect." Do **not** reinstall yet — we will do that in Part 4 after adding the webhook.

---

## 5. Part 3: Set Up an Incoming Webhook

The Incoming Webhook is a fallback URL that allows the server to post messages to a default channel. The slash command uses Slack's built-in `response_url` to reply to the originating channel, but the webhook is needed for error fallback and for the Workflow Builder integration.

**Step 1.** On the left sidebar, click **"Incoming Webhooks"**.

**Step 2.** At the top of the page, you will see a toggle switch labeled **"Activate Incoming Webhooks"**. Click it to turn it **ON** (the toggle turns green).

**Step 3.** Scroll down to the bottom of the page. Click **"Add New Webhook to Workspace"**.

**Step 4.** Slack will ask you to pick a channel. Select the channel where you want fallback messages to go. A good choice is `#app-to-slack-migration` or `#general`. Click **"Allow"**.

**Step 5.** You will be redirected back to the Incoming Webhooks page. Scroll down to the **"Webhook URLs for Your Workspace"** section. You will see a URL that looks like this:

```
https://hooks.slack.com/services/T04XXXXXXXX/B08XXXXXXXX/xxxxxxxxxxxxxxxxxxxxxxxx
```

**Step 6.** Click the **"Copy"** button next to the webhook URL. Save this URL — you will need it in Part 5.

---

## 6. Part 4: Install the App to Your Workspace

**Step 1.** On the left sidebar, click **"Install App"** (under the "Settings" section).

**Step 2.** Click the **"Install to Workspace"** button (or **"Reinstall to Workspace"** if you previously installed it).

**Step 3.** Slack will show a permissions screen listing what the app can do. Review it and click **"Allow"**.

**Step 4.** You will be redirected back to the app settings page. The app is now installed.

**Step 5. (Critical)** You must **invite the bot to every channel** where you want it to post. Go to each Slack channel and type:

```
/invite @Coach Inayah Revenue Bot
```

If the bot name does not appear in autocomplete, type `/invite` and then search for the app name. The bot must be a member of a channel before it can post messages there.

---

## 7. Part 5: Configure the SLACK_WEBHOOK_URL Secret

The webhook URL you copied in Part 3 needs to be added to the Turnkey Tool's environment.

**Step 1.** Go to the Turnkey Tool's Management UI in Manus.

**Step 2.** Click **"Settings"** in the left sidebar, then click **"Secrets"**.

**Step 3.** Look for a secret named `SLACK_WEBHOOK_URL`. If it exists, click the edit icon and paste the webhook URL. If it does not exist, ask the developer to add it via `webdev_request_secrets`.

**Step 4.** After saving the secret, the app will automatically restart and pick up the new value.

The webhook URL is used as a fallback posting mechanism. The primary mechanism (for slash commands) is the `response_url` that Slack sends with every slash command invocation, which posts directly back to the channel where the command was typed.

---

## 8. Part 6: Set Up Slack Workflow Builder (Optional)

The Workflow Builder provides an alternative way to trigger analyses — through a form or automated trigger instead of a slash command. This is optional.

**Step 1.** In Slack, click on your workspace name in the top-left corner, then click **"Tools & settings"** → **"Workflow Builder"**.

**Step 2.** Click **"Create Workflow"** in the top-right corner.

**Step 3.** Name the workflow: `Property Revenue Analysis`

**Step 4.** Choose a trigger. You have two options:

| Trigger Type | When to Use |
|---|---|
| **Shortcut** | Users click a shortcut button in the channel to open a form |
| **New message in channel** | Automatically triggers when someone posts a message containing a keyword (e.g., "analyze") |

For the **Shortcut** trigger:

- Select **"Shortcut"** as the trigger
- Name it: `Analyze Property`
- Add a form step with one text field:
  - **Label:** `Property Address`
  - **Placeholder:** `123 Main St, Atlanta, GA 30301, 3BR 2BA`

For the **New message** trigger:

- Select **"New message in channel"** as the trigger
- Choose the channel(s) to monitor
- Optionally add a filter for messages containing "analyze"

**Step 5.** Add a **"Send a webhook"** step after the trigger:

- Click **"Add Step"** → search for **"Send a webhook"**
- Set the URL to: `https://coachinayahturnkeytool.com/api/slack/analyze`
- Set the method to: **POST**
- Set the body to:

```json
{
  "text": "{{form_response or message_text}}",
  "response_url": "{{workflow_webhook_url}}"
}
```

Replace `{{form_response or message_text}}` with the actual variable from your trigger (the Workflow Builder will show you available variables to insert).

**Step 6.** Click **"Publish"** to activate the workflow.

---

## 9. Part 7: Test the Integration

### Test the Slash Command

**Step 1.** Open any Slack channel where the bot has been invited (see Part 4, Step 5).

**Step 2.** Type the following and press Enter:

```
/analyze 1622 Halliard Dr, Lawrenceville, GA 30043, 4BR 3BA
```

**Step 3.** You should immediately see a message from the bot saying: *"Analyzing property... Results will appear here shortly."*

**Step 4.** Within 5–15 seconds, a formatted revenue estimate will appear in the channel with:
- Annual revenue, monthly revenue, average daily rate, occupancy rate
- Best and worst months for seasonality
- Zillow and Redfin search links
- A "Validate This Deal" link that opens the Turnkey Tool pre-filled with the property

### Test the Admin Panel

**Step 1.** Log in to the Turnkey Tool at `https://coachinayahturnkeytool.com` with your admin account.

**Step 2.** Navigate to the Admin dashboard (gear icon or `/admin` URL).

**Step 3.** Click the **"Send to Slack"** tab.

**Step 4.** In the **"Send Report"** sub-tab:
- Search for a channel by typing in the channel search box
- Select a report from the dropdown (these are your existing Step 5 and Universal reports)
- Click **"Generate AI Summary"** — Gemini will write a deal pitch
- Optionally add a custom message
- Click **"Send to Slack"**

**Step 5.** Check the Slack channel — you should see the report link, deal summary, and Zillow/Redfin links.

---

## 10. Part 8: Using the Admin "Send to Slack" Panel

The admin panel has three sub-tabs:

### Send Report (Single Channel)

This is for sending one report to one client channel.

| Step | Action |
|---|---|
| 1 | Type a channel name in the search box. The system searches your entire Slack workspace in real-time. |
| 2 | Click on a channel from the results to select it. |
| 3 | Select a report from the "Select Report" dropdown. Reports are sorted by most recent. You can search by address. |
| 4 | Click **"Generate AI Summary"**. Gemini will write a 3–5 sentence deal pitch based on the report data (revenue, occupancy, ADR, verdict). |
| 5 | Edit the summary if you want to customize it. |
| 6 | Optionally type a custom message in the "Custom Message" box. This appears above the deal summary. |
| 7 | Click **"Send to Slack"**. |

The posted message includes:
- Your custom message (if any)
- The AI-generated deal summary
- A **"View Full Report"** link to the property report
- **Zillow** and **Redfin** search links for the property
- A "Sent by Coach Inayah's Turnkey Tool" footer

### Batch Send (Multiple Channels)

This is for sending the same report to multiple client channels at once.

| Step | Action |
|---|---|
| 1 | Search and select multiple channels. Each selected channel appears as a tag. Click the X on a tag to remove it. |
| 2 | Select a report and generate the AI summary (same as single send). |
| 3 | Click **"Send to All Channels"**. |
| 4 | A results panel appears showing which channels succeeded and which failed. |

The system sends to each channel sequentially with a 500ms delay between sends to avoid Slack rate limits. Each delivery is tracked individually in the database.

### History

This tab shows every report delivery you have made, with:
- **Stats cards** at the top: Total Sent, Failed, Unique Channels, Unique Reports
- **Filter options**: filter by status (sent/failed) or search by address
- **Delivery list**: each entry shows the channel, address, report type, status, timestamp, and a link to the Slack message

---

## 11. Endpoint Reference

### `POST /api/slack/analyze`

This is the main endpoint that receives property analysis requests.

**Accepts two content types:**

| Content Type | Source |
|---|---|
| `application/json` | Slack Workflow Builder |
| `application/x-www-form-urlencoded` | Slack Slash Commands |

**Request body fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | The property address and details. Example: `"123 Main St, Atlanta, GA 30301, 3BR 2BA"` |
| `response_url` | string | No | Slack-provided URL for posting results back to the originating channel. Slash commands and Workflow Builder both provide this automatically. |
| `channel_id` | string | No | The Slack channel ID where the command was typed. Provided automatically by Slack. |
| `user_id` | string | No | The Slack user ID who typed the command. Provided automatically by Slack. |
| `command` | string | No | The slash command name (e.g., `/analyze`). Present only for slash commands. |

**Response:** Returns `200 OK` immediately. Results are posted asynchronously to the `response_url`.

**For slash commands**, the immediate response is:

```json
{
  "response_type": "in_channel",
  "text": "Analyzing property... Results will appear here shortly."
}
```

**For Workflow Builder**, the immediate response is:

```json
{
  "ok": true,
  "message": "Analysis started. Results will be posted to Slack shortly."
}
```

**The async pipeline:**
1. Parses the natural language input using Gemini LLM
2. Calls AirDNA Rentalizer API for revenue data
3. Formats results into Slack Block Kit message (revenue, ADR, occupancy, seasonality, Zillow/Redfin links, Validate link)
4. Posts the formatted message back via the `response_url`

---

## 12. Troubleshooting

### "dispatch_failed" error when using the slash command

This means Slack could not reach your server. Verify that:
- The app is deployed and published (not just running locally)
- The Request URL in the slash command settings is exactly `https://coachinayahturnkeytool.com/api/slack/analyze`
- There are no typos in the URL

### Bot posts to the wrong channel or does not post at all

- The slash command always posts back to the channel where it was typed. If you do not see a response, check the Slack channel for error messages.
- Make sure the bot has been invited to the channel (type `/invite @Coach Inayah Revenue Bot` in the channel).

### "Bot is not in this channel" error in admin panel

When sending from the admin panel, the bot must be a member of the target channel. Go to that channel in Slack and type `/invite @Coach Inayah Revenue Bot`.

### Analysis takes too long or times out

The AirDNA API call typically takes 2–5 seconds. If it takes longer:
- The address may be in an area with limited data
- The AirDNA API may be experiencing high load
- Check the server logs for `[Slack]` prefixed messages

### Channel search returns no results in admin panel

The channel search uses the Slack API. If no results appear:
- Try a broader search term (e.g., just "client" instead of "client-john-atlanta")
- The Slack MCP connection may need to be re-authenticated

### The "Validate This Deal" link does not work

The link format is: `https://coachinayahturnkeytool.com/?tab=validate&address=ENCODED_ADDRESS&bedrooms=N&bathrooms=N`

If the link opens the homepage but does not pre-fill the Validate tab, check that the `tab=validate` query parameter is being read by the frontend router.

---

*Last updated: February 13, 2026*
