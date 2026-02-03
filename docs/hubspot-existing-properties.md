# Existing HubSpot Deal Properties

Based on the search for "deal_" in HubSpot Contact Properties, the following properties already exist:

## Page 1 (10 properties)
1. Deal Status - Dropdown select (Deal information group)
2. Deal Bedrooms - Single-line text
3. Deal Bathrooms - Single-line text
4. Deal Occupancy - Single-line text
5. Deal Comp 1 Title - Single-line text
6. Deal Comp 2 Title - Single-line text
7. Deal Comp 3 Title - Single-line text
8. Deal AI Narration - Single-line text
9. Deal Analysis URL - Single-line text
10. Deal Monthly Rent - Single-line text

## Page 2 (10 properties)
11. Deal Preview Text - Single-line text
12. Deal Comp 1 Revenue - Single-line text
13. Deal Comp 2 Revenue - Single-line text
14. Deal Comp 3 Revenue - Single-line text
15. Deal Comps Summary - Single-line text
16. Deal Property Type - Single-line text
17. Deal Monthly Profit - Single-line text
18. Deal Comp 1 Occupancy - Single-line text
19. Deal Comp 2 Occupancy - Single-line text
20. Deal Comp 3 Occupancy - Single-line text

## Page 3 (2 relevant properties)
21. Deal Monthly Revenue - Single-line text
22. Deal Property Address - Single-line text

## Missing Properties (Need to Create)
Based on the email template requirements, the following properties are MISSING and need to be created:

1. **deal_city** - City of the property (Single-line text)
2. **deal_state** - State of the property (Single-line text)
3. **deal_alert_trigger** - Workflow trigger property (Single-line text) - Set to "send" to trigger email

## HubL Token Mapping

| Email Token | HubSpot Property Name |
|-------------|----------------------|
| {{ contact.deal_property_address }} | Deal Property Address |
| {{ contact.deal_city }} | **NEEDS TO BE CREATED** |
| {{ contact.deal_state }} | **NEEDS TO BE CREATED** |
| {{ contact.deal_bedrooms }} | Deal Bedrooms |
| {{ contact.deal_bathrooms }} | Deal Bathrooms |
| {{ contact.deal_monthly_revenue }} | Deal Monthly Revenue |
| {{ contact.deal_monthly_rent }} | Deal Monthly Rent |
| {{ contact.deal_monthly_profit }} | Deal Monthly Profit |
| {{ contact.deal_occupancy }} | Deal Occupancy |
| {{ contact.deal_analysis_url }} | Deal Analysis URL |
| {{ contact.deal_ai_narration }} | Deal AI Narration |
| {{ contact.deal_comp1_title }} | Deal Comp 1 Title |
| {{ contact.deal_comp1_revenue }} | Deal Comp 1 Revenue |
| {{ contact.deal_comp1_occupancy }} | Deal Comp 1 Occupancy |
| {{ contact.deal_comp2_title }} | Deal Comp 2 Title |
| {{ contact.deal_comp2_revenue }} | Deal Comp 2 Revenue |
| {{ contact.deal_comp2_occupancy }} | Deal Comp 2 Occupancy |
| {{ contact.deal_comp3_title }} | Deal Comp 3 Title |
| {{ contact.deal_comp3_revenue }} | Deal Comp 3 Revenue |
| {{ contact.deal_comp3_occupancy }} | Deal Comp 3 Occupancy |
| {{ contact.deal_alert_trigger }} | **NEEDS TO BE CREATED** |
