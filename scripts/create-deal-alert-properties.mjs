/**
 * Script to create HubSpot contact properties for Deal Alert emails
 * Run with: npx tsx scripts/create-deal-alert-properties.mjs
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

if (!HUBSPOT_API_KEY) {
  console.error('HUBSPOT_API_KEY environment variable is not set');
  process.exit(1);
}

const properties = [
  { name: 'deal_preview_text', label: 'Deal Preview Text' },
  { name: 'deal_ai_narration', label: 'Deal AI Narration' },
  { name: 'deal_property_address', label: 'Deal Property Address' },
  { name: 'deal_bedrooms', label: 'Deal Bedrooms' },
  { name: 'deal_bathrooms', label: 'Deal Bathrooms' },
  { name: 'deal_property_type', label: 'Deal Property Type' },
  { name: 'deal_monthly_revenue', label: 'Deal Monthly Revenue' },
  { name: 'deal_monthly_rent', label: 'Deal Monthly Rent' },
  { name: 'deal_monthly_profit', label: 'Deal Monthly Profit' },
  { name: 'deal_occupancy', label: 'Deal Occupancy' },
  { name: 'deal_analysis_url', label: 'Deal Analysis URL' },
  { name: 'deal_comps_summary', label: 'Deal Comps Summary' },
  { name: 'deal_comp1_title', label: 'Deal Comp 1 Title' },
  { name: 'deal_comp1_revenue', label: 'Deal Comp 1 Revenue' },
  { name: 'deal_comp1_occupancy', label: 'Deal Comp 1 Occupancy' },
  { name: 'deal_comp2_title', label: 'Deal Comp 2 Title' },
  { name: 'deal_comp2_revenue', label: 'Deal Comp 2 Revenue' },
  { name: 'deal_comp2_occupancy', label: 'Deal Comp 2 Occupancy' },
  { name: 'deal_comp3_title', label: 'Deal Comp 3 Title' },
  { name: 'deal_comp3_revenue', label: 'Deal Comp 3 Revenue' },
  { name: 'deal_comp3_occupancy', label: 'Deal Comp 3 Occupancy' },
];

async function createProperty(prop) {
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: prop.name,
        label: prop.label,
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
      }),
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`✓ Created: ${prop.name}`);
    } else if (response.status === 409 || data.message?.includes('already exists')) {
      console.log(`○ Already exists: ${prop.name}`);
    } else {
      console.log(`✗ Error creating ${prop.name}: ${data.message}`);
    }
  } catch (error) {
    console.log(`✗ Error creating ${prop.name}: ${error.message}`);
  }
}

async function main() {
  console.log('Creating HubSpot contact properties for Deal Alerts...\n');
  
  for (const prop of properties) {
    await createProperty(prop);
  }
  
  console.log('\nDone!');
}

main();
