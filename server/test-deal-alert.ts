/**
 * Test Deal Alert Sender
 * 
 * Sends a test deal alert email and SMS to verify the full flow.
 * Uses sample data for testing purposes.
 */

import { 
  sendDealAlertEmail, 
  sendDealAlertWithTemplate,
  sendTestDealAlert as sendTestDealAlertTemplate,
  type ComparableProperty,
  type DealAlertData
} from './newsletter-email-sender';
import { sendDealAlertSMS, sendWelcomeSMS, type SMSRecipient } from './newsletter-sms';

export interface TestDealAlertParams {
  // Recipient info
  email: string;
  firstName: string;
  phone?: string;
  
  // Property info (optional - will use defaults if not provided)
  address?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent?: number;
  monthlyRevenue?: number;
  occupancyRate?: number;
  
  // Options
  sendEmail?: boolean;
  sendSms?: boolean;
  useHubSpotTemplate?: boolean; // Use HubSpot Design Manager template
}

export interface TestDealAlertResult {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  emailError?: string;
  smsError?: string;
  propertyData?: {
    address: string;
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
    occupancyRate: number;
    compsCount: number;
  };
}

/**
 * Send a test deal alert to verify the email and SMS flow
 */
export async function sendTestDealAlert(params: TestDealAlertParams): Promise<TestDealAlertResult> {
  const {
    email,
    firstName,
    phone,
    address = '1234 Peachtree St NE',
    city = 'Atlanta',
    state = 'GA',
    bedrooms = 3,
    bathrooms = 2,
    monthlyRent = 2400,
    monthlyRevenue = 4200,
    occupancyRate = 0.72,
    sendEmail: shouldSendEmail = true,
    sendSms: shouldSendSms = true,
    useHubSpotTemplate = true
  } = params;
  
  const result: TestDealAlertResult = {
    success: false
  };
  
  console.log(`[TestDealAlert] Starting test for ${email}...`);
  
  // Sample comparable properties
  const comparables: ComparableProperty[] = [
    {
      title: 'Charming Midtown Retreat',
      bedrooms: 3,
      annualRevenue: 49200,
      monthlyRevenue: 4100,
      occupancy: 0.74,
      adr: 185,
      rating: 4.9,
      reviews: 148,
      airbnbUrl: 'https://airbnb.com/rooms/12345678',
      distance: 885
    },
    {
      title: 'Modern City Townhome',
      bedrooms: 3,
      annualRevenue: 46800,
      monthlyRevenue: 3900,
      occupancy: 0.71,
      adr: 175,
      rating: 5.0,
      reviews: 109,
      airbnbUrl: 'https://airbnb.com/rooms/23456789',
      distance: 1140
    },
    {
      title: 'Buckhead Luxury Suite',
      bedrooms: 3,
      annualRevenue: 54000,
      monthlyRevenue: 4500,
      occupancy: 0.78,
      adr: 210,
      rating: 4.8,
      reviews: 60,
      airbnbUrl: 'https://airbnb.com/rooms/34567890',
      distance: 930
    },
    {
      title: 'Cozy Inman Park Gem',
      bedrooms: 3,
      annualRevenue: 43800,
      monthlyRevenue: 3650,
      occupancy: 0.69,
      adr: 165,
      rating: 4.7,
      reviews: 85,
      airbnbUrl: 'https://airbnb.com/rooms/45678901',
      distance: 750
    },
    {
      title: 'Virginia Highland Escape',
      bedrooms: 3,
      annualRevenue: 37200,
      monthlyRevenue: 3100,
      occupancy: 0.65,
      adr: 155,
      rating: 4.6,
      reviews: 42,
      airbnbUrl: 'https://airbnb.com/rooms/56789012',
      distance: 1200
    }
  ];
  
  const annualRevenue = monthlyRevenue * 12;
  const averageDailyRate = Math.round(monthlyRevenue / (30 * occupancyRate));
  const monthlyProfit = monthlyRevenue - monthlyRent;
  
  result.propertyData = {
    address: `${address}, ${city}, ${state}`,
    monthlyRevenue,
    monthlyRent,
    monthlyProfit,
    occupancyRate,
    compsCount: comparables.length
  };
  
  // Send email
  if (shouldSendEmail) {
    try {
      console.log(`[TestDealAlert] Sending email to ${email} (template: ${useHubSpotTemplate})...`);
      
      if (useHubSpotTemplate) {
        // Use HubSpot Design Manager template
        const dealData: DealAlertData = {
          previewText: `New ${city} opportunity - $${monthlyProfit.toLocaleString()}/mo profit potential`,
          aiNarration: `I just came across a property in ${city} that caught my attention, and I wanted to share it with you right away. This ${bedrooms}-bedroom in a prime location is showing strong numbers – we're projecting $${monthlyRevenue.toLocaleString()}/month in revenue based on how similar properties are performing nearby. With rent at $${monthlyRent.toLocaleString()}/month, that's a potential profit of <strong>$${monthlyProfit.toLocaleString()}/month</strong>.`,
          propertyAddress: `${address}, ${city}, ${state}`,
          bedrooms,
          bathrooms,
          propertyType: 'Single Family',
          monthlyRevenue,
          monthlyRent,
          monthlyProfit,
          occupancy: occupancyRate,
          analysisUrl: `https://coachinayahturnkeytool.com?step=5&address=${encodeURIComponent(address)}&bedrooms=${bedrooms}&bathrooms=${bathrooms}&rent=${monthlyRent}&autoAnalyze=true`,
          compsSummary: `${comparables.length} similar properties within 1 mile averaging $${Math.round(comparables.reduce((sum, c) => sum + c.monthlyRevenue, 0) / comparables.length).toLocaleString()}/mo`,
          comps: comparables.slice(0, 3).map(c => ({
            title: c.title,
            revenue: c.monthlyRevenue,
            occupancy: Math.round(c.occupancy * 100)
          }))
        };
        
        const emailResult = await sendDealAlertWithTemplate({
          recipient: {
            email,
            firstName,
            lastName: '',
            contactId: undefined
          },
          dealData
        });
        
        result.emailSent = emailResult.success;
        if (!emailResult.success) {
          result.emailError = emailResult.error;
        }
        
        console.log(`[TestDealAlert] Email ${emailResult.success ? 'sent successfully' : 'failed'}: ${emailResult.error || ''}`);
      } else {
        // Use direct HTML email (fallback)
        const emailResult = await sendDealAlertEmail({
          recipient: {
            email,
            firstName,
            lastName: '',
            contactId: undefined
          },
          city,
          state,
          deal: {
            address,
            bedrooms,
            bathrooms,
            propertyType: 'Single Family',
            monthlyRevenue,
            annualRevenue,
            occupancyRate,
            averageDailyRate,
            dealScore: 75,
            monthlyRent,
            zillowUrl: `https://zillow.com/homedetails/${address.replace(/\s+/g, '-').toLowerCase()}-${city.toLowerCase()}-${state.toLowerCase()}`
          },
          comparables
        });
        
        result.emailSent = emailResult.success;
        if (!emailResult.success) {
          result.emailError = emailResult.error;
        }
        
        console.log(`[TestDealAlert] Email ${emailResult.success ? 'sent successfully' : 'failed'}: ${emailResult.error || ''}`);
      }
    } catch (error) {
      result.emailSent = false;
      result.emailError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TestDealAlert] Email error:', error);
    }
  }
  
  // Send SMS
  if (shouldSendSms && phone) {
    try {
      console.log(`[TestDealAlert] Sending SMS to ${phone}...`);
      
      const smsRecipient: SMSRecipient = {
        phone,
        firstName,
        contactId: undefined
      };
      
      // Calculate average comp revenue for SMS
      const avgCompRevenue = Math.round(comparables.reduce((sum, c) => sum + c.monthlyRevenue, 0) / comparables.length);
      
      const smsResult = await sendDealAlertSMS({
        recipient: smsRecipient,
        city,
        state,
        deal: {
          address,
          bedrooms,
          bathrooms,
          monthlyRevenue,
          monthlyRent,
          occupancyRate,
          dealScore: 75
        },
        compsCount: comparables.length,
        avgCompRevenue
      });
      
      result.smsSent = smsResult.success;
      if (!smsResult.success) {
        result.smsError = smsResult.error;
      }
      
      console.log(`[TestDealAlert] SMS ${smsResult.success ? 'sent successfully' : 'failed'}: ${smsResult.error || ''}`);
    } catch (error) {
      result.smsSent = false;
      result.smsError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TestDealAlert] SMS error:', error);
    }
  }
  
  result.success = (shouldSendEmail ? result.emailSent === true : true) && 
                   (shouldSendSms && phone ? result.smsSent === true : true);
  
  console.log(`[TestDealAlert] Test complete. Success: ${result.success}`);
  
  return result;
}

/**
 * Send a welcome message to a new contact
 */
export async function sendWelcomeMessages(params: {
  email: string;
  firstName: string;
  phone?: string;
  city: string;
  state: string;
}): Promise<{ emailSent: boolean; smsSent: boolean }> {
  const { firstName, phone, city, state } = params;
  
  const result = { emailSent: false, smsSent: false };
  
  // For now, just send SMS welcome
  if (phone) {
    try {
      const smsResult = await sendWelcomeSMS({
        recipient: { phone, firstName },
        city,
        state
      });
      result.smsSent = smsResult.success;
    } catch (error) {
      console.error('[Welcome] SMS error:', error);
    }
  }
  
  return result;
}

/**
 * Quick test function using the built-in test data
 */
export async function quickTestDealAlert(email: string): Promise<TestDealAlertResult> {
  return sendTestDealAlertTemplate(email);
}
