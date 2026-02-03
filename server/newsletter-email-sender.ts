/**
 * Newsletter Email Sender Service
 * 
 * Sends personalized newsletters via HubSpot API.
 * Uses Coach Inayah brand design system (navy + gold).
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;

// HubSpot SMTP credentials for transactional emails
const HUBSPOT_SMTP_USER = process.env.HUBSPOT_SMTP_USER;
const HUBSPOT_SMTP_PASS = process.env.HUBSPOT_SMTP_PASS;

// Create nodemailer transporter for HubSpot SMTP
// Note: smtp.hubapi.com is the correct hostname for HubSpot transactional emails
const smtpTransporter = HUBSPOT_SMTP_USER && HUBSPOT_SMTP_PASS ? nodemailer.createTransport({
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
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000
}) : null;

// Email sender configuration
const FROM_EMAIL = 'bryson@coachinayah.com';
const FROM_NAME = 'Coach Inayah';
const REPLY_TO = 'support@coachinayah.com';

// Brand URLs
const WEBSITE_URL = 'https://coachinayahturnkeytool.com';
const VSL_URL = 'https://masterclass.coachinayah.com/the-turnkey-program';
const BOOKING_URL = 'https://masterclass.coachinayah.com/the-turnkey-program';

export interface EmailRecipient {
  email: string;
  firstName: string;
  lastName: string;
  contactId?: string;
}

export interface SendEmailParams {
  recipient: EmailRecipient;
  subject: string;
  htmlContent: string;
  textContent?: string;
  customProperties?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  sendId?: string;
  error?: string;
  statusCode?: number;
}

export interface BulkSendResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    email: string;
    success: boolean;
    error?: string;
  }>;
}

// Comparable property interface for deal alerts
export interface ComparableProperty {
  title: string;
  bedrooms: number;
  annualRevenue: number;
  monthlyRevenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  airbnbUrl?: string;
  distance?: number; // in meters
}

// Coach Inayah brand colors
const brand = {
  navy: '#0F172A',
  navyLight: '#1e293b',
  gold: '#C9A962',
  goldLight: '#d4b978',
  white: '#ffffff',
  offWhite: '#fafafa',
  gray: '#64748b',
  grayLight: '#f1f5f9',
  green: '#22c55e',
  greenLight: '#dcfce7',
  red: '#ef4444'
};

/**
 * Generate beautiful HTML email template with Coach Inayah branding
 * Design: Navy (#0F172A) + Gold (#C9A962), DM Sans
 */
