/**
 * Script to create custom HubSpot contact properties for the rental calculator
 * Run with: node scripts/create-hubspot-properties.mjs
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

if (!HUBSPOT_API_KEY) {
  console.error('HUBSPOT_API_KEY environment variable is not set');
  process.exit(1);
}

const properties = [
  {
    name: 'deep_link_url',
    label: 'Deep Link URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'Personalized deep link URL for email campaigns from the rental calculator'
  },
  {
    name: 'rental_calculator_city',
    label: 'Rental Calculator City',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'City analyzed in the rental calculator'
  },
  {
    name: 'rental_calculator_state',
    label: 'Rental Calculator State',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'State analyzed in the rental calculator'
  },
  {
    name: 'rental_calculator_property_address',
    label: 'Rental Calculator Property Address',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'Property address analyzed in the rental calculator'
  },
  {
    name: 'rental_calculator_estimated_revenue',
    label: 'Rental Calculator Estimated Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'contactinformation',
    description: 'Estimated annual revenue from the rental calculator'
  },
  {
    name: 'rental_calculator_lead_source',
    label: 'Rental Calculator Lead Source',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'Source of the lead from the rental calculator (e.g., property_estimate, market_advisor)'
  },
  {
    name: 'rental_calculator_last_tool_used',
    label: 'Rental Calculator Last Tool Used',
    type: 'string',
    fieldType: 'text',
    groupName: 'contactinformation',
    description: 'Last tool used in the rental calculator'
  }
];

async function createProperty(property) {
  const response = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(property)
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ Created property: ${property.label}`);
    return data;
  } else if (response.status === 409) {
    console.log(`⚠️ Property already exists: ${property.label}`);
    return null;
  } else {
    const error = await response.text();
    console.error(`❌ Failed to create property ${property.label}:`, error);
    return null;
  }
}

async function main() {
  console.log('Creating HubSpot custom properties for rental calculator...\n');
  
  for (const property of properties) {
    await createProperty(property);
  }
  
  console.log('\n✅ Done creating properties!');
}

main().catch(console.error);
