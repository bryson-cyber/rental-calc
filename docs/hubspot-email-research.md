# HubSpot Email Sending Research

## Key Finding: Transactional Email Add-on Required

From HubSpot documentation: "If you have the **transactional email add-on**, you can send emails over a dedicated IP address..."

This means the Single-send API requires a paid add-on.

## Three Methods for Sending Transactional Email

1. **In-app transactional Email** - Create emails using HubSpot's email editor (requires transactional add-on)

2. **SMTP API** - Send through your own system with HubSpot tracking
   - Requires creating SMTP API token
   - Uses HubSpot's SMTP server (smtp.hubapi.com)
   - Domain must be connected as email sending domain in HubSpot
   
3. **Single-send API** - Combination of in-app + SMTP
   - Requires pre-created email template in HubSpot
   - Requires transactional email add-on

## SMTP API Option (Most Promising)

The SMTP API allows sending email through HubSpot's SMTP server:
- Create SMTP token via POST to `/marketing/v3/transactional/smtp-tokens/`
- Use the `id` as username and `password` to log into SMTP server
- Server: smtp.hubapi.com (port 587 with TLS)

### Requirements:
- Domain must be verified in HubSpot as email sending domain
- SMTP token must be created

## Alternative: Use Nodemailer with HubSpot SMTP

We can use nodemailer to send via HubSpot's SMTP server if we have:
1. An SMTP token (id + password)
2. A verified sending domain

## Next Steps

1. Try creating an SMTP token via API
2. If that works, use nodemailer to send via HubSpot SMTP
3. If not, fall back to a dedicated email service (Resend, SendGrid)
