# HubSpot Workflow Setup Guide: 7-Day Webinar Nurture Sequence

This guide walks you through setting up the complete 7-day nurture sequence workflow in HubSpot.

---

## Overview

The workflow triggers when a contact registers for the webinar and sends 7 personalized emails over 7 days. Before each email, a webhook fetches fresh market data for the contact's city/state.

### Architecture

```
[Webinar Registration] 
    ↓
[Workflow Starts]
    ↓
[Day 1: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 2: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 3: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 4: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 5: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 6: Webhook → Update Properties → Send Email]
    ↓ (24 hours)
[Day 7: Webhook → Update Properties → Send Email]
    ↓
[Workflow Complete]
```

---

## Step 1: Create the Workflow

1. Go to **Automation → Workflows**
2. Click **Create workflow**
3. Select **Contact-based** workflow
4. Name it: `7-Day Webinar Nurture Sequence`

---

## Step 2: Set Enrollment Trigger

**Trigger Type:** Form submission or List membership

**Option A: Form Submission**
- When contact submits form: `Webinar Registration Form`

**Option B: List Membership**
- When contact joins list: `Webinar Registrants`

**Re-enrollment:** 
- ❌ Do NOT allow re-enrollment (one sequence per contact)

---

## Step 3: Add Initial Delay (Optional)

If you want to ensure the contact has `data_perfection_city` and `data_perfection_state` populated:

1. Add **Delay** action
2. Set to: **Until a date or time** → 5 minutes from enrollment
3. This gives time for any data enrichment to complete

---

## Step 4: Day 1 - Welcome + Market Snapshot

### 4.1 Add Webhook Action

1. Click **+** to add action
2. Select **Trigger a webhook**
3. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/1`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```
   - **Authentication:** None (or add API key header if required)

### 4.2 Add Short Delay

1. Add **Delay** action
2. Set to: **For a set amount of time** → 30 seconds
3. This ensures properties are updated before email sends

### 4.3 Add Email Action

1. Add **Send email** action
2. Select email: `Day 1: Welcome + Market Snapshot`
3. Ensure email uses personalization tokens:
   - `{{nurture_city}}`
   - `{{nurture_state}}`
   - `{{nurture_listing_count}}`
   - `{{nurture_avg_annual_revenue}}`
   - `{{nurture_avg_monthly_revenue}}`
   - `{{nurture_avg_occupancy}}`
   - `{{nurture_avg_adr}}`
   - `{{nurture_revenue_trend}}`

---

## Step 5: Day 2 - Regulation Update

### 5.1 Add 24-Hour Delay

1. Add **Delay** action
2. Set to: **For a set amount of time** → 1 day

### 5.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/2`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 5.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 5.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 2: Regulation Update`
3. Personalization tokens:
   - `{{nurture_regulation_status}}`
   - `{{nurture_permit_required}}`
   - `{{nurture_regulation_notes}}`
   - `{{nurture_arbitrage_friendly}}`

---

## Step 6: Day 3 - Deal Alert

### 6.1 Add 24-Hour Delay

1. Add **Delay** → 1 day

### 6.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/3`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 6.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 6.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 3: Deal Alert`
3. Personalization tokens:
   - `{{nurture_deal_address}}`
   - `{{nurture_deal_bedrooms}}`
   - `{{nurture_deal_bathrooms}}`
   - `{{nurture_deal_monthly_revenue}}`
   - `{{nurture_deal_monthly_rent}}`
   - `{{nurture_deal_monthly_profit}}`
   - `{{nurture_deal_occupancy}}`
   - `{{nurture_deal_adr}}`
   - `{{nurture_deal_analysis_url}}`

---

## Step 7: Day 4 - Market Deep Dive

### 7.1 Add 24-Hour Delay

1. Add **Delay** → 1 day

### 7.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/4`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 7.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 7.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 4: Market Deep Dive`
3. Personalization tokens:
   - `{{nurture_peak_season}}`
   - `{{nurture_low_season}}`
   - `{{nurture_yoy_growth}}`
   - `{{nurture_1br_revenue}}`
   - `{{nurture_2br_revenue}}`
   - `{{nurture_3br_revenue}}`
   - `{{nurture_4br_revenue}}`

---

## Step 8: Day 5 - New Listings Alert

### 8.1 Add 24-Hour Delay

1. Add **Delay** → 1 day

### 8.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/5`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 8.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 8.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 5: New Listings Alert`
3. Personalization tokens:
   - `{{nurture_new_listings_count}}`
   - `{{nurture_sample_listing_address}}`
   - `{{nurture_sample_listing_revenue}}`
   - `{{nurture_sample_listing_profit}}`

