# Deal Alert Email System - Complete Workflow

## Overview

This document explains how deal alert emails work end-to-end, from finding a deal to the email landing in a lead's inbox.

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. DEAL FOUND                                                              │
│     Our system identifies a property matching lead criteria                 │
│                                                                             │
│                              ↓                                              │
│                                                                             │
│  2. UPDATE HUBSPOT CONTACT                                                  │
│     API call updates contact properties with deal data                      │
│     Sets deal_alert_trigger = "send"                                        │
│                                                                             │
│                              ↓                                              │
│                                                                             │
│  3. HUBSPOT WORKFLOW TRIGGERS                                               │
│     Workflow detects: deal_alert_trigger = "send"                           │
│     Sends transactional email using contact properties                      │
│                                                                             │
│                              ↓                                              │
│                                                                             │
│  4. EMAIL DELIVERED                                                         │
│     Lead receives personalized deal alert with all property data            │
│     HubSpot tracks opens, clicks, engagement                                │
│                                                                             │
│                              ↓                                              │
│                                                                             │
│  5. WORKFLOW RESETS TRIGGER                                                 │
│     Sets deal_alert_trigger = "" (empty)                                    │
│     Ready for next deal alert                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Required HubSpot Contact Properties

Create these properties in HubSpot: **Settings → Data Management → Properties → Create property**

| Property Name | Type | Group | Description |
|--------------|------|-------|-------------|
| `deal_property_address` | Single-line text | Deal Alert | Street address of the property |
| `deal_city` | Single-line text | Deal Alert | City name |
| `deal_state` | Single-line text | Deal Alert | State abbreviation (CO, TX, etc.) |
| `deal_bedrooms` | Number | Deal Alert | Number of bedrooms |
| `deal_bathrooms` | Number | Deal Alert | Number of bathrooms |
| `deal_monthly_revenue` | Number | Deal Alert | Estimated monthly STR revenue |
| `deal_monthly_rent` | Number | Deal Alert | Monthly rent cost |
| `deal_monthly_profit` | Number | Deal Alert | Revenue minus rent |
| `deal_occupancy` | Number | Deal Alert | Market occupancy rate (0-100) |
| `deal_analysis_url` | Single-line text | Deal Alert | Link to full analysis on our tool |
| `deal_ai_narration` | Multi-line text | Deal Alert | AI-generated personalized message |
| `deal_comp1_title` | Single-line text | Deal Alert | Comparable property 1 name |
| `deal_comp1_revenue` | Number | Deal Alert | Comp 1 monthly revenue |
| `deal_comp1_occupancy` | Number | Deal Alert | Comp 1 occupancy rate |
| `deal_comp2_title` | Single-line text | Deal Alert | Comparable property 2 name |
| `deal_comp2_revenue` | Number | Deal Alert | Comp 2 monthly revenue |
| `deal_comp2_occupancy` | Number | Deal Alert | Comp 2 occupancy rate |
| `deal_comp3_title` | Single-line text | Deal Alert | Comparable property 3 name |
| `deal_comp3_revenue` | Number | Deal Alert | Comp 3 monthly revenue |
| `deal_comp3_occupancy` | Number | Deal Alert | Comp 3 occupancy rate |
| `deal_alert_trigger` | Single-line text | Deal Alert | Workflow trigger ("send" or empty) |

---

## Step 2: Create the HubSpot Workflow

1. Go to **Automation → Workflows → Create workflow**
2. Choose **Contact-based** workflow
3. Set enrollment trigger:
   - **Property**: `deal_alert_trigger`
   - **Condition**: is equal to `send`

4. Add actions:
   - **Send email**: Select your Deal Alert transactional email
   - **Set property value**: Set `deal_alert_trigger` to empty (clears the trigger)

5. Settings:
   - Allow re-enrollment: **Yes** (so same contact can receive multiple alerts)
   - Unenrollment: None needed

---

## Step 3: Create the Transactional Email

1. Go to **Marketing → Email → Create email**
2. Choose **Automated** or **Transactional** email type
3. Use the HTML template from `docs/hubspot-deal-alert-template-v2.html`
4. The template uses HubL tokens like `{{ contact.deal_property_address }}`

### Key HubL Tokens Used

```hubl
{{ contact.firstname }}           → Lead's first name
{{ contact.deal_property_address }} → Property street address
{{ contact.deal_city }}           → City
{{ contact.deal_state }}          → State
{{ contact.deal_bedrooms }}       → Bedrooms
{{ contact.deal_bathrooms }}      → Bathrooms
{{ contact.deal_monthly_revenue }} → $8,500
{{ contact.deal_monthly_rent }}   → $5,653
{{ contact.deal_monthly_profit }} → $2,847
{{ contact.deal_occupancy }}      → 73
{{ contact.deal_analysis_url }}   → Link to our tool
{{ contact.deal_ai_narration }}   → Personalized AI message
{{ contact.deal_comp1_title }}    → "Downtown Luxury Loft"
{{ contact.deal_comp1_revenue }}  → 9746
{{ contact.deal_comp1_occupancy }} → 66
```

---

## Step 4: Our Code - Triggering the Email

When our system finds a deal, we call the HubSpot API:

