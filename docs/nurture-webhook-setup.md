# Nurture Email Automation Setup Guide

This guide explains how to set up automatic personalization for your 7-day webinar nurture email sequence. With this system, all market data is populated **once** when a contact registers, and your scheduled emails simply use the pre-populated data.

---

## How It Works

When someone registers for your webinar, a single webhook call fetches all market data from AirDNA and populates 53 personalization properties in HubSpot. Your 7 scheduled emails then use these properties as personalization tokens—no additional webhook calls needed.

| Step | What Happens |
|------|--------------|
| 1 | Contact submits webinar registration form |
| 2 | Zapier/HubSpot triggers the populate-all webhook |
| 3 | System fetches all AirDNA data for their city/state |
| 4 | 53 HubSpot properties are populated in ~5 seconds |
| 5 | Your 7 scheduled emails use these properties |

---

## Webhook Endpoint

**URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/populate-all`

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "contactId": "{{contact.hs_object_id}}"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "All nurture data prepared for Orlando, FL",
  "data": {
    "city": "Orlando",
    "state": "FL",
    "propertiesUpdated": 53
  }
}
```

---

## Setup Option 1: Zapier (Recommended)

### Step 1: Create a New Zap

1. Go to [zapier.com](https://zapier.com) and click "Create Zap"
2. Name it "Webinar Registration → Nurture Data"

### Step 2: Set Up Trigger

1. **App:** HubSpot
2. **Event:** New Contact
3. **Filter:** Only contacts where `data_perfection__city` is set (or your webinar list)

### Step 3: Add Webhook Action

1. **App:** Webhooks by Zapier
2. **Event:** POST
3. **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/populate-all`
4. **Payload Type:** JSON
5. **Data:**
   ```
   contactId: {{contact_id}}
   ```

### Step 4: Test & Enable

1. Test with a real contact that has city/state data
2. Verify the response shows `"success": true`
3. Turn on the Zap

---

## Setup Option 2: HubSpot Workflow

### Step 1: Create Workflow

1. Go to **Automation → Workflows**
2. Click **Create workflow** → **Contact-based**
3. Name it "Webinar Registration - Populate Nurture Data"

### Step 2: Set Enrollment Trigger

Choose one of these triggers:
- Contact joins list: "Webinar Registrants"
- Form submission: Your webinar registration form
- Contact property: `data_perfection__city` is known

### Step 3: Add Webhook Action

1. Click **+** to add action
2. Select **Trigger a webhook**
3. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/populate-all`
   - **Request body:**
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### Step 4: Activate

1. Review and activate the workflow
2. Test with a sample contact

---

## Required Contact Properties

The webhook reads these properties from the contact to determine their market:

| Property | Internal Name | Description |
|----------|---------------|-------------|
| City | `data_perfection__city` | Contact's city (e.g., "Orlando") |
| State | `data_perfection__state` | Contact's state (e.g., "FL") |

**Important:** The contact MUST have city and state populated before calling the webhook. If these are empty, the webhook will return an error.

---

## Properties Populated

The webhook populates these 53 properties, organized by email day:

### Day 1: Market Snapshot
| Token | Example Value |
|-------|---------------|
| `{{nurture_city}}` | Orlando |
| `{{nurture_state}}` | FL |
| `{{nurture_listing_count}}` | 64,069 |
| `{{nurture_avg_annual_revenue}}` | $52,881 |
| `{{nurture_avg_monthly_revenue}}` | $4,407 |
| `{{nurture_avg_occupancy}}` | 61% |
| `{{nurture_avg_adr}}` | $237 |
| `{{nurture_revenue_trend}}` | down |

### Day 2: Regulations
| Token | Example Value |
|-------|---------------|
| `{{nurture_regulation_status}}` | permitted |
| `{{nurture_permit_required}}` | Yes |
| `{{nurture_arbitrage_friendly}}` | Yes |
| `{{nurture_regulation_notes}}` | Florida requires registration... |

### Day 3: Deal Alert
| Token | Example Value |
|-------|---------------|
| `{{nurture_deal_address}}` | Orlando, FL |
| `{{nurture_deal_bedrooms}}` | 3 |
| `{{nurture_deal_bathrooms}}` | 2 |
| `{{nurture_deal_monthly_revenue}}` | $4,132 |
| `{{nurture_deal_monthly_rent}}` | $2,273 |
| `{{nurture_deal_monthly_profit}}` | $1,859 |
| `{{nurture_deal_occupancy}}` | 41% |
| `{{nurture_deal_adr}}` | $332 |
| `{{nurture_deal_analysis_url}}` | https://coachinayahturnkeytool.com?... |

### Day 4: Seasonality
| Token | Example Value |
|-------|---------------|
| `{{nurture_peak_season}}` | 2025-02 |
| `{{nurture_low_season}}` | 2025-09 |
| `{{nurture_yoy_growth}}` | -19% |
| `{{nurture_1br_revenue}}` | $32,450 |
| `{{nurture_2br_revenue}}` | $41,200 |
| `{{nurture_3br_revenue}}` | $52,881 |
| `{{nurture_4br_revenue}}` | $68,500 |

### Day 5: New Listings
| Token | Example Value |
|-------|---------------|
| `{{nurture_new_listings_count}}` | 5 |
| `{{nurture_sample_listing_address}}` | Orlando, FL |
| `{{nurture_sample_listing_revenue}}` | $4,132 |
| `{{nurture_sample_listing_profit}}` | $1,859 |

### Day 6: Top Performers
| Token | Example Value |
|-------|---------------|
| `{{nurture_performer_1_title}}` | Reunion Castle \| 15BR, 23,400 Sq. Ft |
| `{{nurture_performer_1_revenue}}` | $95,792 |
| `{{nurture_performer_1_occupancy}}` | 78% |
| `{{nurture_performer_2_title}}` | Spacious 5Bed Pool Home... |
| `{{nurture_performer_2_revenue}}` | $91,249 |
| `{{nurture_performer_3_title}}` | New Listing! Champions Gate... |
| `{{nurture_performer_3_revenue}}` | $87,721 |

### Day 7: Summary
| Token | Example Value |
|-------|---------------|
| `{{nurture_market_avg_revenue}}` | $52,881 |
| `{{nurture_market_avg_occupancy}}` | 61% |
| `{{nurture_best_deal_profit}}` | $1,859 |
| `{{nurture_best_deal_url}}` | https://coachinayahturnkeytool.com?... |
| `{{nurture_webinar_date}}` | Sunday |
| `{{nurture_webinar_time}}` | 2:00 PM EST |

### Status Properties
| Token | Description |
|-------|-------------|
| `{{nurture_data_ready}}` | "true" when data is populated |
| `{{nurture_data_populated_at}}` | Timestamp of when data was fetched |

---

## Email Scheduling

Once the webhook populates the data, simply schedule your 7 emails in HubSpot:

| Email | Send Time | Subject Line Example |
|-------|-----------|---------------------|
| Day 1 | Immediately | Your {{nurture_city}} STR Market Report is Ready |
| Day 2 | Day 2 | Can you legally do STR in {{nurture_city}}? |
| Day 3 | Day 3 | 🚨 {{nurture_city}} Deal Alert: ${{nurture_deal_monthly_profit}}/mo profit |
| Day 4 | Day 4 | When to buy in {{nurture_city}} (seasonality data) |
| Day 5 | Day 5 | New rental listings in {{nurture_city}} |
| Day 6 | Day 6 | How {{nurture_city}}'s top hosts earn ${{nurture_performer_1_revenue}}/mo |
| Day 7 | Day 7 | See you Sunday! Your {{nurture_city}} opportunity summary |

---

## Troubleshooting

### Error: "Contact not found or missing city/state data"
- Ensure the contact has `data_perfection__city` and `data_perfection__state` populated
- Check that the contactId is correct

### Error: "Could not fetch market data"
- The city/state combination may not be in AirDNA's database
- Try a larger nearby city

### Data looks wrong
- Check the `nurture_data_populated_at` timestamp to see when data was last fetched
- Re-trigger the webhook to refresh data

---

## Testing

You can test the webhook manually using curl:

```bash
curl -X POST "https://coachinayahturnkeytool.com/api/webhooks/nurture/populate-all" \
  -H "Content-Type: application/json" \
  -d '{"contactId": "YOUR_CONTACT_ID"}'
```

Or use the preview endpoint to see data without updating HubSpot:

```bash
curl "https://coachinayahturnkeytool.com/api/nurture/preview/Orlando/FL"
```
