# HubSpot Newsletter Automation Research

## Key Findings

### 1. Single Send API (Marketing Emails)
- **Endpoint**: `POST /marketing/v4/email/single-send`
- **Requirements**: Marketing Hub Enterprise account
- **Scope**: `marketing-email` or `transactional-email`

**How it works:**
1. Create an email template in HubSpot's marketing email tool
2. Get the email ID from the URL or email details page
3. Send via API with recipient details and custom properties

**Request structure:**
```json
{
  "emailId": 4126643121,
  "message": {
    "to": "recipient@example.com",
    "sendId": "unique-send-id"
  },
  "contactProperties": {
    "city": "Denver"
  },
  "customProperties": {
    "marketData": "...",
    "topProperties": "..."
  }
}
```

**Custom Properties in Template:**
- Use HubL expressions: `{{ custom.marketData }}`
- Supports arrays with programmable email content
- Can pass dynamic market data per recipient

### 2. CRM Search API (Get Contacts by City)
- **Endpoint**: `POST /crm/v3/objects/contacts/search`
- **Scope**: `crm.objects.contacts.read`

**Filter contacts by city:**
```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "city",
          "operator": "EQ",
          "value": "Denver"
        }
      ]
    }
  ],
  "properties": ["email", "firstname", "lastname", "city"]
}
```

**Operators available:**
- `EQ` - equals
- `NEQ` - not equals
- `CONTAINS_TOKEN` - contains
- `HAS_PROPERTY` - has value
- `NOT_HAS_PROPERTY` - no value

### 3. Architecture for Autonomous Newsletter

**Flow:**
1. **Scheduled Job** (daily/weekly) triggers newsletter generation
2. **Get unique cities** from HubSpot contacts
3. **For each city:**
   - Fetch AirDNA market data (revenue, ADR, occupancy, trends)
   - Generate newsletter content with Gemini
   - Get contacts in that city
   - Send personalized email to each contact

**Database Tables Needed:**
- `newsletter_sends` - track what was sent, when, to whom
- `newsletter_preferences` - unsubscribe handling

**Key Considerations:**
- Rate limits: HubSpot has API rate limits
- Batch processing: Send in batches to avoid limits
- Unsubscribe: Must handle opt-outs
- Tracking: Log all sends for analytics

### 4. Alternative: Use HubSpot Workflows + Webhooks
Instead of sending emails via API, could:
1. Create a webhook endpoint in our app
2. HubSpot workflow triggers webhook with contact data
3. Our app generates market data and returns to HubSpot
4. HubSpot sends the email using its native system

**Pros:** Better deliverability, native HubSpot tracking
**Cons:** More complex setup, requires workflow configuration

## Recommended Approach

Use the **Single Send API** approach:
1. Create email template in HubSpot with HubL placeholders
2. Build scheduled job in our app that:
   - Queries contacts grouped by city
   - Fetches AirDNA data for each city
   - Sends personalized emails via Single Send API
3. Track sends in our database
4. Provide admin UI to manage newsletter settings

## API Keys Needed
- `HUBSPOT_API_KEY` - Already configured in environment