function generateEmailHTML(params: {
  type: 'weekly' | 'deal' | 'monthly';
  recipientName: string;
  subject: string;
  mainContent: string;
  ctaUrl?: string;
  ctaText?: string;
  secondaryCtaUrl?: string;
  secondaryCtaText?: string;
  city?: string;
  additionalContent?: string;
}): string {
  const { type, recipientName, subject, mainContent, ctaUrl, ctaText, secondaryCtaUrl, secondaryCtaText, city, additionalContent } = params;
  
  const headerTitle = {
    weekly: '📊 Your Weekly Market Update',
    deal: '🏠 New Investment Opportunity',
    monthly: '📈 Your Monthly Market Report'
  };
  
  const headerSubtitle = {
    weekly: city ? `${city} Short-Term Rental Insights` : 'Short-Term Rental Market Insights',
    deal: city ? `A property in ${city} caught our attention` : 'A property caught our attention',
    monthly: city ? `${city} Performance Summary` : 'Market Performance Summary'
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .stat-item { width: 25% !important; }
  </style>
  <![endif]-->
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      line-height: 1.6; 
      color: ${brand.navy}; 
      margin: 0; 
      padding: 0; 
      background-color: ${brand.grayLight}; 
      -webkit-font-smoothing: antialiased;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: ${brand.white}; 
    }
    .header { 
      background: linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyLight} 100%); 
      padding: 40px 32px; 
      text-align: center; 
    }
    .header h1 { 
      color: ${brand.gold}; 
      margin: 0; 
      font-size: 26px; 
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .header p { 
      color: ${brand.white}; 
      opacity: 0.85; 
      margin: 10px 0 0; 
      font-size: 15px;
      font-weight: 400;
    }
    .content { 
      padding: 32px; 
    }
    .greeting { 
      font-size: 17px; 
      margin-bottom: 20px; 
      color: ${brand.navy};
      font-weight: 500;
    }
    .narrative {
      font-size: 15px;
      line-height: 1.7;
      color: ${brand.navy};
      margin-bottom: 20px;
    }
    .property-card { 
      background: ${brand.offWhite}; 
      border-radius: 12px; 
      padding: 24px; 
      margin: 24px 0; 
      border: 1px solid rgba(201, 169, 98, 0.2);
    }
    .property-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }
    .property-image {
      width: 100px;
      height: 75px;
      border-radius: 8px;
      background: ${brand.grayLight};
      object-fit: cover;
      flex-shrink: 0;
    }
    .property-image-placeholder {
      width: 100px;
      height: 75px;
      border-radius: 8px;
      background: linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyLight} 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .property-image-placeholder span {
      color: ${brand.gold};
      font-size: 28px;
    }
    .property-info {
      flex: 1;
    }
    .property-card h2 { 
      color: ${brand.navy}; 
      margin: 0 0 6px; 
      font-size: 18px;
      font-weight: 600;
      line-height: 1.3;
    }
    .property-card .address {
      color: ${brand.gray};
      font-size: 13px;
      margin: 0;
    }
    .property-badges {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-gold {
      background: linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldLight} 100%);
      color: ${brand.navy};
    }
    .badge-gray {
      background: ${brand.grayLight};
      color: ${brand.gray};
    }
    .stat-grid { 
      display: table;
      width: 100%;
      margin-top: 20px;
      border-spacing: 8px;
    }
    .stat-row {
      display: table-row;
    }
    .stat-item { 
      display: table-cell;
      text-align: center; 
      padding: 14px 8px; 
      background: ${brand.white}; 
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.06);
      vertical-align: top;
    }
    .stat-value { 
      font-size: 22px; 
      font-weight: 700; 
      color: ${brand.navy}; 
      letter-spacing: -0.02em;
    }
    .stat-value.gold {
      color: ${brand.gold};
    }
    .stat-value.green {
      color: ${brand.green};
    }
    .stat-value.red {
      color: ${brand.red};
    }
    .stat-label { 
      font-size: 10px; 
      color: ${brand.gray}; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .property-links {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0,0,0,0.06);
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .property-link {
      color: ${brand.gold};
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }
    .property-link:hover {
      text-decoration: underline;
    }
    .comps-section {
      margin: 28px 0;
      padding: 24px;
      background: ${brand.offWhite};
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .comps-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .comps-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${brand.navy};
    }
    .comps-header .icon {
      color: ${brand.green};
      font-size: 18px;
    }
    .comps-subtitle {
      font-size: 13px;
      color: ${brand.gray};
      margin: 0 0 16px;
    }
    .comp-card {
      background: ${brand.white};
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 10px;
      border: 1px solid rgba(0,0,0,0.04);
    }
    .comp-card:last-child {
      margin-bottom: 0;
    }
    .comp-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .comp-title {
      font-size: 13px;
      font-weight: 500;
      color: ${brand.navy};
      margin: 0;
      flex: 1;
      min-width: 150px;
    }
    .comp-stats {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .comp-stat {
      text-align: center;
    }
    .comp-stat-value {
      font-size: 14px;
      font-weight: 600;
      color: ${brand.navy};
    }
    .comp-stat-value.green {
      color: ${brand.green};
    }
    .comp-stat-label {
      font-size: 9px;
      color: ${brand.gray};
      text-transform: uppercase;
    }
    .comp-link {
      font-size: 12px;
      color: ${brand.gold};
      text-decoration: none;
    }
    .insight-box {
      background: linear-gradient(135deg, rgba(201, 169, 98, 0.08) 0%, rgba(201, 169, 98, 0.04) 100%);
      border-left: 3px solid ${brand.gold};
      padding: 18px 20px;
      border-radius: 0 10px 10px 0;
      margin: 24px 0;
    }
    .insight-box p {
      margin: 0;
      font-size: 14px;
      color: ${brand.navy};
      line-height: 1.6;
    }
    .insight-box strong {
      color: ${brand.navy};
    }
    .turnkey-section {
      background: ${brand.navy};
      border-radius: 12px;
      padding: 24px;
      margin: 28px 0;
      color: ${brand.white};
    }
    .turnkey-section h3 {
      color: ${brand.gold};
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
    }
    .turnkey-section p {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.6;
      color: rgba(255,255,255,0.9);
    }
    .turnkey-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .turnkey-list li {
      padding: 6px 0 6px 24px;
      position: relative;
      font-size: 13px;
      color: rgba(255,255,255,0.85);
    }
    .turnkey-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: ${brand.gold};
      font-weight: bold;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0 24px;
    }
    .cta-button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldLight} 100%);
      color: ${brand.navy}; 
      padding: 16px 40px; 
      border-radius: 50px; 
      text-decoration: none; 
      font-weight: 600; 
      font-size: 15px;
      letter-spacing: 0.02em;
    }
    .secondary-link {
      display: block;
      margin-top: 14px;
      color: ${brand.gray};
      font-size: 13px;
      text-decoration: none;
    }
    .secondary-link a {
      color: ${brand.gold};
      text-decoration: underline;
    }
    .footer { 
      background: ${brand.navy}; 
      padding: 28px 32px; 
      text-align: center; 
    }
    .footer-logo {
      color: ${brand.gold};
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .footer p { 
      color: rgba(255,255,255,0.7); 
      font-size: 12px; 
      margin: 6px 0;
    }
    .footer a { 
      color: ${brand.gold}; 
      text-decoration: none; 
    }
    .footer-links {
      margin: 14px 0;
    }
    .footer-links a {
      margin: 0 10px;
      font-size: 12px;
    }
    .unsubscribe { 
      margin-top: 18px; 
      padding-top: 18px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 10px; 
      color: rgba(255,255,255,0.5); 
    }
    .unsubscribe a {
      color: rgba(255,255,255,0.5);
    }
    @media (max-width: 600px) {
      .content { padding: 24px 20px; }
      .header { padding: 32px 20px; }
      .header h1 { font-size: 22px; }
      .stat-grid { display: block; }
      .stat-row { display: block; }
      .stat-item { display: block; width: 100% !important; margin-bottom: 8px; }
      .property-card { padding: 18px; }
      .property-header { flex-direction: column; }
      .property-image, .property-image-placeholder { width: 100%; height: 120px; }
      .footer { padding: 24px 20px; }
      .comp-row { flex-direction: column; align-items: flex-start; }
      .comp-stats { width: 100%; justify-content: space-between; margin-top: 8px; }
      .turnkey-section { padding: 20px; }
    }
  </style>
</head>
<body>
  <div style="padding: 16px 12px;">
    <div class="container">
      <div class="header">
        <h1>${headerTitle[type]}</h1>
        <p>${headerSubtitle[type]}</p>
      </div>
      <div class="content">
        <div class="greeting">
          Hi ${recipientName || 'there'},
        </div>
        
        ${mainContent}
        
        ${ctaUrl && ctaText ? `
        <div class="cta-section">
          <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
          ${secondaryCtaUrl && secondaryCtaText ? `
          <p class="secondary-link">
            Or <a href="${secondaryCtaUrl}">${secondaryCtaText}</a>
          </p>
          ` : ''}
        </div>
        ` : ''}
        
        ${additionalContent || ''}
      </div>
      <div class="footer">
        <div class="footer-logo">Coach Inayah</div>
        <p>Helping you build wealth through short-term rentals</p>
        <div class="footer-links">
          <a href="${WEBSITE_URL}">Analyze Properties</a>
          <a href="${VSL_URL}">Turnkey Program</a>
        </div>
        <div class="unsubscribe">
          <a href="{{unsubscribe_link}}">Unsubscribe</a> · 
          <a href="{{preferences_link}}">Manage Preferences</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send email via HubSpot SMTP (primary) with HubSpot CRM logging
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const sendId = `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Use HubSpot SMTP for actual email delivery
  if (smtpTransporter) {
    try {
      console.log(`[Newsletter] Sending email via HubSpot SMTP to ${params.recipient.email}`);
      
      const mailOptions = {
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: params.recipient.email,
        replyTo: REPLY_TO,
        subject: params.subject,
        html: params.htmlContent,
        text: params.textContent || ''
      };
      
      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`[Newsletter] Email sent via HubSpot SMTP to ${params.recipient.email}, messageId: ${info.messageId}`);
      
      // Log to HubSpot CRM for tracking (non-blocking)
      logToHubSpot(params, sendId).catch(err => {
        console.warn('[Newsletter] Failed to log to HubSpot CRM:', err);
      });
      
      return { success: true, sendId: info.messageId || sendId };
    } catch (error: any) {
      console.error('[Newsletter] HubSpot SMTP error:', error?.message || error);
      // Fall through to alternative methods
    }
  } else {
    console.warn('[Newsletter] HubSpot SMTP not configured (missing HUBSPOT_SMTP_USER or HUBSPOT_SMTP_PASS)');
  }
  
  // Fallback to Zapier webhook if SMTP fails
  if (ZAPIER_WEBHOOK_URL) {
    try {
      console.log(`[Newsletter] Trying Zapier webhook fallback to ${params.recipient.email}`);
      
      const response = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'send_email',
          to: params.recipient.email,
          toName: `${params.recipient.firstName} ${params.recipient.lastName}`.trim(),
          from: FROM_EMAIL,
          fromName: FROM_NAME,
          replyTo: REPLY_TO,
          subject: params.subject,
          htmlContent: params.htmlContent,
          textContent: params.textContent || '',
          sendId: sendId,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        console.log(`[Newsletter] Email sent via Zapier to ${params.recipient.email}`);
        logToHubSpot(params, sendId).catch(err => {
          console.warn('[Newsletter] Failed to log to HubSpot:', err);
        });
        return { success: true, sendId };
      }
    } catch (error) {
      console.error('[Newsletter] Zapier webhook error:', error);
    }
  }
  
  // Final fallback: log to HubSpot CRM only (email won't be delivered)
  console.warn('[Newsletter] No email delivery method available, logging to HubSpot CRM only');
  await logToHubSpot(params, sendId).catch(() => {});
  return { success: false, error: 'No email delivery method configured (HUBSPOT_SMTP or ZAPIER_WEBHOOK required)' };
}

/**
 * Log email to HubSpot for CRM tracking (non-blocking)
 */
async function logToHubSpot(params: SendEmailParams, sendId: string): Promise<void> {
  if (!HUBSPOT_API_KEY) return;
  
  try {
    // Find or create contact
    const contactResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
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
            value: params.recipient.email
          }]
        }]
      })
    });
    
    let contactId: string | null = null;
    
    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      if (contactData.results && contactData.results.length > 0) {
        contactId = contactData.results[0].id;
      }
    }
    
    if (contactId) {
      // Log email engagement
      await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            hs_timestamp: new Date().toISOString(),
            hs_email_direction: 'EMAIL',
            hs_email_status: 'SENT',
            hs_email_subject: params.subject,
            hs_email_text: params.textContent || 'Newsletter email'
          },
          associations: [{
            to: { id: contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }]
          }]
        })
      });
    }
  } catch (error) {
    console.warn('[Newsletter] HubSpot logging error:', error);
  }
}

/**
 * Alternative: Send via HubSpot Engagement API
 */
async function sendViaAlternativeMethod(params: SendEmailParams, sendId: string): Promise<SendEmailResult> {
  try {
    const contactResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
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
            value: params.recipient.email
          }]
        }]
      })
    });
    
    let contactId: string | null = null;
    
    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      if (contactData.results && contactData.results.length > 0) {
        contactId = contactData.results[0].id;
      }
    }
    
    if (!contactId) {
      const createResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            email: params.recipient.email,
            firstname: params.recipient.firstName,
            lastname: params.recipient.lastName
          }
        })
      });
      
      if (createResponse.ok) {
        const createData = await createResponse.json();
        contactId = createData.id;
      }
    }
    
    if (contactId) {
      await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            hs_timestamp: new Date().toISOString(),
            hs_email_direction: 'EMAIL',
            hs_email_status: 'SENT',
            hs_email_subject: params.subject,
            hs_email_text: params.textContent || 'Newsletter email',
            hs_email_html: params.htmlContent
          },
          associations: [{
            to: { id: contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }]
          }]
        })
      });
    }
    
    console.log(`[Newsletter] Email logged via engagement API for ${params.recipient.email}`);
    return { success: true, sendId };
    
  } catch (error) {
    console.error(`[Newsletter] Alternative method failed:`, error);
    return { success: false, error: String(error), sendId };
  }
}

/**
 * Send weekly market intelligence email
 */
export async function sendWeeklyMarketEmail(params: {
  recipient: EmailRecipient;
  city: string;
  state: string;
  marketData: {
    averageDailyRate: number;
    occupancyRate: number;
    annualRevenue: number;
    activeListings: number;
    adrTrend: number;
    occupancyTrend: number;
    revenueTrend: number;
  };
}): Promise<SendEmailResult> {
  const { recipient, city, state, marketData } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  const formatTrend = (n: number) => n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
  
  // Determine market narrative based on data
  const isStrong = marketData.occupancyRate >= 0.65 && marketData.revenueTrend >= 0;
  const isGrowing = marketData.revenueTrend > 2;
  
  let marketNarrative = '';
  if (isGrowing) {
    marketNarrative = `The ${city} market is showing strong momentum right now. Revenue is trending up ${formatTrend(marketData.revenueTrend)} compared to last month, which tells us demand is healthy and hosts are capturing more bookings.`;
  } else if (isStrong) {
    marketNarrative = `${city} continues to perform well with solid fundamentals. The ${formatPercent(marketData.occupancyRate)} occupancy rate means properties are staying booked, and the average daily rate of ${formatCurrency(marketData.averageDailyRate)} shows guests are willing to pay for quality stays.`;
  } else {
    marketNarrative = `The ${city} market has some interesting dynamics right now. While competition has increased, there are still opportunities for well-positioned properties to capture bookings and generate consistent income.`;
  }
  
  const mainContent = `
    <p class="narrative">
      ${marketNarrative}
    </p>
    
    <div class="property-card">
      <span class="badge badge-gold">Market Snapshot</span>
      <h2 style="margin-top: 12px;">${city}, ${state}</h2>
      <p class="address">${marketData.activeListings.toLocaleString()} active short-term rentals</p>
      
      <div class="stat-grid">
        <div class="stat-row">
          <div class="stat-item">
            <div class="stat-value gold">${formatCurrency(marketData.averageDailyRate)}</div>
            <div class="stat-label">Avg Nightly Rate</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatPercent(marketData.occupancyRate)}</div>
            <div class="stat-label">Occupancy</div>
          </div>
          <div class="stat-item">
            <div class="stat-value gold">${formatCurrency(marketData.annualRevenue)}</div>
            <div class="stat-label">Avg Annual Revenue</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="insight-box">
      <p><strong>What this means for you:</strong> ${marketData.occupancyRate >= 0.7 
        ? `With ${formatPercent(marketData.occupancyRate)} occupancy, properties in ${city} are staying booked. This is a sign of healthy demand that could support a new rental.`
        : `There's room to stand out in ${city}. Properties with great photos, competitive pricing, and strong reviews can capture more than their fair share of bookings.`
      }</p>
    </div>
  `;
  
  const subject = `Your ${city} Market Update – ${formatCurrency(marketData.averageDailyRate)}/night avg`;
  
  const htmlContent = generateEmailHTML({
    type: 'weekly',
    recipientName: recipient.firstName,
    subject,
    mainContent,
    city: `${city}, ${state}`,
    ctaUrl: BOOKING_URL,
    ctaText: 'Book a Call with Our Team',
    secondaryCtaUrl: `${WEBSITE_URL}?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
    secondaryCtaText: 'explore properties in this market'
  });
  
  return sendEmail({
    recipient,
    subject,
    htmlContent
  });
}

