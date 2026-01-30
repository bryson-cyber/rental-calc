# HubSpot Integration Architecture for Rental Calculator

## Executive Summary

This document outlines how to integrate HubSpot with the Rental Calculator tool to enable automated, personalized lead engagement. The integration leverages HubSpot's APIs for transactional emails, webhooks, workflows, and CRM data to create an "ultra-personalized" experience for leads.

---

## What's Possible with HubSpot API

### 1. Automated Personalized Emails

**Transactional Email API (Single-Send)**
- Send personalized emails programmatically via JSON POST request
- Include dynamic content using contact properties (city, address, name)
- Auto-populate personalized links to their specific market
- Track opens, clicks, and engagement automatically
- Emails automatically associated with contact records

**Example Use Case:**
When a lead uses the rental calculator for "Austin, TX", automatically send them:
- Their personalized report via email
- A link like: `coachinayahturnkeytool.com/?city=Austin&state=TX`
- Follow-up emails with updated market data

### 2. Real-Time Webhooks

**Contact Property Change Notifications**
- Get notified instantly when a lead's city or address changes in HubSpot
- Trigger new personalized content based on their updated market interest
- Subscription types: `contact.creation`, `contact.propertyChange`

**Your App → HubSpot (Workflow Webhooks)**
- When lead uses your tool, POST data to HubSpot workflow
- Update contact properties with their search history
- Trigger automated email sequences based on tool usage

### 3. Workflow Automation

**HubSpot Workflows can:**
- Trigger emails when contacts are added to specific lists
- Send webhooks to your app when contact data changes
- Delay actions (e.g., send follow-up 3 days after report)
- Branch logic based on contact properties

### 4. Zapier Integration (No-Code Option)

**Available Triggers:**
- New contact created in HubSpot
- Contact added to list
- Contact property updated

**Available Actions:**
- Send email via Gmail/Outlook
- Send SMS via Twilio
- Update Google Sheets
- Trigger custom webhooks

---

## Recommended Implementation Architecture

### Option A: Direct API Integration (Most Powerful)

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENTAL CALCULATOR APP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Lead uses tool → Captures city, address, email              │
│                           │                                     │
│                           ▼                                     │
│  2. App calls HubSpot Contacts API                              │
│     - Create/update contact with properties:                    │
│       • city, state, address                                    │
│       • last_tool_used, last_search_date                        │
│       • report_url (personalized link)                          │
│                           │                                     │
│                           ▼                                     │
│  3. App calls Transactional Email API                           │
│     - Send personalized report email                            │
│     - Include dynamic link: /?city={{city}}&state={{state}}     │
│                           │                                     │
│                           ▼                                     │
│  4. HubSpot tracks engagement                                   │
│     - Opens, clicks, conversions                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Required HubSpot APIs:**
- Contacts API (create/update contacts)
- Transactional Email API (send personalized emails)
- Custom Properties (store tool usage data)

### Option B: Webhook + Workflow Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  RENTAL CALCULATOR APP          HUBSPOT WORKFLOWS               │
│  ────────────────────          ──────────────────               │
│                                                                 │
│  Lead uses tool ──────────────► Webhook receives data           │
│       │                              │                          │
│       │                              ▼                          │
│       │                         Update contact properties       │
│       │                              │                          │
│       │                              ▼                          │
│       │                         Trigger email sequence          │
│       │                              │                          │
│       │                              ▼                          │
│       │                         Add to nurture list             │
│       │                                                         │
│       │         ◄──────────────  Webhook notifies app           │
│       │         (when lead opens email or clicks link)          │
│       ▼                                                         │
│  Show personalized content based on engagement                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Option C: Zapier (No-Code, Quick Setup)

```
TRIGGER: Lead submits form on Rental Calculator
    │
    ▼
ACTION 1: Create/Update HubSpot Contact
    │
    ▼
ACTION 2: Add to HubSpot List "Tool Users - {{city}}"
    │
    ▼
ACTION 3: Send personalized email via Gmail/SendGrid
    │
    ▼
ACTION 4: Log to Google Sheets for tracking
```

---

## Specific Features You Asked About

### 1. "Send report to email and phone"

**Email:** Use Transactional Email API
```javascript
// Example API call
POST /marketing/v3/transactional/single-email/send
{
  "emailId": 12345678,  // Your email template ID
  "message": {
    "to": "lead@example.com"
  },
  "contactProperties": {
    "firstname": "John",
    "city": "Austin",
    "state": "TX"
  },
  "customProperties": {
    "report_link": "https://coachinayahturnkeytool.com/?city=Austin&state=TX",
    "annual_revenue": "$128,000"
  }
}
```

