# Auto-Notification Feature Test Notes

## UI Verification
- The "Get Report via SMS/Email" toggle is visible in the property form
- Email (optional) and Phone (optional) fields are displayed when toggle is ON
- The toggle appears to be ON by default (amber/orange color)
- Fields have proper placeholders: "your@email.com" and "(555) 123-4567"

## Implementation Summary
1. **Lead Capture (Step 1)**: Added email/phone fields to StartWithProperty component
2. **Context Storage**: Contact info stored in PropertyContext (userEmail, userPhone, enableAutoNotifications)
3. **Auto-Trigger**: RegulationTrackerStep checks for contact info when analysis completes
4. **Backend Endpoint**: New `autoCreateAndNotify` mutation creates shareable report and sends notifications
5. **Notification Service**: Uses existing SimpleTexting API for SMS and Zapier webhook for email

## Flow
1. User enters property details + email/phone in Step 1
2. User navigates to Regulation Tracker (Step 1)
3. User searches for a city's regulations
4. When results return, system automatically:
   - Creates a shareable report with unique URL
   - Sends SMS via SimpleTexting API
   - Sends email via Zapier webhook
   - Shows toast notification confirming delivery
