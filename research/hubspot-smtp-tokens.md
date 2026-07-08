# HubSpot SMTP Tokens Found

## Existing Tokens (from Settings → Email → SMTP)

| Token Name | Date Created | Created By | Create Contact | Username |
|---|---|---|---|---|
| Test Deal Alert | Feb 3, 2026 | bryson@coachinayah.com | Yes | sf2swwymlb@23701521.smtp.hubspot.net |
| TOKEN 3/23 | Mar 23, 2026 | bryson@coachinayah.com | No | pivrurgaix@23701521.smtp.hubspot.net |
| Coach Inayah - Transactional Emails | Mar 29, 2026 | bryson@coachinayah.com | Yes | ptla774fdc@23701521.smtp.hubspot.net |

## Best Token to Use
"Coach Inayah - Transactional Emails" (ptla774fdc@23701521.smtp.hubspot.net)
- Created specifically for transactional emails
- Has "Create Contact" enabled (will auto-create contacts in HubSpot)
- Most recent token

## SMTP Connection Details
- Host: smtp.hubspot.net
- Port: 587 (STARTTLS) or 465 (SSL)
- Username: ptla774fdc@23701521.smtp.hubspot.net
- Password: Need to get from user (only shown at creation time) OR reset it

## Implementation
Use nodemailer with SMTP transport to send custom HTML emails through HubSpot's SMTP relay.
This gives us:
- Full custom HTML control
- HubSpot engagement tracking (opens, clicks)
- Contact timeline visibility
- No template needed in HubSpot
