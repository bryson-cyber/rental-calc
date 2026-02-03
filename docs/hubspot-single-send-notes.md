# HubSpot Single Send API Notes

## Requirements
- Requires Marketing Hub Enterprise account OR transactional email add-on
- Requires `marketing-email` scope
- Requires a pre-created email template in HubSpot

## Key Limitation
The Single Send API **requires a pre-created email template** in HubSpot's marketing email tool.
It cannot send arbitrary HTML content directly.

You must:
1. Create an email template in HubSpot with HubL variables
2. Reference that template by ID in the API call
3. Pass custom properties to fill in the template variables

## Alternative: SMTP API
The SMTP API allows sending arbitrary HTML content but requires SMTP connection.
The sandbox environment blocks SMTP connections due to DNS restrictions.

## Solution
Need to either:
1. Create email templates in HubSpot and use Single Send API
2. Use a different email service (Resend, SendGrid) that has HTTP API
3. Deploy to production where SMTP works
