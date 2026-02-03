/**
 * Create HubSpot Contact Properties for 7-Day Nurture Sequence
 * 
 * Run with: node scripts/create-nurture-properties.mjs
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

if (!HUBSPOT_API_KEY) {
  console.error('HUBSPOT_API_KEY not found in environment');
  process.exit(1);
}

// Define all properties needed for the 7-day nurture sequence
const nurtureProperties = [
  // ============================================================================
  // DAY 1: Welcome + Market Snapshot
  // ============================================================================
  {
    name: 'nurture_day1_trigger',
    label: 'Nurture Day 1 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 1 email workflow'
  },
  {
    name: 'nurture_market_name',
    label: 'Nurture Market Name',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Market name for email personalization'
  },
  {
    name: 'nurture_city',
    label: 'Nurture City',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Target city for nurture emails'
  },
  {
    name: 'nurture_state',
    label: 'Nurture State',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Target state for nurture emails'
  },
  {
    name: 'nurture_listing_count',
    label: 'Nurture Listing Count',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Number of active STR listings in market'
  },
  {
    name: 'nurture_avg_annual_revenue',
    label: 'Nurture Avg Annual Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Average annual revenue in market'
  },
  {
    name: 'nurture_avg_monthly_revenue',
    label: 'Nurture Avg Monthly Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Average monthly revenue in market'
  },
  {
    name: 'nurture_avg_occupancy',
    label: 'Nurture Avg Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Average occupancy rate in market (%)'
  },
  {
    name: 'nurture_avg_adr',
    label: 'Nurture Avg ADR',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Average daily rate in market'
  },
  {
    name: 'nurture_revenue_trend',
    label: 'Nurture Revenue Trend',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Revenue trend (up/down/stable)'
  },

  // ============================================================================
  // DAY 2: Regulation Update
  // ============================================================================
  {
    name: 'nurture_day2_trigger',
    label: 'Nurture Day 2 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 2 email workflow'
  },
  {
    name: 'nurture_regulation_status',
    label: 'Nurture Regulation Status',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'STR regulation status (permitted/restricted/banned)'
  },
  {
    name: 'nurture_permit_required',
    label: 'Nurture Permit Required',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Whether permit is required (Yes/No)'
  },
  {
    name: 'nurture_regulation_notes',
    label: 'Nurture Regulation Notes',
    type: 'string',
    fieldType: 'textarea',
    groupName: 'nurture_sequence',
    description: 'Detailed regulation notes'
  },
  {
    name: 'nurture_arbitrage_friendly',
    label: 'Nurture Arbitrage Friendly',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Whether market is arbitrage-friendly (Yes/No)'
  },

  // ============================================================================
  // DAY 3: Deal Alert
  // ============================================================================
  {
    name: 'nurture_day3_trigger',
    label: 'Nurture Day 3 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 3 email workflow'
  },
  {
    name: 'nurture_deal_address',
    label: 'Nurture Deal Address',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Featured deal property address'
  },
  {
    name: 'nurture_deal_bedrooms',
    label: 'Nurture Deal Bedrooms',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal bedroom count'
  },
  {
    name: 'nurture_deal_bathrooms',
    label: 'Nurture Deal Bathrooms',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal bathroom count'
  },
  {
    name: 'nurture_deal_monthly_revenue',
    label: 'Nurture Deal Monthly Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal monthly revenue estimate'
  },
  {
    name: 'nurture_deal_monthly_rent',
    label: 'Nurture Deal Monthly Rent',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal monthly rent'
  },
  {
    name: 'nurture_deal_monthly_profit',
    label: 'Nurture Deal Monthly Profit',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal monthly profit potential'
  },
  {
    name: 'nurture_deal_occupancy',
    label: 'Nurture Deal Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal occupancy rate (%)'
  },
  {
    name: 'nurture_deal_adr',
    label: 'Nurture Deal ADR',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Featured deal average daily rate'
  },
  {
    name: 'nurture_deal_analysis_url',
    label: 'Nurture Deal Analysis URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Link to Turnkey Tool analysis'
  },

  // ============================================================================
  // DAY 4: Market Deep Dive
  // ============================================================================
  {
    name: 'nurture_day4_trigger',
    label: 'Nurture Day 4 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 4 email workflow'
  },
  {
    name: 'nurture_revenue_by_bedroom',
    label: 'Nurture Revenue By Bedroom',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Revenue breakdown by bedroom count'
  },
  {
    name: 'nurture_peak_season',
    label: 'Nurture Peak Season',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Peak season month'
  },
  {
    name: 'nurture_low_season',
    label: 'Nurture Low Season',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Low season month'
  },
  {
    name: 'nurture_yoy_growth',
    label: 'Nurture YoY Growth',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Year-over-year revenue growth (%)'
  },
  {
    name: 'nurture_1br_revenue',
    label: 'Nurture 1BR Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: '1-bedroom average annual revenue'
  },
  {
    name: 'nurture_2br_revenue',
    label: 'Nurture 2BR Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: '2-bedroom average annual revenue'
  },
  {
    name: 'nurture_3br_revenue',
    label: 'Nurture 3BR Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: '3-bedroom average annual revenue'
  },
  {
    name: 'nurture_4br_revenue',
    label: 'Nurture 4BR Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: '4-bedroom average annual revenue'
  },

  // ============================================================================
  // DAY 5: New Listings Alert
  // ============================================================================
  {
    name: 'nurture_day5_trigger',
    label: 'Nurture Day 5 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 5 email workflow'
  },
  {
    name: 'nurture_new_listings_count',
    label: 'Nurture New Listings Count',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Number of new rental listings'
  },
  {
    name: 'nurture_sample_listing_address',
    label: 'Nurture Sample Listing Address',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Sample new listing address'
  },
  {
    name: 'nurture_sample_listing_revenue',
    label: 'Nurture Sample Listing Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Sample listing revenue estimate'
  },
  {
    name: 'nurture_sample_listing_profit',
    label: 'Nurture Sample Listing Profit',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Sample listing profit estimate'
  },

  // ============================================================================
  // DAY 6: Competitor Analysis
  // ============================================================================
  {
    name: 'nurture_day6_trigger',
    label: 'Nurture Day 6 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 6 email workflow'
  },
  {
    name: 'nurture_top_performers_count',
    label: 'Nurture Top Performers Count',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Number of top performers analyzed'
  },
  {
    name: 'nurture_performer_1_title',
    label: 'Nurture Performer 1 Title',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Top performer 1 listing title'
  },
  {
    name: 'nurture_performer_1_revenue',
    label: 'Nurture Performer 1 Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 1 monthly revenue'
  },
  {
    name: 'nurture_performer_1_occupancy',
    label: 'Nurture Performer 1 Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 1 occupancy rate'
  },
  {
    name: 'nurture_performer_1_rating',
    label: 'Nurture Performer 1 Rating',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 1 rating'
  },
  {
    name: 'nurture_performer_2_title',
    label: 'Nurture Performer 2 Title',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Top performer 2 listing title'
  },
  {
    name: 'nurture_performer_2_revenue',
    label: 'Nurture Performer 2 Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 2 monthly revenue'
  },
  {
    name: 'nurture_performer_2_occupancy',
    label: 'Nurture Performer 2 Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 2 occupancy rate'
  },
  {
    name: 'nurture_performer_3_title',
    label: 'Nurture Performer 3 Title',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Top performer 3 listing title'
  },
  {
    name: 'nurture_performer_3_revenue',
    label: 'Nurture Performer 3 Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 3 monthly revenue'
  },
  {
    name: 'nurture_performer_3_occupancy',
    label: 'Nurture Performer 3 Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Top performer 3 occupancy rate'
  },

  // ============================================================================
  // DAY 7: Webinar Reminder
  // ============================================================================
  {
    name: 'nurture_day7_trigger',
    label: 'Nurture Day 7 Trigger',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Trigger for Day 7 email workflow'
  },
  {
    name: 'nurture_market_avg_revenue',
    label: 'Nurture Market Avg Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Market average revenue for summary'
  },
  {
    name: 'nurture_market_avg_occupancy',
    label: 'Nurture Market Avg Occupancy',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Market average occupancy for summary'
  },
  {
    name: 'nurture_best_deal_profit',
    label: 'Nurture Best Deal Profit',
    type: 'number',
    fieldType: 'number',
    groupName: 'nurture_sequence',
    description: 'Best deal profit from the week'
  },
  {
    name: 'nurture_best_deal_url',
    label: 'Nurture Best Deal URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Link to best deal analysis'
  },
  {
    name: 'nurture_webinar_date',
    label: 'Nurture Webinar Date',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Webinar date'
  },
  {
    name: 'nurture_webinar_time',
    label: 'Nurture Webinar Time',
    type: 'string',
    fieldType: 'text',
    groupName: 'nurture_sequence',
    description: 'Webinar time'
  }
];

async function createPropertyGroup() {
  console.log('Creating property group: nurture_sequence');
  
  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/properties/contacts/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'nurture_sequence',
        label: 'Nurture Sequence',
        displayOrder: -1
      })
    });

    if (response.ok) {
      console.log('✅ Property group created');
    } else if (response.status === 409) {
      console.log('ℹ️ Property group already exists');
    } else {
      const error = await response.text();
      console.error('❌ Failed to create group:', error);
    }
  } catch (error) {
    console.error('Error creating group:', error);
  }
}

async function createProperty(property) {
  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/properties/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(property)
    });

    if (response.ok) {
      console.log(`✅ Created: ${property.name}`);
      return true;
    } else if (response.status === 409) {
      console.log(`ℹ️ Already exists: ${property.name}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to create ${property.name}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`Error creating ${property.name}:`, error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Creating HubSpot Contact Properties for Nurture Sequence');
  console.log('='.repeat(60));
  console.log('');

  // Create property group first
  await createPropertyGroup();
  console.log('');

  // Create all properties
  let created = 0;
  let failed = 0;

  for (const property of nurtureProperties) {
    const success = await createProperty(property);
    if (success) created++;
    else failed++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Summary: ${created} created/existing, ${failed} failed`);
  console.log('='.repeat(60));
}

main().catch(console.error);