```typescript
// Update contact with deal data and trigger the workflow
async function sendDealAlert(contactId: string, dealData: DealData) {
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          // Property details
          deal_property_address: dealData.address,
          deal_city: dealData.city,
          deal_state: dealData.state,
          deal_bedrooms: String(dealData.bedrooms),
          deal_bathrooms: String(dealData.bathrooms),
          
          // Financial data
          deal_monthly_revenue: String(dealData.monthlyRevenue),
          deal_monthly_rent: String(dealData.monthlyRent),
          deal_monthly_profit: String(dealData.monthlyProfit),
          deal_occupancy: String(dealData.occupancy),
          
          // Links and content
          deal_analysis_url: dealData.analysisUrl,
          deal_ai_narration: dealData.aiNarration,
          
          // Comparable properties
          deal_comp1_title: dealData.comps[0]?.title || '',
          deal_comp1_revenue: String(dealData.comps[0]?.revenue || ''),
          deal_comp1_occupancy: String(dealData.comps[0]?.occupancy || ''),
          deal_comp2_title: dealData.comps[1]?.title || '',
          deal_comp2_revenue: String(dealData.comps[1]?.revenue || ''),
          deal_comp2_occupancy: String(dealData.comps[1]?.occupancy || ''),
          deal_comp3_title: dealData.comps[2]?.title || '',
          deal_comp3_revenue: String(dealData.comps[2]?.revenue || ''),
          deal_comp3_occupancy: String(dealData.comps[2]?.occupancy || ''),
          
          // TRIGGER THE WORKFLOW
          deal_alert_trigger: 'send'
        }
      })
    }
  );
  
  return response.ok;
}
```

---

## Example: Complete Data Flow

### 1. Deal Found
Our system finds a property at 1321 15th St, Denver, CO that matches Bryson's criteria.

### 2. API Call Made
```json
PATCH https://api.hubapi.com/crm/v3/objects/contacts/188790399316

{
  "properties": {
    "deal_property_address": "1321 15th St",
    "deal_city": "Denver",
    "deal_state": "CO",
    "deal_bedrooms": "3",
    "deal_bathrooms": "2",
    "deal_monthly_revenue": "8500",
    "deal_monthly_rent": "5653",
    "deal_monthly_profit": "2847",
    "deal_occupancy": "73",
    "deal_analysis_url": "https://coachinayahturnkeytool.com?step=5&address=1321%2015th%20St...",
    "deal_ai_narration": "I just came across a property in Denver that caught my attention...",
    "deal_comp1_title": "Downtown Luxury Loft",
    "deal_comp1_revenue": "9746",
    "deal_comp1_occupancy": "66",
    "deal_comp2_title": "Modern City Townhome",
    "deal_comp2_revenue": "5973",
    "deal_comp2_occupancy": "71",
    "deal_comp3_title": "Spacious Urban Retreat",
    "deal_comp3_revenue": "5093",
    "deal_comp3_occupancy": "88",
    "deal_alert_trigger": "send"
  }
}
```

### 3. HubSpot Workflow Triggers
- Detects `deal_alert_trigger = "send"`
- Sends the transactional email
- Resets `deal_alert_trigger` to empty

### 4. Email Received
Bryson receives an email with:
- Subject: "New Denver opportunity – $2,847/mo profit potential"
- All the property data filled in
- Personalized AI narration
- Comparable properties showing proof
- CTA to book a call

---

## Testing the System

### From Admin Dashboard
1. Go to Newsletter Admin → Deal Alerts
2. Use "Quick Test Deal Alert" with an email address
3. Check HubSpot contact to verify properties updated
4. Check inbox for the email

### From API/Code
```bash
# Update a test contact and trigger email
curl -X PATCH "https://api.hubapi.com/crm/v3/objects/contacts/YOUR_CONTACT_ID" \
  -H "Authorization: Bearer YOUR_HUBSPOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "deal_property_address": "123 Test St",
      "deal_city": "Denver",
      "deal_state": "CO",
      "deal_monthly_revenue": "8500",
      "deal_monthly_rent": "5000",
      "deal_monthly_profit": "3500",
      "deal_occupancy": "75",
      "deal_alert_trigger": "send"
    }
  }'
```

---

## Troubleshooting

### Email not sending?
1. Check HubSpot workflow is active
2. Verify `deal_alert_trigger` was set to "send"
3. Check workflow history for errors
4. Ensure contact is not suppressed/unsubscribed

### Data not showing in email?
1. Verify contact properties exist in HubSpot
2. Check property names match exactly (case-sensitive)
3. Use HubSpot email preview with a test contact

### Workflow not triggering?
1. Ensure re-enrollment is enabled
2. Check enrollment trigger is `deal_alert_trigger is equal to send`
3. Verify the property was actually updated (check contact record)

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/hubspot-deal-alert-template-v2.html` | Complete HTML email template with HubL tokens |
| `server/newsletter-email-sender.ts` | Contains `sendDealAlertWithTemplate()` function |
| `server/newsletter-router.ts` | API endpoints for sending deal alerts |
| `scripts/create-deal-alert-properties.mjs` | Script to create HubSpot properties |
