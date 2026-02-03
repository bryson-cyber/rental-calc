/**
 * Send a test deal alert email to bryson@coachinayah.com
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const DEAL_ALERT_TEMPLATE_ID = 206768585039;

const FROM_EMAIL = 'bryson@coachinayah.com';
const TEST_EMAIL = 'bryson@coachinayah.com';

// Test deal data
const testDealData = {
  previewText: 'New Denver opportunity - $2,847/mo profit potential',
  aiNarration: `I just came across a property in Denver that caught my attention, and I wanted to share it with you right away. This 3-bedroom in a prime location is showing strong numbers – we're projecting $8,500/month in revenue based on how similar properties are performing nearby. With rent at $5,653/month, that's a potential profit of <strong>$2,847/month</strong>.`,
  propertyAddress: '1321 15th St, Denver, CO 80202',
  bedrooms: 3,
  bathrooms: 2,
  propertyType: 'Single Family',
  monthlyRevenue: 8500,
  monthlyRent: 5653,
  monthlyProfit: 2847,
  occupancy: 73,
  analysisUrl: 'https://coachinayahturnkeytool.com?step=5&address=1321%2015th%20St%2C%20Denver%2C%20CO%2080202&bedrooms=3&bathrooms=2&rent=5653&autoAnalyze=true',
  compsSummary: '3 similar properties within 1 mile averaging $7,200/mo',
  comps: [
    { title: 'Downtown Luxury Loft', revenue: 9746, occupancy: 66 },
    { title: 'Modern City Townhome', revenue: 5973, occupancy: 71 },
    { title: 'Spacious Urban Retreat', revenue: 5093, occupancy: 88 }
  ]
};

async function findOrCreateContact(email, firstName, lastName) {
  console.log(`Finding or creating contact for ${email}...`);
  
  // Search for existing contact
  const searchResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email
        }]
      }]
    })
  });

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.results && searchData.results.length > 0) {
      console.log(`Found existing contact: ${searchData.results[0].id}`);
      return searchData.results[0].id;
    }
  }

  // Create new contact if not found
  console.log('Creating new contact...');
  const createResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        email,
        firstname: firstName,
        lastname: lastName
      }
    })
  });

  if (createResponse.ok) {
    const createData = await createResponse.json();
    console.log(`Created new contact: ${createData.id}`);
    return createData.id;
  }

  const errorText = await createResponse.text();
  console.error('Failed to create contact:', errorText);
  return null;
}

async function updateContactDealProperties(contactId, dealData) {
  console.log(`Updating contact ${contactId} with deal properties...`);
  
  const properties = {
    deal_preview_text: dealData.previewText,
    deal_ai_narration: dealData.aiNarration,
    deal_property_address: dealData.propertyAddress,
    deal_bedrooms: String(dealData.bedrooms),
    deal_bathrooms: String(dealData.bathrooms),
    deal_property_type: dealData.propertyType,
    deal_monthly_revenue: String(dealData.monthlyRevenue),
    deal_monthly_rent: String(dealData.monthlyRent),
    deal_monthly_profit: String(dealData.monthlyProfit),
    deal_occupancy: String(dealData.occupancy),
    deal_analysis_url: dealData.analysisUrl,
    deal_comps_summary: dealData.compsSummary
  };

  // Add comp properties
  if (dealData.comps && dealData.comps.length > 0) {
    for (let i = 0; i < Math.min(3, dealData.comps.length); i++) {
      const comp = dealData.comps[i];
      const idx = i + 1;
      properties[`deal_comp${idx}_title`] = comp.title;
      properties[`deal_comp${idx}_revenue`] = String(comp.revenue);
      properties[`deal_comp${idx}_occupancy`] = String(comp.occupancy);
    }
  }

  console.log('Properties to update:', Object.keys(properties));

  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ properties })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update contact properties: ${response.status}`, errorText);
    return false;
  }

  console.log('Contact properties updated successfully');
  return true;
}

async function sendDealAlertEmail(contactId, email) {
  console.log(`Sending deal alert email to ${email} using template ${DEAL_ALERT_TEMPLATE_ID}...`);
  
  const sendId = `deal-test-${Date.now()}`;
  
  const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v3/transactional/single-email/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      emailId: DEAL_ALERT_TEMPLATE_ID,
      message: {
        to: email,
        from: FROM_EMAIL,
        sendId: sendId
      },
      contactProperties: {
        firstname: 'Bryson'
      }
    })
  });

  const responseText = await response.text();
  console.log(`Response status: ${response.status}`);
  console.log(`Response body: ${responseText}`);

  if (response.ok) {
    console.log('✓ Deal alert email sent successfully!');
    return true;
  } else {
    console.error('✗ Failed to send email');
    return false;
  }
}

async function main() {
  console.log('=== Test Deal Alert Email ===\n');
  
  if (!HUBSPOT_API_KEY) {
    console.error('Error: HUBSPOT_API_KEY not set');
    process.exit(1);
  }
  
  // Step 1: Find or create contact
  const contactId = await findOrCreateContact(TEST_EMAIL, 'Bryson', 'Test');
  if (!contactId) {
    console.error('Failed to get contact ID');
    process.exit(1);
  }
  
  // Step 2: Update contact with deal properties
  const updated = await updateContactDealProperties(contactId, testDealData);
  if (!updated) {
    console.warn('Warning: Failed to update some properties, continuing anyway...');
  }
  
  // Step 3: Send the email
  const sent = await sendDealAlertEmail(contactId, TEST_EMAIL);
  
  if (sent) {
    console.log('\n✓ Test complete! Check bryson@coachinayah.com for the deal alert email.');
  } else {
    console.log('\n✗ Test failed. Check the error messages above.');
  }
}

main().catch(console.error);
