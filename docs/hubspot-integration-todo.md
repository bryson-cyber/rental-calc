# HubSpot Integration To-Do List

## Phase 1: Fix Personalized Links (Priority)
- [ ] Fix URL parameters so they auto-populate ALL tools
- [ ] Ensure city/state/zip params work for: regulations, prove, validate, explore, map, market advisor
- [ ] Auto-scroll to the tool section when personalized link is clicked
- [ ] Test each link format works correctly on production

## Phase 2: Email Opt-In System
- [ ] Add "Get Personalized Market Updates" opt-in UI to the tool
- [ ] Create opt-in form collecting: name, email, phone, preferred city/state
- [ ] Store opt-in preferences in database (new table: email_optins)
- [ ] Create API endpoint to handle opt-in submissions
- [ ] Send opt-in data to Zapier webhook for HubSpot sync

## Phase 3: Zapier Workflows
- [ ] Create webhook endpoint in rental calculator to send usage data
- [ ] Set up Zapier Zap: Tool Usage Event → Update HubSpot Contact properties
- [ ] Set up Zapier Zap: New Opt-In → Create/Update HubSpot Contact
- [ ] Set up Zapier Zap: New Opt-In → Add to SimpleTexting list
- [ ] Generate personalized_tool_link property for each HubSpot contact

## Phase 4: HubSpot Email Templates (CRITICAL - Must Run on HubSpot)
- [ ] Create email template with personalized tool links using HubSpot tokens
- [ ] Personalized link format: `https://coachinayahturnkeytool.com/?tab=regulations&city={{contact.city}}&state={{contact.state}}&zip={{contact.postal_code}}`
- [ ] Set up automated welcome email sequence in HubSpot
- [ ] Set up daily property recommendation email workflow in HubSpot
- [ ] Test email delivery with personalized links from HubSpot
- [ ] Ensure all emails are sent FROM HubSpot (not from our tool)

## Personalized Link Format
```
https://coachinayahturnkeytool.com/?city={{contact.city}}&state={{contact.state}}&zip={{contact.postal_code}}
```

## HubSpot Properties to Create/Use
- city (existing: Data Perfection: City)
- state (existing: Data Perfection: State)
- postal_code (existing: Data Perfection: Postal Code)
- personalized_tool_link (new - auto-generated)
- tool_last_used (new)
- markets_researched (new)
- email_optin_date (new)
