/**
 * Send Test Deal Alert Script
 * 
 * Run with: node scripts/send-test-alert.mjs
 */

import { sendTestDealAlert } from '../server/test-deal-alert.ts';

async function main() {
  console.log('Sending test deal alert to bryson@coachinayah.com...\n');
  
  const result = await sendTestDealAlert({
    email: 'bryson@coachinayah.com',
    firstName: 'Bryson',
    // phone: '1234567890', // Add phone number to test SMS
    address: '1234 Peachtree St NE',
    city: 'Atlanta',
    state: 'GA',
    bedrooms: 3,
    bathrooms: 2,
    monthlyRent: 2400,
    monthlyRevenue: 4200,
    occupancyRate: 0.72,
    sendEmail: true,
    sendSms: false // Set to true and add phone to test SMS
  });
  
  console.log('\n=== Test Result ===');
  console.log('Success:', result.success);
  console.log('Email sent:', result.emailSent);
  console.log('SMS sent:', result.smsSent);
  
  if (result.emailError) {
    console.log('Email error:', result.emailError);
  }
  if (result.smsError) {
    console.log('SMS error:', result.smsError);
  }
  
  if (result.propertyData) {
    console.log('\nProperty Data:');
    console.log('  Address:', result.propertyData.address);
    console.log('  Revenue:', '$' + result.propertyData.monthlyRevenue.toLocaleString() + '/mo');
    console.log('  Rent:', '$' + result.propertyData.monthlyRent.toLocaleString() + '/mo');
    console.log('  Profit:', '$' + result.propertyData.monthlyProfit.toLocaleString() + '/mo');
    console.log('  Occupancy:', Math.round(result.propertyData.occupancyRate * 100) + '%');
    console.log('  Comps:', result.propertyData.compsCount);
  }
}

main().catch(console.error);
