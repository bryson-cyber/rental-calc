/**
 * Test sending email via HubSpot SMTP
 */

import nodemailer from 'nodemailer';

const HUBSPOT_SMTP_USER = process.env.HUBSPOT_SMTP_USER;
const HUBSPOT_SMTP_PASS = process.env.HUBSPOT_SMTP_PASS;

console.log('=== Test HubSpot SMTP Email ===\n');
console.log('SMTP User configured:', !!HUBSPOT_SMTP_USER);
console.log('SMTP Pass configured:', !!HUBSPOT_SMTP_PASS);

if (!HUBSPOT_SMTP_USER || !HUBSPOT_SMTP_PASS) {
  console.log('\nError: SMTP credentials not configured');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.hubapi.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: HUBSPOT_SMTP_USER,
    pass: HUBSPOT_SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Rich HTML email with Coach Inayah branding
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Investment Opportunity</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0F172A; margin: 0; padding: 0; background-color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%); padding: 40px 32px; text-align: center; }
    .header h1 { color: #C9A962; margin: 0; font-size: 26px; font-weight: 600; }
    .header p { color: #ffffff; opacity: 0.85; margin: 10px 0 0; font-size: 15px; }
    .content { padding: 32px; }
    .greeting { font-size: 17px; margin-bottom: 20px; color: #0F172A; font-weight: 500; }
    .narrative { font-size: 15px; line-height: 1.7; color: #0F172A; margin-bottom: 20px; }
    .property-card { background: #fafafa; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid rgba(201, 169, 98, 0.2); }
    .property-card h2 { margin: 0 0 8px; font-size: 20px; color: #0F172A; }
    .property-card .address { color: #64748b; font-size: 14px; margin: 0 0 16px; }
    .stat-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
    .stat-item { flex: 1; min-width: 100px; text-align: center; padding: 12px; background: #ffffff; border-radius: 8px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #0F172A; }
    .stat-value.gold { color: #C9A962; }
    .stat-value.green { color: #22c55e; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    .cta-section { text-align: center; margin: 32px 0 24px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #C9A962 0%, #d4b978 100%); color: #0F172A; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 15px; }
    .footer { background: #0F172A; padding: 28px 32px; text-align: center; }
    .footer-logo { color: #C9A962; font-size: 18px; font-weight: 600; margin-bottom: 10px; }
    .footer p { color: rgba(255,255,255,0.7); font-size: 12px; margin: 6px 0; }
    .footer a { color: #C9A962; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏠 New Investment Opportunity</h1>
      <p>A property in Denver caught our attention</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hey Bryson,</p>
      
      <p class="narrative">
        I just came across a property in Denver that caught my attention, and I wanted to share it with you right away. This 3-bedroom in a prime location is showing strong numbers – we're projecting <strong>$8,500/month</strong> in revenue based on how similar properties are performing nearby. With rent at $5,653/month, that's a potential profit of <strong style="color: #22c55e;">$2,847/month</strong>.
      </p>
      
      <div class="property-card">
        <h2>1321 15th St</h2>
        <p class="address">Denver, CO 80202</p>
        <span style="display: inline-block; background: rgba(201, 169, 98, 0.2); color: #0F172A; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">3 Bed · 2 Bath</span>
        
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-value gold">$8,500</div>
            <div class="stat-label">Est. Revenue/Mo</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">$5,653</div>
            <div class="stat-label">Monthly Rent</div>
          </div>
          <div class="stat-item">
            <div class="stat-value green">$2,847</div>
            <div class="stat-label">Est. Profit/Mo</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">73%</div>
            <div class="stat-label">Occupancy</div>
          </div>
        </div>
      </div>
      
      <div style="background: #0F172A; border-radius: 12px; padding: 24px; margin: 28px 0; color: #ffffff;">
        <h3 style="color: #C9A962; margin: 0 0 12px; font-size: 16px;">What We Do For You (Turnkey Program)</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255,255,255,0.9);">If you're interested in this opportunity, my team handles everything:</p>
        <ul style="margin: 0; padding: 0; list-style: none;">
          <li style="padding: 6px 0 6px 24px; position: relative; font-size: 13px; color: rgba(255,255,255,0.85);">✓ Run the full numbers and validate the deal</li>
          <li style="padding: 6px 0 6px 24px; position: relative; font-size: 13px; color: rgba(255,255,255,0.85);">✓ Reach out to the landlord and negotiate terms</li>
          <li style="padding: 6px 0 6px 24px; position: relative; font-size: 13px; color: rgba(255,255,255,0.85);">✓ Set up the property from scratch</li>
          <li style="padding: 6px 0 6px 24px; position: relative; font-size: 13px; color: rgba(255,255,255,0.85);">✓ Design and furnish it for maximum bookings</li>
          <li style="padding: 6px 0 6px 24px; position: relative; font-size: 13px; color: rgba(255,255,255,0.85);">✓ Automate your operations so you can be hands-off</li>
        </ul>
      </div>
      
      <div class="cta-section">
        <a href="https://masterclass.coachinayah.com/the-turnkey-program" class="cta-button">Book a Call with Our Team</a>
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-logo">Coach Inayah</div>
      <p>Helping you build wealth through short-term rentals</p>
      <p><a href="https://coachinayahturnkeytool.com">coachinayahturnkeytool.com</a></p>
    </div>
  </div>
</body>
</html>
`;

const testEmail = {
  from: '"Coach Inayah" <bryson@coachinayah.com>',
  to: 'bryson@coachinayah.com',
  subject: 'New Denver opportunity – $2,847/mo profit potential',
  html: htmlContent,
  text: 'New investment opportunity in Denver. 3BR/2BA property at 1321 15th St. Revenue: $8,500/mo, Rent: $5,653/mo, Profit: $2,847/mo. Book a call: https://masterclass.coachinayah.com/the-turnkey-program'
};

console.log('\nSending test email via HubSpot SMTP...');
console.log('To:', testEmail.to);
console.log('Subject:', testEmail.subject);

try {
  const info = await transporter.sendMail(testEmail);
  console.log('\n✓ Email sent successfully!');
  console.log('Message ID:', info.messageId);
  console.log('Response:', info.response);
} catch (err) {
  console.error('\n✗ Error sending email:', err.message);
  if (err.response) {
    console.error('SMTP Response:', err.response);
  }
}