**Phone (SMS):** HubSpot doesn't have native SMS API, but you can:
- Use Zapier to trigger Twilio SMS
- Use HubSpot's SMS add-on (requires Marketing Hub Enterprise)
- Build custom integration with Twilio API

### 2. "Hospitable earning report emailed and updated"

**Option A: Scheduled Reports**
- Create a HubSpot workflow that runs weekly/monthly
- Workflow triggers webhook to your app
- Your app generates fresh report
- Send via Transactional Email API

**Option B: Real-Time Updates**
- Store report data in HubSpot custom properties
- When data changes, trigger workflow
- Workflow sends updated email automatically

### 3. "Auto-populated links to their city"

**In Email Templates:**
```html
<a href="https://coachinayahturnkeytool.com/?city={{contact.city}}&state={{contact.state}}">
  Check properties in {{contact.city}}, {{contact.state}}
</a>
```

**Custom Properties to Create in HubSpot:**
| Property Name | Type | Description |
|---------------|------|-------------|
| `target_city` | Text | Lead's target market city |
| `target_state` | Text | Lead's target market state |
| `last_tool_used` | Text | Which tool they last used |
| `last_search_date` | Date | When they last searched |
| `personalized_link` | Text | Pre-built URL for their market |
| `annual_revenue_estimate` | Number | Their estimated revenue |
| `occupancy_rate` | Number | Market occupancy rate |

---

## Implementation Roadmap

### Phase 1: Basic Integration (1-2 days)
1. Create HubSpot private app with API access
2. Add custom contact properties for tool data
3. Update rental calculator to POST lead data to HubSpot
4. Create email template with personalization tokens

### Phase 2: Automated Emails (2-3 days)
1. Set up Transactional Email API
2. Create email templates for each tool:
   - Property Report Email
   - Market Analysis Email
   - Regulation Check Email
3. Trigger emails automatically when leads use tools

### Phase 3: Advanced Personalization (3-5 days)
1. Set up HubSpot workflows for nurture sequences
2. Create webhook endpoints in your app
3. Build two-way sync (HubSpot ↔ App)
4. Add SMS notifications via Twilio

### Phase 4: Analytics & Optimization (Ongoing)
1. Track email engagement in HubSpot
2. A/B test email templates
3. Optimize based on conversion data

---

## Required HubSpot Subscription

| Feature | Required Plan |
|---------|---------------|
| Contacts API | Free |
| Custom Properties | Free |
| Transactional Email | Marketing Hub Professional + Add-on |
| Workflows | Marketing Hub Professional |
| Webhooks (incoming) | Operations Hub Professional |
| Zapier Integration | Free (limited) / Starter |

---

## Code Examples

### Create/Update Contact with Custom Properties

```javascript
// server/hubspot.ts
import axios from 'axios';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

export async function upsertContact(data: {
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  toolUsed: string;
  reportLink: string;
}) {
  const response = await axios.post(
    'https://api.hubapi.com/crm/v3/objects/contacts',
    {
      properties: {
        email: data.email,
        firstname: data.firstName,
        lastname: data.lastName,
        city: data.city,
        state: data.state,
        target_city: data.city,
        target_state: data.state,
        last_tool_used: data.toolUsed,
        last_search_date: new Date().toISOString(),
        personalized_link: data.reportLink,
      }
    },
    {
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

### Send Transactional Email

```javascript
export async function sendReportEmail(data: {
  email: string;
  templateId: number;
  city: string;
  state: string;
  annualRevenue: number;
}) {
  const response = await axios.post(
    'https://api.hubapi.com/marketing/v3/transactional/single-email/send',
    {
      emailId: data.templateId,
      message: {
        to: data.email
      },
      customProperties: {
        city: data.city,
        state: data.state,
        annual_revenue: `$${data.annualRevenue.toLocaleString()}`,
        report_link: `https://coachinayahturnkeytool.com/?city=${encodeURIComponent(data.city)}&state=${encodeURIComponent(data.state)}`
      }
    },
    {
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

---

## Summary

**Yes, you can absolutely do what you're describing!** Here's the quick answer:

| Your Question | Answer |
|---------------|--------|
| Automated emails? | ✅ Yes - Transactional Email API |
| Notifications? | ✅ Yes - Webhooks + Workflows |
| Zapier? | ✅ Yes - 8,000+ app integrations |
| Report to email? | ✅ Yes - Single-Send API |
| Report to phone? | ✅ Yes - Via Twilio/Zapier |
| Auto-populated links? | ✅ Yes - Personalization tokens |
| Updated reports? | ✅ Yes - Scheduled workflows |
| Ultra personalization? | ✅ Yes - Custom properties + dynamic content |

The key is setting up custom contact properties in HubSpot to store the lead's market data, then using those properties in email templates and personalized links.
