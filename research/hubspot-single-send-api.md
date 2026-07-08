# HubSpot Single-Send API Reference

## Endpoint
POST `https://api.hubapi.com/marketing/transactional/2026-03/single-email/send`

## Authentication
Bearer token (Private App API key) in Authorization header:
`Authorization: Bearer {HUBSPOT_API_KEY}`

## Required Scopes
- `transactional-email` scope on the private app

## Request Body (JSON)
```json
{
  "emailId": 4126643121,  // ID of the email template in HubSpot
  "message": {
    "to": "recipient@example.com",
    "from": "Sender Name <sender@hubspot.com>",  // optional override
    "sendId": "unique-id-per-send",  // dedup key - only 1 email per sendId per account
    "replyTo": ["reply@example.com"],  // optional
    "cc": ["cc@example.com"],  // optional
    "bcc": ["bcc@example.com"]  // optional
  },
  "contactProperties": {
    "firstname": "John",
    "lastname": "Doe"
  },
  "customProperties": {
    "purchaseUrl": "https://example.com/link-to-product",
    "productName": "vanilla"
  }
}
```

## Key Details
- `emailId`: The ID of the published email template in HubSpot. Get from URL: `https://app.hubspot.com/email/{PORTAL_ID}/edit/{EMAIL_ID}/settings`
- `message.to`: Recipient email address
- `message.sendId`: Deduplication key. Only one email per sendId per account.
- `contactProperties`: Sets HubSpot contact properties (creates contact if doesn't exist)
- `customProperties`: Template variables accessible via `{{ custom.NAME_OF_PROPERTY }}` in HubL

## Response
```json
{
  "requestedAt": "2024-01-01T00:00:00Z",
  "status": "PENDING" | "PROCESSING" | "CANCELED" | "COMPLETE",
  "sendResult": "SENT" | "IDEMPOTENT_IGNORE" | "QUEUED" | "CANCELED" | ...
}
```

## Important Notes
- Requires the Transactional Email add-on in HubSpot
- Any emails sent will automatically create/associate contacts by email address
- Email templates must be created and PUBLISHED in HubSpot's email editor first
- Custom properties are NOT stored in HubSpot - only used for that specific send
- The `sendId` prevents duplicate sends (idempotency)

## Alternative: Marketing Email API (no transactional add-on needed)
If the transactional add-on is not available, we can use HubSpot's Marketing Email API
or simply use the Contacts API to create/update contacts and trigger workflow-based emails.

## Simpler Alternative: HubSpot Timeline Events + Workflows
1. Create contacts via Contacts API
2. Set custom properties (webinar_date, webinar_link, etc.)
3. Use HubSpot Workflows to trigger emails based on property changes or timeline events
This doesn't require the transactional add-on.