/**
 * Send deal alert email with rich property data and comparable properties
 * This is the premium email format with Zillow-like property cards
 */
export async function sendDealAlertEmail(params: {
  recipient: EmailRecipient;
  city: string;
  state: string;
  deal: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    propertyType?: string;
    monthlyRevenue: number;
    annualRevenue: number;
    occupancyRate: number;
    averageDailyRate: number;
    dealScore: number;
    monthlyRent?: number;
    propertyUrl?: string;
    zillowUrl?: string;
    imageUrl?: string;
  };
  comparables?: ComparableProperty[];
  aiNarrative?: string;
}): Promise<SendEmailResult> {
  const { recipient, city, state, deal, comparables = [], aiNarrative } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  // Calculate profit if we have rent data
  const hasRentData = deal.monthlyRent && deal.monthlyRent > 0;
  const monthlyProfit = hasRentData ? deal.monthlyRevenue - deal.monthlyRent! : 0;
  const annualProfit = monthlyProfit * 12;
  const profitMargin = hasRentData && deal.monthlyRevenue > 0 ? (monthlyProfit / deal.monthlyRevenue) * 100 : 0;
  
  // Build narrative - use AI narrative if provided, otherwise generate
  let narrative = aiNarrative || '';
  if (!narrative) {
    narrative = `I just found a property in ${city} that caught my attention, and I wanted to share it with you right away.`;
    
    if (deal.dealScore >= 80) {
      narrative += ` This one has strong numbers – we're projecting ${formatCurrency(deal.monthlyRevenue)}/month in revenue based on how similar properties are performing in the area.`;
      if (hasRentData) {
        narrative += ` With rent at ${formatCurrency(deal.monthlyRent!)}, that's a potential profit of <strong>${formatCurrency(monthlyProfit)}/month</strong>.`;
      }
    } else if (deal.dealScore >= 60) {
      narrative += ` It's showing solid potential with an estimated ${formatCurrency(deal.monthlyRevenue)}/month in revenue.`;
      if (hasRentData) {
        narrative += ` At ${formatCurrency(deal.monthlyRent!)}/month rent, you're looking at roughly <strong>${formatCurrency(monthlyProfit)}/month profit</strong>.`;
      }
    } else {
      narrative += ` The ${formatCurrency(deal.monthlyRevenue)}/month revenue potential could work depending on your criteria.`;
      if (hasRentData) {
        narrative += ` Rent is ${formatCurrency(deal.monthlyRent!)}/month.`;
      }
    }
  }
  
  // Build property-specific analysis URL
  const propertyAnalysisUrl = `${WEBSITE_URL}?step=5&address=${encodeURIComponent(deal.address)}&bedrooms=${deal.bedrooms}&bathrooms=${deal.bathrooms}${hasRentData ? `&rent=${deal.monthlyRent}` : ''}&autoAnalyze=true`;
  
  // Property image or placeholder
  const propertyImageHtml = deal.imageUrl 
    ? `<img src="${deal.imageUrl}" alt="Property" class="property-image" />`
    : `<div class="property-image-placeholder"><span>🏠</span></div>`;
  
  // Property type badge
  const propertyTypeBadge = deal.propertyType 
    ? `<span class="badge badge-gray">${deal.propertyType}</span>` 
    : '';
  
  // Build stat grid - always show 4 stats
  const statGridHtml = hasRentData ? `
    <div class="stat-grid">
      <div class="stat-row">
        <div class="stat-item">
          <div class="stat-value gold">${formatCurrency(deal.monthlyRevenue)}</div>
          <div class="stat-label">Est. Revenue/Mo</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatCurrency(deal.monthlyRent!)}</div>
          <div class="stat-label">Monthly Rent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value ${monthlyProfit > 0 ? 'green' : 'red'}">${formatCurrency(monthlyProfit)}</div>
          <div class="stat-label">Est. Profit/Mo</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(deal.occupancyRate)}</div>
          <div class="stat-label">Occupancy</div>
        </div>
      </div>
    </div>
  ` : `
    <div class="stat-grid">
      <div class="stat-row">
        <div class="stat-item">
          <div class="stat-value gold">${formatCurrency(deal.monthlyRevenue)}</div>
          <div class="stat-label">Est. Revenue/Mo</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(deal.occupancyRate)}</div>
          <div class="stat-label">Occupancy</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatCurrency(deal.averageDailyRate)}</div>
          <div class="stat-label">Avg Nightly Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value gold">${formatCurrency(deal.annualRevenue)}</div>
          <div class="stat-label">Annual Revenue</div>
        </div>
      </div>
    </div>
  `;
  
  // Property links
  const propertyLinksHtml = `
    <div class="property-links">
      <a href="${propertyAnalysisUrl}" class="property-link">📊 Full Analysis</a>
      ${deal.zillowUrl ? `<a href="${deal.zillowUrl}" class="property-link">🏠 View on Zillow</a>` : ''}
    </div>
  `;
  
  // Comparables section - only show if we have comps
  let compsHtml = '';
  if (comparables.length > 0) {
    const compCardsHtml = comparables.slice(0, 5).map(comp => {
      const compMonthlyRevenue = comp.monthlyRevenue || Math.round(comp.annualRevenue / 12);
      const distanceText = comp.distance ? `${(comp.distance / 1609.34).toFixed(1)} mi away` : '';
      const ratingText = comp.rating ? `★ ${comp.rating.toFixed(1)}` : '';
      
      return `
        <div class="comp-card">
          <div class="comp-row">
            <p class="comp-title">${comp.bedrooms}BR · ${comp.title.substring(0, 40)}${comp.title.length > 40 ? '...' : ''}</p>
            <div class="comp-stats">
              <div class="comp-stat">
                <div class="comp-stat-value green">${formatCurrency(compMonthlyRevenue)}/mo</div>
                <div class="comp-stat-label">Revenue</div>
              </div>
              <div class="comp-stat">
                <div class="comp-stat-value">${Math.round(comp.occupancy * 100)}%</div>
                <div class="comp-stat-label">Occupancy</div>
              </div>
              ${comp.airbnbUrl ? `<a href="${comp.airbnbUrl}" class="comp-link" target="_blank">View →</a>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Calculate average revenue from comps
    const avgCompRevenue = comparables.reduce((sum, c) => sum + (c.monthlyRevenue || c.annualRevenue / 12), 0) / comparables.length;
    
    compsHtml = `
      <div class="comps-section">
        <div class="comps-header">
          <span class="icon">✓</span>
          <h3>Properties Nearby Already Making Money</h3>
        </div>
        <p class="comps-subtitle">${comparables.length} similar properties within 1 mile are averaging <strong>${formatCurrency(Math.round(avgCompRevenue))}/mo</strong></p>
        ${compCardsHtml}
      </div>
    `;
  }
  
  // Context insight
  const contextNote = deal.occupancyRate >= 0.7 
    ? `Properties like this in ${city} are averaging ${formatPercent(deal.occupancyRate)} occupancy, which means consistent bookings throughout the year.`
    : `The ${formatPercent(deal.occupancyRate)} occupancy rate is typical for this area – with the right setup and pricing strategy, there's room to outperform.`;
  
  // Turnkey services section
  const turnkeyHtml = `
    <div class="turnkey-section">
      <h3>What We Do For You (Turnkey Program)</h3>
      <p>If you're interested in this opportunity, my team handles everything:</p>
      <ul class="turnkey-list">
        <li>Run the full numbers and validate the deal</li>
        <li>Reach out to the landlord and negotiate terms</li>
        <li>Set up the property from scratch</li>
        <li>Design and furnish it for maximum bookings</li>
        <li>Automate your operations so you can be hands-off</li>
        <li>Ongoing support to optimize your revenue</li>
      </ul>
    </div>
  `;
  
  const mainContent = `
    <p class="narrative">
      ${narrative}
    </p>
    
    <div class="property-card">
      <div class="property-header">
        ${propertyImageHtml}
        <div class="property-info">
          <h2>${deal.address}</h2>
          <p class="address">${city}, ${state}</p>
          <div class="property-badges">
            <span class="badge badge-gold">${deal.bedrooms} Bed · ${deal.bathrooms} Bath</span>
            ${propertyTypeBadge}
          </div>
        </div>
      </div>
      
      ${statGridHtml}
      ${propertyLinksHtml}
    </div>
    
    ${compsHtml}
    
    <div class="insight-box">
      <p><strong>Why we flagged this:</strong> ${contextNote}</p>
    </div>
    
    ${turnkeyHtml}
  `;
  
  // Subject line - include profit if available
  const subject = hasRentData && monthlyProfit > 0
    ? `New ${city} opportunity – ${formatCurrency(monthlyProfit)}/mo profit potential`
    : `New ${city} opportunity – ${formatCurrency(deal.monthlyRevenue)}/mo potential`;
  
  const htmlContent = generateEmailHTML({
    type: 'deal',
    recipientName: recipient.firstName,
    subject,
    mainContent,
    city: `${city}, ${state}`,
    ctaUrl: BOOKING_URL,
    ctaText: 'Book a Call with Our Team',
    secondaryCtaUrl: propertyAnalysisUrl,
    secondaryCtaText: 'view full property analysis'
  });
  
  return sendEmail({
    recipient,
    subject,
    htmlContent
  });
}

/**
 * Send monthly market report email
 */
export async function sendMonthlyReportEmail(params: {
  recipient: EmailRecipient;
  city: string;
  state: string;
  monthYear: string;
  reportData: {
    averageDailyRate: number;
    occupancyRate: number;
    annualRevenue: number;
    monthOverMonthChange: number;
    yearOverYearChange: number;
    topPerformingBedrooms: number;
    seasonalOutlook: string;
    marketTrend: 'growing' | 'stable' | 'declining';
    dealsFound: number;
  };
}): Promise<SendEmailResult> {
  const { recipient, city, state, monthYear, reportData } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  const formatTrend = (n: number) => n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
  
  const trendEmoji = {
    growing: '📈',
    stable: '➡️',
    declining: '📉'
  };
  
  const trendNarrative = {
    growing: `${city} is on an upward trajectory. Revenue is up ${formatTrend(reportData.monthOverMonthChange)} month-over-month, and the fundamentals suggest this momentum could continue.`,
    stable: `${city} is holding steady with consistent performance. This kind of stability is actually great for investors – it means predictable income without the volatility.`,
    declining: `${city} has seen some softening recently, but this can actually create opportunities. Less competition means well-run properties can capture more market share.`
  };
  
  const mainContent = `
    <p class="narrative">
      Here's your monthly recap of what's happening in the ${city} short-term rental market. Let's break down the numbers and what they mean for you.
    </p>
    
    <div class="property-card">
      <span class="badge badge-gold">${monthYear} Report</span>
      <h2 style="margin-top: 12px;">${trendEmoji[reportData.marketTrend]} ${city}, ${state}</h2>
      <p class="address">Market trend: ${reportData.marketTrend.charAt(0).toUpperCase() + reportData.marketTrend.slice(1)}</p>
      
      <div class="stat-grid">
        <div class="stat-row">
          <div class="stat-item">
            <div class="stat-value gold">${formatCurrency(reportData.averageDailyRate)}</div>
            <div class="stat-label">Avg Nightly Rate</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatPercent(reportData.occupancyRate)}</div>
            <div class="stat-label">Occupancy</div>
          </div>
          <div class="stat-item">
            <div class="stat-value gold">${formatCurrency(reportData.annualRevenue)}</div>
            <div class="stat-label">Avg Annual Revenue</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatTrend(reportData.monthOverMonthChange)}</div>
            <div class="stat-label">vs Last Month</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="insight-box">
      <p><strong>The big picture:</strong> ${trendNarrative[reportData.marketTrend]}</p>
    </div>
    
    <p class="narrative">
      <strong>Best performing:</strong> ${reportData.topPerformingBedrooms}-bedroom properties are leading the pack in ${city} right now. If you're looking to enter this market, that's the sweet spot.
    </p>
    
    <p class="narrative">
      <strong>Looking ahead:</strong> ${reportData.seasonalOutlook}
    </p>
    
    ${reportData.dealsFound > 0 ? `
    <p class="narrative">
      We found <strong>${reportData.dealsFound} potential opportunities</strong> in ${city} this month. Book a call below to get the details.
    </p>
    ` : ''}
  `;
  
  const subject = `Your ${monthYear} ${city} Market Report`;
  
  const htmlContent = generateEmailHTML({
    type: 'monthly',
    recipientName: recipient.firstName,
    subject,
    mainContent,
    city: `${city}, ${state}`,
    ctaUrl: BOOKING_URL,
    ctaText: 'Book a Call with Our Team',
    secondaryCtaUrl: `${WEBSITE_URL}?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
    secondaryCtaText: 'explore the market yourself'
  });
  
  return sendEmail({
    recipient,
    subject,
    htmlContent
  });
}

/**
 * Get email send statistics
 */
export async function getSendStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
  total: number;
  successful: number;
  failed: number;
  byType: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, successful: 0, failed: 0, byType: {} };
  
  const daysMap = { day: 1, week: 7, month: 30 };
  const days = daysMap[timeframe];
  
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        email_type,
        COUNT(*) as type_count
      FROM newsletter_sends
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY email_type
    `);
    
    const rows = (result as any)[0] as any[];
    
    const byType: Record<string, number> = {};
    let total = 0;
    let successful = 0;
    let failed = 0;
    
    for (const row of rows) {
      byType[row.email_type] = Number(row.type_count);
      total += Number(row.total);
      successful += Number(row.successful);
      failed += Number(row.failed);
    }
    
    return { total, successful, failed, byType };
  } catch (error) {
    console.error('[Newsletter] Error getting send stats:', error);
    return { total: 0, successful: 0, failed: 0, byType: {} };
  }
}

/**
 * Unsubscribe a contact from newsletters
 */
export async function unsubscribeContact(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.execute(sql`
      INSERT INTO newsletter_preferences (email, subscribed, updated_at)
      VALUES (${email}, false, NOW())
      ON DUPLICATE KEY UPDATE subscribed = false, updated_at = NOW()
    `);
    
    return true;
  } catch (error) {
    console.error('[Newsletter] Error unsubscribing contact:', error);
    return false;
  }
}

/**
 * Check if contact is subscribed
 */
export async function isSubscribed(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  
  try {
    const result = await db.execute(sql`
      SELECT subscribed FROM newsletter_preferences WHERE email = ${email}
    `);
    
    const rows = (result as any)[0] as any[];
    if (rows.length === 0) return true; // Default to subscribed
    return rows[0].subscribed === 1 || rows[0].subscribed === true;
  } catch (error) {
    console.error('[Newsletter] Error checking subscription:', error);
    return true;
  }
}


/**
 * Log a newsletter send to the database
 */
export async function logNewsletterSend(params: {
  contactEmail: string;
  contactId: string;
  city: string;
  state: string;
  newsletterType: string;
  subject: string;
  success: boolean;
  errorMessage?: string;
  hubspotSendId?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.execute(sql`
      INSERT INTO newsletter_sends (
        contact_email, contact_id, city, state, email_type, 
        subject, status, error_message, hubspot_send_id, sent_at
      ) VALUES (
        ${params.contactEmail}, ${params.contactId}, ${params.city}, ${params.state},
        ${params.newsletterType}, ${params.subject}, 
        ${params.success ? 'sent' : 'failed'}, ${params.errorMessage || null},
        ${params.hubspotSendId || null}, NOW()
      )
    `);
  } catch (error) {
    console.error('[Newsletter] Error logging send:', error);
  }
}

/**
 * Check if a contact is unsubscribed (alias for !isSubscribed)
 */
export async function isContactUnsubscribed(email: string): Promise<boolean> {
  return !(await isSubscribed(email));
}


/**
 * HubSpot Single Send API for Deal Alerts
 * Uses the published template in HubSpot Design Manager (ID: 206768585039)
 * 
 * This approach:
 * 1. Updates contact properties with deal data
 * 2. Sends email using HubSpot Single Send API with template
 * 3. HubSpot handles personalization via HubL tokens
 */

const DEAL_ALERT_TEMPLATE_ID = 206768585039;

export interface DealAlertData {
  previewText?: string;
  aiNarration: string;
  propertyAddress: string;
  city?: string;  // Optional - will be extracted from address if not provided
  state?: string; // Optional - will be extracted from address if not provided
  bedrooms: number;
  bathrooms: number;
  propertyType?: string;
  monthlyRevenue: number;
  monthlyRent: number;
  monthlyProfit: number;
  occupancy: number; // Stored as whole number (e.g., 73 for 73%)
  analysisUrl: string;
  compsSummary?: string;
  comps?: Array<{
    title: string;
    revenue: number;
    occupancy: number;
  }>;
}

/**
 * Update HubSpot contact with deal alert properties
 */
async function updateContactDealProperties(contactId: string, dealData: DealAlertData): Promise<boolean> {
  if (!HUBSPOT_API_KEY) {
    console.error('[Newsletter] HubSpot API key not configured');
    return false;
  }

  // Extract city and state from address if not provided
  const addressParts = dealData.propertyAddress.split(',').map(p => p.trim());
  const city = dealData.city || (addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '');
  const state = dealData.state || (addressParts.length >= 1 ? addressParts[addressParts.length - 1].split(' ')[0] : '');

  // Build properties object with deal data
  const properties: Record<string, string> = {
    deal_preview_text: dealData.previewText || `New opportunity: ${dealData.propertyAddress}`,
    deal_ai_narration: dealData.aiNarration,
    deal_property_address: dealData.propertyAddress,
    deal_city: city,
    deal_state: state,
    deal_bedrooms: String(dealData.bedrooms),
    deal_bathrooms: String(dealData.bathrooms),
    deal_property_type: dealData.propertyType || 'Single Family',
    deal_monthly_revenue: String(dealData.monthlyRevenue),
    deal_monthly_rent: String(dealData.monthlyRent),
    deal_monthly_profit: String(dealData.monthlyProfit),
    deal_occupancy: String(Math.round(dealData.occupancy)),
    deal_analysis_url: dealData.analysisUrl,
    deal_comps_summary: dealData.compsSummary || '',
    // TRIGGER THE HUBSPOT WORKFLOW
    deal_alert_trigger: 'send'
  };

  // Add comp properties if available
  if (dealData.comps && dealData.comps.length > 0) {
    for (let i = 0; i < Math.min(3, dealData.comps.length); i++) {
      const comp = dealData.comps[i];
      const idx = i + 1;
      properties[`deal_comp${idx}_title`] = comp.title;
      properties[`deal_comp${idx}_revenue`] = String(comp.revenue);
      properties[`deal_comp${idx}_occupancy`] = String(Math.round(comp.occupancy * 100));
    }
  }

  try {
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
      console.error(`[Newsletter] Failed to update contact properties: ${response.status}`, errorText);
      return false;
    }

    console.log(`[Newsletter] Updated contact ${contactId} with deal properties`);
    return true;
  } catch (error) {
    console.error('[Newsletter] Error updating contact properties:', error);
    return false;
  }
}

