# HubSpot Email Implementation Plan

## Decision: Custom HTML via Single-Send API with a "passthrough" template

### Approach
1. Create ONE email template in HubSpot that acts as a passthrough:
   - Template contains just `{{{ custom.html_body }}}` (triple braces = unescaped HTML)
   - This lets us send any custom HTML we want while still getting HubSpot tracking
   
2. Alternative: Use HubSpot SMTP relay for fully custom HTML
   - More complex setup but no template needed
   - Requires SMTP token creation via API

### Recommended: Direct approach without transactional add-on complexity
Since the user wants full control from code, the simplest approach is:
- Use HubSpot's **Marketing Email Single-Send API** with a generic template
- OR use the **Contacts API** to ensure contacts exist, then use **SMTP API** for raw HTML

### API Details
- Endpoint: POST `https://api.hubapi.com/marketing/transactional/2026-03/single-email/send`
- Auth: Bearer token (HUBSPOT_API_KEY already configured)
- Key fields: emailId, message.to, message.from, message.sendId, customProperties

### Template Custom Properties for Webinar Emails
- `html_body` - The full rendered HTML email body
- `subject_line` - Email subject (if template supports dynamic subject)
- `first_name` - Registrant first name
- `webinar_link` - Join link
- `webinar_date` - Formatted date
- `webinar_time` - Formatted time
- `call_link` - Strategy call booking link
- `replay_link` - Replay link (post-webinar)

### Implementation Steps
1. Create `server/hubspot-email.ts` with sendTransactionalEmail() helper
2. Need to create a template in HubSpot first (or have user create one)
3. Store the template emailId as an env var (HUBSPOT_WEBINAR_EMAIL_TEMPLATE_ID)
4. Replace gmail-reminders calls in the multi-channel dispatcher with hubspot-email calls
5. Log sends to email_send_log table for tracking

### SMS Copy Already Updated
The user's pasted_content_2.txt has the full 12-message SMS sequence which has been applied to:
- The code template (for future webinars)
- The database (for tomorrow's Jul 8 webinar pending messages)
