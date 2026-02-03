/**
 * Create a transactional email in HubSpot and send it
 * 
 * HubSpot Single Send API requires a "transactional" type email,
 * not a Design Manager template.
 */

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

const TEST_EMAIL = 'bryson@coachinayah.com';
const FROM_EMAIL = 'bryson@coachinayah.com';

// Rich HTML email content
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Investment Opportunity</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0F172A; margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
    <div style="background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%); padding: 40px 32px; text-align: center;">
      <h1 style="color: #C9A962; margin: 0; font-size: 26px; font-weight: 600;">🏠 New Investment Opportunity</h1>
      <p style="color: #ffffff; opacity: 0.85; margin: 10px 0 0; font-size: 15px;">A property in Denver caught our attention</p>
    </div>
    
    <div style="padding: 32px;">
      <p style="font-size: 17px; margin-bottom: 20px; color: #0F172A; font-weight: 500;">Hey {{contact.firstname}},</p>
      
      <p style="font-size: 15px; line-height: 1.7; color: #0F172A; margin-bottom: 20px;">
        I just came across a property in Denver that caught my attention, and I wanted to share it with you right away. This 3-bedroom in a prime location is showing strong numbers – we're projecting <strong>$8,500/month</strong> in revenue based on how similar properties are performing nearby. With rent at $5,653/month, that's a potential profit of <strong style="color: #22c55e;">$2,847/month</strong>.
      </p>
      
      <div style="background: #fafafa; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid rgba(201, 169, 98, 0.2);">
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #0F172A;">1321 15th St</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 16px;">Denver, CO 80202</p>
        <span style="display: inline-block; background: rgba(201, 169, 98, 0.2); color: #0F172A; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">3 Bed · 2 Bath</span>
        
        <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
          <tr>
            <td style="text-align: center; padding: 12px; background: #ffffff; border-radius: 8px; width: 25%;">
              <div style="font-size: 20px; font-weight: 700; color: #C9A962;">$8,500</div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px;">Revenue/Mo</div>
            </td>
            <td style="text-align: center; padding: 12px; background: #ffffff; border-radius: 8px; width: 25%;">
              <div style="font-size: 20px; font-weight: 700; color: #0F172A;">$5,653</div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px;">Rent</div>
            </td>
            <td style="text-align: center; padding: 12px; background: #ffffff; border-radius: 8px; width: 25%;">
              <div style="font-size: 20px; font-weight: 700; color: #22c55e;">$2,847</div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px;">Profit/Mo</div>
            </td>
            <td style="text-align: center; padding: 12px; background: #ffffff; border-radius: 8px; width: 25%;">
              <div style="font-size: 20px; font-weight: 700; color: #0F172A;">73%</div>
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px;">Occupancy</div>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background: #0F172A; border-radius: 12px; padding: 24px; margin: 28px 0; color: #ffffff;">
        <h3 style="color: #C9A962; margin: 0 0 12px; font-size: 16px;">What We Do For You (Turnkey Program)</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255,255,255,0.9);">If you're interested in this opportunity, my team handles everything:</p>
        <ul style="margin: 0; padding: 0 0 0 20px;">
          <li style="padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.85);">Run the full numbers and validate the deal</li>
          <li style="padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.85);">Reach out to the landlord and negotiate terms</li>
          <li style="padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.85);">Set up the property from scratch</li>
          <li style="padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.85);">Design and furnish it for maximum bookings</li>
          <li style="padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.85);">Automate your operations so you can be hands-off</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 32px 0 24px;">
        <a href="https://masterclass.coachinayah.com/the-turnkey-program" style="display: inline-block; background: linear-gradient(135deg, #C9A962 0%, #d4b978 100%); color: #0F172A; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 15px;">Book a Call with Our Team</a>
      </div>
    </div>
    
    <div style="background: #0F172A; padding: 28px 32px; text-align: center;">
      <div style="color: #C9A962; font-size: 18px; font-weight: 600; margin-bottom: 10px;">Coach Inayah</div>
      <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 6px 0;">Helping you build wealth through short-term rentals</p>
      <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 6px 0;"><a href="https://coachinayahturnkeytool.com" style="color: #C9A962; text-decoration: none;">coachinayahturnkeytool.com</a></p>
    </div>
  </div>
</body>
</html>
`;

async function createTransactionalEmail() {
  console.log('Creating transactional email in HubSpot...');
  
  const response = await fetch(`${HUBSPOT_API_BASE}/marketing-emails/v1/emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Deal Alert - Denver Test',
      subject: 'New Denver opportunity – $2,847/mo profit potential',
      fromName: 'Coach Inayah',
      replyTo: FROM_EMAIL,
      emailType: 'REGULAR_EMAIL',
      isTransactional: true,
      htmlTitle: 'New Investment Opportunity',
      emailBody: htmlContent,
      state: 'DRAFT'
    })
  });
  
  console.log('Create email status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error creating email:', errorText);
    return null;
  }
  
  const data = await response.json();
  console.log('Created email ID:', data.id);
  console.log('Email name:', data.name);
  console.log('Email type:', data.emailType);
  
  return data.id;
}

async function publishEmail(emailId) {
  console.log(`Publishing email ${emailId}...`);
  
  const response = await fetch(`${HUBSPOT_API_BASE}/marketing-emails/v1/emails/${emailId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Publish status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error publishing email:', errorText);
    return false;
  }
  
  return true;
}

async function sendEmail(emailId) {
  console.log(`Sending email ${emailId} to ${TEST_EMAIL}...`);
  
  const sendId = `deal-test-${Date.now()}`;
  
  const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v3/transactional/single-email/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      emailId: emailId,
      message: {
        to: TEST_EMAIL,
        from: FROM_EMAIL,
        sendId: sendId
      },
      contactProperties: {
        firstname: 'Bryson'
      }
    })
  });
  
  console.log('Send status:', response.status);
  const responseText = await response.text();
  console.log('Send response:', responseText);
  
  return response.ok;
}

async function main() {
  console.log('=== Create and Send Transactional Email ===\n');
  
  if (!HUBSPOT_API_KEY) {
    console.error('Error: HUBSPOT_API_KEY not set');
    process.exit(1);
  }
  
  // Step 1: Create the email
  const emailId = await createTransactionalEmail();
  if (!emailId) {
    console.error('Failed to create email');
    process.exit(1);
  }
  
  // Step 2: Publish the email
  const published = await publishEmail(emailId);
  if (!published) {
    console.warn('Warning: Could not publish email, trying to send anyway...');
  }
  
  // Step 3: Send the email
  const sent = await sendEmail(emailId);
  
  if (sent) {
    console.log('\n✓ Email sent successfully! Check bryson@coachinayah.com');
  } else {
    console.log('\n✗ Failed to send email');
  }
}

main().catch(console.error);
