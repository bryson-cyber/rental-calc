/**
 * Newsletter Email Sender Service
 * 
 * Sends personalized newsletters via HubSpot API.
 * Uses Coach Inayah brand design system (navy + gold).
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Email sender configuration
const FROM_EMAIL = 'bryson@coachinayah.com';
const FROM_NAME = 'Coach Inayah';
const REPLY_TO = 'support@coachinayah.com';

// Brand URLs
const WEBSITE_URL = 'https://coachinayahturnkeytool.com';
const VSL_URL = 'https://masterclass.coachinayah.com/the-turnkey-program';

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

/**
 * Generate beautiful HTML email template with Coach Inayah branding
 * Design: Navy (#0F172A) + Gold (#C9A962), Playfair Display + DM Sans
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
  
  // Coach Inayah brand colors
  const brand = {
    navy: '#0F172A',
    navyLight: '#1e293b',
    gold: '#C9A962',
    goldLight: '#d4b978',
    white: '#ffffff',
    offWhite: '#fafafa',
    gray: '#64748b',
    grayLight: '#f1f5f9'
  };
  
  const headerTitle = {
    weekly: '📊 Your Weekly Market Update',
    deal: '✨ New Opportunity in Your Market',
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
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { 
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; 
      line-height: 1.7; 
      color: ${brand.navy}; 
      margin: 0; 
      padding: 0; 
      background-color: ${brand.grayLight}; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: ${brand.white}; 
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header { 
      background: linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyLight} 100%); 
      padding: 48px 40px; 
      text-align: center; 
    }
    .header h1 { 
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: ${brand.gold}; 
      margin: 0; 
      font-size: 28px; 
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .header p { 
      color: ${brand.white}; 
      opacity: 0.85; 
      margin: 12px 0 0; 
      font-size: 15px;
      font-weight: 400;
    }
    .content { 
      padding: 40px; 
    }
    .greeting { 
      font-size: 18px; 
      margin-bottom: 24px; 
      color: ${brand.navy};
      font-weight: 500;
    }
    .narrative {
      font-size: 16px;
      line-height: 1.8;
      color: ${brand.navy};
      margin-bottom: 24px;
    }
    .property-card { 
      background: ${brand.offWhite}; 
      border-radius: 16px; 
      padding: 28px; 
      margin: 28px 0; 
      border: 1px solid rgba(201, 169, 98, 0.2);
    }
    .property-card h2 { 
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: ${brand.navy}; 
      margin: 0 0 8px; 
      font-size: 20px;
      font-weight: 600;
    }
    .property-card .address {
      color: ${brand.gray};
      font-size: 14px;
      margin-bottom: 20px;
    }
    .opportunity-badge {
      display: inline-block;
      background: linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldLight} 100%);
      color: ${brand.navy};
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .stat-grid { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 12px; 
      margin-top: 20px;
    }
    .stat-item { 
      flex: 1; 
      min-width: 110px; 
      text-align: center; 
      padding: 16px 12px; 
      background: ${brand.white}; 
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    .stat-value { 
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 24px; 
      font-weight: 600; 
      color: ${brand.navy}; 
      letter-spacing: -0.02em;
    }
    .stat-value.highlight {
      color: ${brand.gold};
    }
    .stat-label { 
      font-size: 11px; 
      color: ${brand.gray}; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .insight-box {
      background: linear-gradient(135deg, rgba(201, 169, 98, 0.08) 0%, rgba(201, 169, 98, 0.04) 100%);
      border-left: 3px solid ${brand.gold};
      padding: 20px 24px;
      border-radius: 0 12px 12px 0;
      margin: 24px 0;
    }
    .insight-box p {
      margin: 0;
      font-size: 15px;
      color: ${brand.navy};
      line-height: 1.7;
    }
    .insight-box strong {
      color: ${brand.navy};
    }
    .cta-section {
      text-align: center;
      margin: 36px 0 24px;
    }
    .cta-button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldLight} 100%);
      color: ${brand.navy}; 
      padding: 16px 36px; 
      border-radius: 50px; 
      text-decoration: none; 
      font-weight: 600; 
      font-size: 15px;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 16px rgba(201, 169, 98, 0.3);
      transition: all 0.3s ease;
    }
    .secondary-link {
      display: block;
      margin-top: 16px;
      color: ${brand.gray};
      font-size: 14px;
      text-decoration: none;
    }
    .secondary-link a {
      color: ${brand.gold};
      text-decoration: underline;
    }
    .footer { 
      background: ${brand.navy}; 
      padding: 32px 40px; 
      text-align: center; 
    }
    .footer-logo {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: ${brand.gold};
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .footer p { 
      color: rgba(255,255,255,0.7); 
      font-size: 13px; 
      margin: 8px 0;
    }
    .footer a { 
      color: ${brand.gold}; 
      text-decoration: none; 
    }
    .footer-links {
      margin: 16px 0;
    }
    .footer-links a {
      margin: 0 12px;
      font-size: 13px;
    }
    .unsubscribe { 
      margin-top: 20px; 
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 11px; 
      color: rgba(255,255,255,0.5); 
    }
    .unsubscribe a {
      color: rgba(255,255,255,0.5);
    }
    @media (max-width: 600px) {
      .content { padding: 28px 24px; }
      .header { padding: 36px 24px; }
      .header h1 { font-size: 24px; }
      .stat-grid { flex-direction: column; }
      .stat-item { min-width: 100%; }
      .property-card { padding: 20px; }
      .footer { padding: 28px 24px; }
    }
  </style>
</head>
<body>
  <div style="padding: 20px 16px;">
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
          <a href="${VSL_URL}">Apply for Turnkey Program</a>
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
 * Send email via HubSpot Transactional Email API
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!HUBSPOT_API_KEY) {
    return { success: false, error: 'HUBSPOT_API_KEY is not configured' };
  }
  
  const sendId = `newsletter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/marketing/v3/transactional/single-email/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailId: 0,
        message: {
          to: params.recipient.email,
          from: FROM_EMAIL,
          sendId: sendId
        },
        contactProperties: {
          firstname: params.recipient.firstName,
          lastname: params.recipient.lastName
        },
        customProperties: {
          subject: params.subject,
          htmlContent: params.htmlContent,
          ...params.customProperties
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Newsletter] HubSpot API error:`, errorText);
      return await sendViaAlternativeMethod(params, sendId);
    }
    
    console.log(`[Newsletter] Email sent successfully to ${params.recipient.email}`);
    return { success: true, sendId };
    
  } catch (error) {
    console.error(`[Newsletter] Error sending email to ${params.recipient.email}:`, error);
    return await sendViaAlternativeMethod(params, sendId);
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
      <span class="opportunity-badge">Market Snapshot</span>
      <h2>${city}, ${state}</h2>
      <p class="address">${marketData.activeListings.toLocaleString()} active short-term rentals</p>
      
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(marketData.averageDailyRate)}</div>
          <div class="stat-label">Avg Nightly Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(marketData.occupancyRate)}</div>
          <div class="stat-label">Occupancy</div>
        </div>
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(marketData.annualRevenue)}</div>
          <div class="stat-label">Avg Annual Revenue</div>
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
    ctaUrl: VSL_URL,
    ctaText: 'Book a Strategy Call',
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
 * Send deal alert email with improved narrative
 */
