# HubSpot Email API Research

## Single Send API (Marketing Hub Enterprise Required)
- Requires Marketing Hub Enterprise account
- Requires `marketing-email` scope
- Must create email template in HubSpot first, then reference by emailId
- Can pass customProperties for dynamic content using HubL expressions
- Creates contact records automatically

## SMTP API Alternative
- Can send without creating contacts
- More flexible for transactional emails
- Requires SMTP token setup

## Recommendation
Since the Single Send API requires:
1. Marketing Hub Enterprise (expensive)
2. Pre-created email templates in HubSpot
3. Creates contacts automatically

Better to use HubSpot's SMTP API or the Transactional Email API for more flexibility.

## Alternative: HubSpot Transactional Email (v1 Legacy)
POST /email/public/v1/singleEmail/send
- Can send HTML content directly
- Still requires template setup in HubSpot

## Best Option for Our Use Case
Use HubSpot's contact creation + engagement logging, but send emails via:
1. Zapier webhook (current) - keeps working
2. Or add SendGrid/Mailgun for direct HTML email sending
