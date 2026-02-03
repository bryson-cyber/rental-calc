/**
 * Test script to trigger the Deal Alert workflow in HubSpot
 * This updates a contact's deal properties and sets deal_alert_trigger = "send"
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const TEST_EMAIL = 'bryson@coachinayah.com'; // Your email for testing

async function updateContactDealProperties(email, dealData) {
  console.log(`\n📧 Updating contact: ${email}`);
  console.log('📊 Deal data:', JSON.stringify(dealData, null, 2));
  
  // First, find the contact by email
  const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
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
  
  const searchData = await searchResponse.json();
  
  if (!searchData.results || searchData.results.length === 0) {
    throw new Error(`Contact not found: ${email}`);
  }
  
  const contactId = searchData.results[0].id;
  console.log(`✅ Found contact ID: ${contactId}`);
  
  // Update the contact with deal properties
  const properties = {
    deal_property_address: dealData.propertyAddress,
    deal_city: dealData.city,
    deal_state: dealData.state,
    deal_bedrooms: String(dealData.bedrooms),
    deal_bathrooms: String(dealData.bathrooms),
    deal_monthly_revenue: String(dealData.monthlyRevenue),
    deal_monthly_profit: String(dealData.monthlyProfit),
    deal_monthly_rent: String(dealData.monthlyRent),
    deal_occupancy: String(dealData.occupancy),
    deal_adr: String(dealData.adr),
    deal_property_type: dealData.propertyType,
    deal_analysis_url: dealData.analysisUrl,
    deal_zillow_url: dealData.zillowUrl,
    deal_ai_narration: dealData.aiNarration,
    deal_preview_text: `${dealData.bedrooms}BR in ${dealData.city} - $${dealData.monthlyProfit}/mo profit potential`,
    // Set the trigger to "send" - this will activate the workflow!
    deal_alert_trigger: 'send'
  };
  
  console.log('\n🔄 Updating contact properties...');
  
  const updateResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ properties })
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update contact: ${updateResponse.status} - ${errorText}`);
  }
  
  const updateData = await updateResponse.json();
  console.log('✅ Contact updated successfully!');
  console.log(`🚀 deal_alert_trigger set to "send" - workflow should trigger now!`);
  
  return updateData;
}

// Sample deal data for testing
const sampleDeal = {
  propertyAddress: '1234 Maple Street, Denver, CO 80202',
  city: 'Denver',
  state: 'CO',
  bedrooms: 3,
  bathrooms: 2,
  monthlyRevenue: 6500,
  monthlyProfit: 2800,
  monthlyRent: 2200,
  occupancy: 72,
  adr: 285,
  propertyType: 'Single Family Home',
  analysisUrl: 'https://coachinayahturnkeytool.com/analysis/test-property',
  zillowUrl: 'https://www.zillow.com/homedetails/1234-Maple-St-Denver-CO-80202/123456789_zpid/',
  aiNarration: 'This 3-bedroom property in Denver shows excellent potential for rental arbitrage. With a projected monthly revenue of $6,500 and rent of $2,200, you could net approximately $2,800 per month after expenses. The 72% occupancy rate is strong for this market, and the $285 average daily rate positions this property competitively among similar listings.'
};

async function main() {
  console.log('🧪 Testing Deal Alert Workflow');
  console.log('================================\n');
  
  if (!HUBSPOT_API_KEY) {
    console.error('❌ HUBSPOT_API_KEY not found in environment');
    process.exit(1);
  }
  
  try {
    await updateContactDealProperties(TEST_EMAIL, sampleDeal);
    
    console.log('\n================================');
    console.log('✅ TEST COMPLETE!');
    console.log('================================');
    console.log(`\n📬 Check your inbox at: ${TEST_EMAIL}`);
    console.log('The Deal Alert email should arrive within 1-2 minutes.');
    console.log('\nNote: The workflow will send the email with the personalized deal data.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