/**
 * Find or create HubSpot contact by email
 */
async function findOrCreateContact(email: string, firstName: string, lastName: string): Promise<string | null> {
  if (!HUBSPOT_API_KEY) return null;

  try {
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
        return searchData.results[0].id;
      }
    }

    // Create new contact if not found
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
      return createData.id;
    }

    return null;
  } catch (error) {
    console.error('[Newsletter] Error finding/creating contact:', error);
    return null;
  }
}

/**
 * Send deal alert using HubSpot Single Send API with template
 * 
 * This is the preferred method as it:
 * - Uses HubSpot's email infrastructure for better deliverability
 * - Leverages the designed template in HubSpot Design Manager
 * - Automatically tracks opens, clicks, and engagement
 * - Respects HubSpot subscription preferences
 */
export async function sendDealAlertWithTemplate(params: {
  recipient: EmailRecipient;
  dealData: DealAlertData;
}): Promise<SendEmailResult> {
  const { recipient, dealData } = params;
  const sendId = `deal-template-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  console.log(`[Newsletter] Sending deal alert via HubSpot template to ${recipient.email}`);

  // Step 1: Find or create contact
  const contactId = recipient.contactId || await findOrCreateContact(
    recipient.email,
    recipient.firstName,
    recipient.lastName
  );

  if (!contactId) {
    return { success: false, error: 'Failed to find or create HubSpot contact', sendId };
  }

  // Step 2: Update contact with deal properties
  const updated = await updateContactDealProperties(contactId, dealData);
  if (!updated) {
    console.warn('[Newsletter] Failed to update contact properties, continuing with send...');
  }

  // Step 3: Send email via Single Send API
  if (!HUBSPOT_API_KEY) {
    return { success: false, error: 'HubSpot API key not configured', sendId };
  }

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v3/transactional/single-email/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailId: DEAL_ALERT_TEMPLATE_ID,
        message: {
          to: recipient.email,
          from: FROM_EMAIL,
          sendId: sendId
        },
        contactProperties: {
          firstname: recipient.firstName,
          lastname: recipient.lastName
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[Newsletter] Deal alert sent via HubSpot template to ${recipient.email}`, data);
      return { 
        success: true, 
        sendId: data.sendResult?.sendId || sendId,
        statusCode: response.status
      };
    } else {
      const errorText = await response.text();
      console.error(`[Newsletter] HubSpot Single Send API error: ${response.status}`, errorText);
      
      // Fall back to direct HTML email if template send fails
      console.log('[Newsletter] Falling back to direct HTML email...');
      return await sendDealAlertEmailDirect(params);
    }
  } catch (error) {
    console.error('[Newsletter] HubSpot Single Send API error:', error);
    
    // Fall back to direct HTML email
    console.log('[Newsletter] Falling back to direct HTML email...');
    return await sendDealAlertEmailDirect(params);
  }
}

