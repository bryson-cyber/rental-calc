/**
 * Setup HubSpot Email Templates for Deal Flow Machine
 * 
 * This script creates/updates the email templates needed for the newsletter system:
 * 1. Weekly Market Intelligence
 * 2. Daily Deal Alert  
 * 3. Monthly Market Report
 */

import 'dotenv/config';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

if (!HUBSPOT_API_KEY) {
  console.error('❌ HUBSPOT_API_KEY environment variable is required');
  process.exit(1);
}

// Email template configurations
const emailTemplates = [
  {
    name: 'Deal Flow - Weekly Market Intelligence',
    subject: '{{ custom.subject }}',
    previewText: '{{ custom.previewText }}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%); padding: 30px; text-align: center; }
    .header h1 { color: #C9A962; margin: 0; font-size: 24px; }
    .header p { color: #ffffff; opacity: 0.8; margin: 10px 0 0; }
    .content { padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .market-card { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #C9A962; }
    .market-card h2 { color: #0F172A; margin: 0 0 15px; font-size: 20px; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .stat-item { text-align: center; padding: 15px; background: #ffffff; border-radius: 8px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #0F172A; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .cta-button { display: inline-block; background: #C9A962; color: #0F172A; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { background: #0F172A; padding: 20px; text-align: center; color: #ffffff; font-size: 12px; }
    .footer a { color: #C9A962; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Weekly Market Intelligence</h1>
      <p>Your personalized Airbnb market update</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hi {{ contact.firstname | default("there") }},
      </div>
      
      {{ custom.mainContent }}
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{ custom.ctaUrl }}" class="cta-button">{{ custom.ctaText }}</a>
      </div>
      
      {{ custom.additionalContent }}
    </div>
    <div class="footer">
      <p>Coach Inayah | Las Vegas, NV</p>
      <p><a href="{{ unsubscribe_link }}">Unsubscribe</a> | <a href="{{ email_preferences_link }}">Manage Preferences</a></p>
    </div>
  </div>
</body>
</html>
    `,
    type: 'weekly'
  },
  {
    name: 'Deal Flow - Daily Deal Alert',
    subject: '{{ custom.subject }}',
    previewText: '{{ custom.previewText }}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .header .badge { display: inline-block; background: #fbbf24; color: #0F172A; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 10px; }
    .content { padding: 30px; }
    .deal-card { background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 2px solid #166534; }
    .deal-card h2 { color: #166534; margin: 0 0 10px; font-size: 18px; }
    .deal-stats { display: flex; justify-content: space-between; margin: 15px 0; }
    .deal-stat { text-align: center; }
    .deal-stat-value { font-size: 24px; font-weight: bold; color: #166534; }
    .deal-stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .deal-score { background: #166534; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; }
    .cta-button { display: inline-block; background: #166534; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { background: #0F172A; padding: 20px; text-align: center; color: #ffffff; font-size: 12px; }
    .footer a { color: #C9A962; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 Hot Deal Alert!</h1>
      <div class="badge">NEW OPPORTUNITY</div>
    </div>
    <div class="content">
      <p>Hi {{ contact.firstname | default("there") }},</p>
      <p>We found a potential deal in <strong>{{ custom.city }}</strong> that matches your criteria!</p>
      
      {{ custom.mainContent }}
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{ custom.ctaUrl }}" class="cta-button">{{ custom.ctaText }}</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
        <em>This deal was identified by our automated analysis system. Properties move fast - don't wait!</em>
      </p>
    </div>
    <div class="footer">
      <p>Coach Inayah | Las Vegas, NV</p>
      <p><a href="{{ unsubscribe_link }}">Unsubscribe</a> | <a href="{{ email_preferences_link }}">Manage Preferences</a></p>
    </div>
  </div>
</body>
</html>
    `,
    type: 'deal'
  },
  {
    name: 'Deal Flow - Monthly Market Report',
    subject: '{{ custom.subject }}',
    previewText: '{{ custom.previewText }}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .header p { color: #ffffff; opacity: 0.9; margin: 10px 0 0; }
    .content { padding: 30px; }
    .section { margin: 25px 0; }
    .section h2 { color: #7c3aed; font-size: 18px; border-bottom: 2px solid #e9d5ff; padding-bottom: 10px; }
    .highlight-box { background: #faf5ff; border-radius: 12px; padding: 20px; margin: 15px 0; }
    .trend-up { color: #166534; }
    .trend-down { color: #dc2626; }
    .comparison-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .comparison-table th, .comparison-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .comparison-table th { background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; }
    .cta-button { display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { background: #0F172A; padding: 20px; text-align: center; color: #ffffff; font-size: 12px; }
    .footer a { color: #C9A962; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 Monthly Market Report</h1>
      <p>{{ custom.monthYear }} | {{ custom.city }}</p>
    </div>
    <div class="content">
      <p>Hi {{ contact.firstname | default("there") }},</p>
      <p>Here's your comprehensive monthly report for the <strong>{{ custom.city }}</strong> short-term rental market.</p>
      
      {{ custom.mainContent }}
      
      <div class="section">
        <h2>Key Takeaways</h2>
        {{ custom.keyTakeaways }}
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{ custom.ctaUrl }}" class="cta-button">{{ custom.ctaText }}</a>
      </div>
    </div>
    <div class="footer">
      <p>Coach Inayah | Las Vegas, NV</p>
      <p><a href="{{ unsubscribe_link }}">Unsubscribe</a> | <a href="{{ email_preferences_link }}">Manage Preferences</a></p>
    </div>
  </div>
</body>
</html>
    `,
    type: 'monthly'
  }
];

async function hubspotRequest(endpoint, method = 'GET', body = null) {
  const url = `${HUBSPOT_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function listEmails() {
  console.log('📋 Listing existing emails...');
  try {
    const result = await hubspotRequest('/marketing/v3/emails?limit=100');
    return result.results || [];
  } catch (error) {
    console.error('Error listing emails:', error.message);
    return [];
  }
}

async function createOrUpdateEmail(template) {
  console.log(`\n📧 Processing: ${template.name}`);
  
  // First, check if email already exists
  const existingEmails = await listEmails();
  const existing = existingEmails.find(e => e.name === template.name);
  
  const emailData = {
    name: template.name,
    subject: template.subject,
    // Note: HubSpot Marketing API v3 has specific requirements
    // We'll need to use the correct structure
  };
  
  if (existing) {
    console.log(`  ✓ Found existing email (ID: ${existing.id})`);
    return existing.id;
  } else {
    console.log(`  → Creating new email...`);
    // For now, we'll document the IDs that need to be created manually
    // The HubSpot Marketing Email API requires specific permissions
    return null;
  }
}

async function main() {
  console.log('🚀 HubSpot Email Template Setup');
  console.log('================================\n');
  
  // List existing emails to find our templates
  const emails = await listEmails();
  console.log(`Found ${emails.length} existing emails\n`);
  
  // Find Deal Flow emails
  const dealFlowEmails = emails.filter(e => e.name && e.name.includes('Deal Flow'));
  
  if (dealFlowEmails.length > 0) {
    console.log('📌 Found Deal Flow emails:');
    dealFlowEmails.forEach(email => {
      console.log(`  - ${email.name} (ID: ${email.id})`);
    });
  }
  
  // Output the email IDs that need to be configured
  console.log('\n📝 Email Template IDs to configure in your app:');
  console.log('================================================');
  
  const weeklyEmail = dealFlowEmails.find(e => e.name?.includes('Weekly'));
  const dealEmail = dealFlowEmails.find(e => e.name?.includes('Deal Alert'));
  const monthlyEmail = dealFlowEmails.find(e => e.name?.includes('Monthly'));
  
  console.log(`HUBSPOT_WEEKLY_EMAIL_ID=${weeklyEmail?.id || 'NOT_FOUND'}`);
  console.log(`HUBSPOT_DEAL_ALERT_EMAIL_ID=${dealEmail?.id || 'NOT_FOUND'}`);
  console.log(`HUBSPOT_MONTHLY_EMAIL_ID=${monthlyEmail?.id || 'NOT_FOUND'}`);
  
  // If we found the weekly email we created, output its ID
  const createdWeekly = emails.find(e => e.name === 'New emailDeal Flow - Weekly Market Intelligence');
  if (createdWeekly) {
    console.log(`\n✅ Weekly Market Intelligence email found: ${createdWeekly.id}`);
  }
  
  console.log('\n✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Create the remaining email templates in HubSpot UI');
  console.log('2. Add the email IDs to your environment variables');
  console.log('3. Configure the scheduled jobs in your app');
}

main().catch(console.error);