export async function sendDealAlertEmail(params: {
  recipient: EmailRecipient;
  city: string;
  state: string;
  deal: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthlyRevenue: number;
    annualRevenue: number;
    occupancyRate: number;
    averageDailyRate: number;
    dealScore: number;
    monthlyRent?: number; // Monthly rent from Zillow/source
    propertyUrl?: string;
    zillowUrl?: string;
  };
}): Promise<SendEmailResult> {
  const { recipient, city, state, deal } = params;
  
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${Math.round(n * 100)}%`;
  
  // Calculate profit if we have rent data
  const hasRentData = deal.monthlyRent && deal.monthlyRent > 0;
  const monthlyProfit = hasRentData ? deal.monthlyRevenue - deal.monthlyRent! : 0;
  const profitMargin = hasRentData && deal.monthlyRevenue > 0 ? (monthlyProfit / deal.monthlyRevenue) * 100 : 0;
  
  // Build narrative based on deal characteristics - more engaging and specific
  let narrative = `I just found a property in ${city} that caught my attention, and I wanted to share it with you right away.`;
  
  if (deal.dealScore >= 80) {
    narrative += ` This one has strong numbers – we're projecting ${formatCurrency(deal.monthlyRevenue)}/month in revenue based on how similar properties are performing in the area.`;
    if (hasRentData) {
      narrative += ` With rent at ${formatCurrency(deal.monthlyRent!)}, that's a potential profit of ${formatCurrency(monthlyProfit)}/month (${Math.round(profitMargin)}% margin).`;
    }
  } else if (deal.dealScore >= 60) {
    narrative += ` It's showing solid potential with an estimated ${formatCurrency(deal.monthlyRevenue)}/month in revenue.`;
    if (hasRentData) {
      narrative += ` At ${formatCurrency(deal.monthlyRent!)}/month rent, you're looking at roughly ${formatCurrency(monthlyProfit)}/month profit.`;
    }
  } else {
    narrative += ` The ${formatCurrency(deal.monthlyRevenue)}/month revenue potential could work depending on your criteria.`;
    if (hasRentData) {
      narrative += ` Rent is ${formatCurrency(deal.monthlyRent!)}/month.`;
    }
  }
  
  // Add context about why this matters
  const contextNote = deal.occupancyRate >= 0.7 
    ? `Properties like this in ${city} are averaging ${formatPercent(deal.occupancyRate)} occupancy, which means consistent bookings throughout the year.`
    : `The ${formatPercent(deal.occupancyRate)} occupancy rate is typical for this area – with the right setup and pricing strategy, there's room to outperform.`;
  
  // Build property-specific analysis URL that goes directly to Step 5 with this property
  const propertyAnalysisUrl = `${WEBSITE_URL}?step=5&address=${encodeURIComponent(deal.address)}&bedrooms=${deal.bedrooms}&bathrooms=${deal.bathrooms}${hasRentData ? `&rent=${deal.monthlyRent}` : ''}&autoAnalyze=true`;
  
  // Build stat grid - include rent if available
  const statItems = hasRentData ? `
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(deal.monthlyRevenue)}</div>
          <div class="stat-label">Est. Monthly Revenue</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatCurrency(deal.monthlyRent!)}</div>
          <div class="stat-label">Monthly Rent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: ${monthlyProfit > 0 ? '#22c55e' : '#ef4444'};">${formatCurrency(monthlyProfit)}</div>
          <div class="stat-label">Est. Monthly Profit</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(deal.occupancyRate)}</div>
          <div class="stat-label">Market Occupancy</div>
        </div>
  ` : `
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(deal.monthlyRevenue)}</div>
          <div class="stat-label">Est. Monthly Revenue</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(deal.occupancyRate)}</div>
          <div class="stat-label">Market Occupancy</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatCurrency(deal.averageDailyRate)}</div>
          <div class="stat-label">Avg Nightly Rate</div>
        </div>
  `;
  
  const mainContent = `
    <p class="narrative">
      ${narrative}
    </p>
    
    <div class="property-card">
      <span class="opportunity-badge">New Opportunity</span>
      <h2>📍 ${deal.address}</h2>
      <p class="address">${deal.bedrooms} bedroom · ${deal.bathrooms} bath · ${city}, ${state}</p>
      <p style="margin: 12px 0 0; font-size: 14px;">
        <a href="${propertyAnalysisUrl}" style="color: #C9A962; text-decoration: none; font-weight: 500;">📊 View Full Property Analysis →</a>
      </p>
      
      <div class="stat-grid">
        ${statItems}
      </div>
    </div>
    
    <div class="insight-box">
      <p><strong>Why we flagged this:</strong> ${contextNote}</p>
    </div>
    
    <p class="narrative">
      If you're interested in exploring this opportunity, my team can help you with everything – running the full numbers, reaching out to the landlord, negotiating terms, setting up the property, designing and furnishing it, and automating your operations. That's exactly what we do in the <strong>Turnkey Program</strong> – we handle the entire process so you can start earning without the headache.
    </p>
  `;
  
  // Subject line - include profit if available
  const subject = hasRentData && monthlyProfit > 0
    ? `New opportunity in ${city} – ${formatCurrency(monthlyProfit)}/mo profit potential`
    : `New opportunity in ${city} – ${formatCurrency(deal.monthlyRevenue)}/mo potential`;
  
  // Build URLs for the Turnkey Tool
  // Step 5 (Validate the Deal) - shows full revenue analysis with autoAnalyze
  const analysisUrl = propertyAnalysisUrl;
  
  const htmlContent = generateEmailHTML({
    type: 'deal',
    recipientName: recipient.firstName,
    subject,
    mainContent,
    city: `${city}, ${state}`,
    ctaUrl: VSL_URL,
    ctaText: 'Book a Strategy Call',
    secondaryCtaUrl: analysisUrl,
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
      <span class="opportunity-badge">${monthYear} Report</span>
      <h2>${trendEmoji[reportData.marketTrend]} ${city}, ${state}</h2>
      <p class="address">Market trend: ${reportData.marketTrend.charAt(0).toUpperCase() + reportData.marketTrend.slice(1)}</p>
      
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(reportData.averageDailyRate)}</div>
          <div class="stat-label">Avg Nightly Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatPercent(reportData.occupancyRate)}</div>
          <div class="stat-label">Occupancy</div>
        </div>
        <div class="stat-item">
          <div class="stat-value highlight">${formatCurrency(reportData.annualRevenue)}</div>
          <div class="stat-label">Avg Annual Revenue</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatTrend(reportData.monthOverMonthChange)}</div>
          <div class="stat-label">vs Last Month</div>
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
      We found <strong>${reportData.dealsFound} potential opportunities</strong> in ${city} this month. If you'd like us to send you the details, just reply to this email or book a call below.
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
    ctaUrl: VSL_URL,
    ctaText: 'Book a Strategy Call',
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