/**
 * Send deal alert directly via SMTP (fallback if template fails)
 */
async function sendDealAlertEmailDirect(params: {
  recipient: EmailRecipient;
  dealData: DealAlertData;
}): Promise<SendEmailResult> {
  const { recipient, dealData } = params;

  // Build comparable properties array for the existing function
  const comparables: ComparableProperty[] = (dealData.comps || []).map(comp => ({
    title: comp.title,
    bedrooms: dealData.bedrooms,
    annualRevenue: comp.revenue * 12,
    monthlyRevenue: comp.revenue,
    occupancy: comp.occupancy / 100,
    adr: 0,
    rating: null,
    reviews: 0
  }));

  // Extract city/state from address (simple parsing)
  const addressParts = dealData.propertyAddress.split(',').map(s => s.trim());
  const city = addressParts.length > 1 ? addressParts[addressParts.length - 2] : 'Your City';
  const state = addressParts.length > 0 ? addressParts[addressParts.length - 1].split(' ')[0] : '';

  return sendDealAlertEmail({
    recipient,
    city,
    state,
    deal: {
      address: dealData.propertyAddress,
      bedrooms: dealData.bedrooms,
      bathrooms: dealData.bathrooms,
      propertyType: dealData.propertyType,
      monthlyRevenue: dealData.monthlyRevenue,
      annualRevenue: dealData.monthlyRevenue * 12,
      occupancyRate: dealData.occupancy,
      averageDailyRate: Math.round(dealData.monthlyRevenue / 30 / dealData.occupancy),
      dealScore: 75,
      monthlyRent: dealData.monthlyRent
    },
    comparables,
    aiNarrative: dealData.aiNarration
  });
}