---

## Step 9: Day 6 - Competitor Analysis

### 9.1 Add 24-Hour Delay

1. Add **Delay** → 1 day

### 9.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/6`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 9.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 9.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 6: Competitor Analysis`
3. Personalization tokens:
   - `{{nurture_top_performers_count}}`
   - `{{nurture_performer_1_title}}`
   - `{{nurture_performer_1_revenue}}`
   - `{{nurture_performer_1_occupancy}}`
   - `{{nurture_performer_1_rating}}`
   - `{{nurture_performer_2_title}}`
   - `{{nurture_performer_2_revenue}}`
   - `{{nurture_performer_2_occupancy}}`
   - `{{nurture_performer_3_title}}`
   - `{{nurture_performer_3_revenue}}`
   - `{{nurture_performer_3_occupancy}}`

---

## Step 10: Day 7 - Webinar Reminder

### 10.1 Add 24-Hour Delay

1. Add **Delay** → 1 day

### 10.2 Add Webhook Action

1. Add **Trigger a webhook**
2. Configure:
   - **Method:** POST
   - **URL:** `https://coachinayahturnkeytool.com/api/webhooks/nurture/7`
   - **Request body:** 
     ```json
     {
       "contactId": "{{contact.hs_object_id}}"
     }
     ```

### 10.3 Add Short Delay

1. Add **Delay** → 30 seconds

### 10.4 Add Email Action

1. Add **Send email** action
2. Select email: `Day 7: Webinar Reminder + Opportunity Summary`
3. Personalization tokens:
   - `{{nurture_market_avg_revenue}}`
   - `{{nurture_market_avg_occupancy}}`
   - `{{nurture_best_deal_profit}}`
   - `{{nurture_best_deal_url}}`
   - `{{nurture_webinar_date}}`
   - `{{nurture_webinar_time}}`

---

## Step 11: Review and Activate

1. Click **Review** in the top right
2. Check all actions are properly configured
3. Verify webhook URLs are correct
4. Ensure all emails are published
5. Click **Turn on** to activate the workflow

---

## Webhook Endpoints Reference

| Day | Endpoint | Purpose |
|-----|----------|---------|
| 1 | `/api/webhooks/nurture/1` | Market snapshot data |
| 2 | `/api/webhooks/nurture/2` | Regulation data |
| 3 | `/api/webhooks/nurture/3` | Deal opportunity data |
| 4 | `/api/webhooks/nurture/4` | Market deep dive data |
| 5 | `/api/webhooks/nurture/5` | New listings data |
| 6 | `/api/webhooks/nurture/6` | Top performers data |
| 7 | `/api/webhooks/nurture/7` | Summary data |

---

## Testing the Workflow

### Option 1: Test with a Real Contact

1. Create a test contact with your email
2. Set `data_perfection_city` = "Denver"
3. Set `data_perfection_state` = "CO"
4. Manually enroll them in the workflow
5. Monitor emails received

### Option 2: Test Webhooks Directly

Use the test endpoint to preview data without updating HubSpot:

```bash
curl "https://coachinayahturnkeytool.com/api/nurture/preview/Denver/CO"
```

### Option 3: Test Individual Days

```bash
# Test Day 1 webhook for a specific contact
curl -X POST "https://coachinayahturnkeytool.com/api/webhooks/nurture/1" \
  -H "Content-Type: application/json" \
  -d '{"contactId": "12345"}'
```

---

## Troubleshooting

### Webhook Not Firing

1. Check workflow is active
2. Verify contact is enrolled
3. Check webhook URL is correct
4. Review workflow history for errors

### Properties Not Updating

1. Verify HubSpot API key is configured in server
2. Check server logs for errors
3. Ensure contact has `data_perfection_city` and `data_perfection_state`

### Emails Showing Blank Tokens

1. Ensure webhook completed successfully
2. Check the 30-second delay is present
3. Verify property names match exactly

---

## Monitoring

### Workflow Performance

- Go to **Automation → Workflows**
- Click on the workflow
- View **Performance** tab for:
  - Enrollment rate
  - Email open rates
  - Click rates
  - Completion rate

### Webhook Logs

- Check server logs at `/api/webhooks/nurture/*`
- Monitor for errors or timeouts
- Track average response times

---

## Best Practices

1. **Test thoroughly** before going live
2. **Monitor first 10 contacts** to ensure data flows correctly
3. **Set up alerts** for webhook failures
4. **Review email performance** weekly and optimize
5. **Keep webinar date/time updated** in Day 7 properties