/**
 * Send a test deal alert email to verify the template works
 */
export async function sendTestDealAlert(testEmail: string): Promise<SendEmailResult> {
  const testDealData: DealAlertData = {
    previewText: 'New Denver opportunity - $2,847/mo profit potential',
    aiNarration: `I just came across a property in Denver that caught my attention, and I wanted to share it with you right away. This 3-bedroom in a prime location is showing strong numbers – we're projecting $8,500/month in revenue based on how similar properties are performing nearby. With rent at $5,653/month, that's a potential profit of <strong>$2,847/month</strong>.`,
    propertyAddress: '1321 15th St, Denver, CO 80202',
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'Single Family',
    monthlyRevenue: 8500,
    monthlyRent: 5653,
    monthlyProfit: 2847,
    occupancy: 0.73,
    analysisUrl: 'https://coachinayahturnkeytool.com?step=5&address=1321%2015th%20St%2C%20Denver%2C%20CO%2080202&bedrooms=3&bathrooms=2&rent=5653&autoAnalyze=true',
    compsSummary: '3 similar properties within 1 mile averaging $7,200/mo',
    comps: [
      { title: 'Downtown Luxury Loft', revenue: 9746, occupancy: 66 },
      { title: 'Modern City Townhome', revenue: 5973, occupancy: 71 },
      { title: 'Spacious Urban Retreat', revenue: 5093, occupancy: 88 }
    ]
  };

  return sendDealAlertWithTemplate({
    recipient: {
      email: testEmail,
      firstName: 'Test',
      lastName: 'User'
    },
    dealData: testDealData
  });
}
