/**
 * Seed Translation Cache
 * 
 * Pre-translates all common UI strings for Spanish, French, and Arabic
 * using the Gemini API, then stores them in the translation_cache table.
 * 
 * Run: node server/seed-translations.mjs
 */

import 'dotenv/config';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// ── All common UI strings across the site ──
const UI_STRINGS = [
  // Navigation & Header
  "Free Tools by Coach Inayah",
  "Rental Revenue Calculator",
  "Discover how much your property could earn on Airbnb & VRBO",
  "Get Free Estimate",
  "Property Address",
  "Enter your property address...",
  "Paste Zillow/Redfin URL or enter address...",
  "Bedrooms",
  "Bathrooms",
  "Guests",
  "Log In",
  "Log Out",
  "Sign In",
  "Sign Out",
  "My Account",
  "My Reports",
  "Dashboard",
  "Admin",
  "Settings",
  "Home",
  "Back",
  "Close",
  "Save",
  "Cancel",
  "Delete",
  "Edit",
  "Share",
  "Download",
  "Export",
  "Print",
  "Copy",
  "Search",
  "Filter",
  "Sort",
  "Loading...",
  "Please wait...",
  "Processing...",
  "Generating...",
  "Translating...",
  "Translation complete",
  "No results found",
  "Something went wrong",
  "Try again",
  "Learn More",
  "View Details",
  "View Report",
  "View All",
  "See More",
  "Show Less",
  "Show More",
  "Next",
  "Previous",
  "Submit",
  "Continue",
  "Get Started",
  "Start Over",
  "Reset",
  
  // Property Form Labels
  "Property Details",
  "Property Type",
  "Property Information",
  "Purchase Price",
  "Enter purchase price",
  "Monthly Rent",
  "Enter monthly rent",
  "Loan Type",
  "Down Payment",
  "Interest Rate",
  "Loan Term",
  "Annual Revenue",
  "Monthly Revenue",
  "Average Daily Rate",
  "Occupancy Rate",
  "Revenue Per Available Room",
  "Startup Costs",
  "Operating Expenses",
  "Net Operating Income",
  "Cash on Cash Return",
  "Cap Rate",
  "Break Even Occupancy",
  "Conventional",
  "FHA",
  "VA",
  "DSCR",
  "Hard Money",
  "Cash (No Loan)",
  "years",
  "year",
  "months",
  "month",
  
  // Select Options
  "1 BR",
  "2 BR",
  "3 BR",
  "4 BR",
  "5 BR",
  "6 BR",
  "7 BR",
  "8 BR",
  "1 BA",
  "1.5 BA",
  "2 BA",
  "2.5 BA",
  "3 BA",
  "3.5 BA",
  "4 BA",
  "4.5 BA",
  "5 BA",
  "2 Guests",
  "4 Guests",
  "6 Guests",
  "8 Guests",
  "10 Guests",
  "12 Guests",
  "14 Guests",
  "16 Guests",
  
  // Lead Capture
  "Your Estimate is Ready!",
  "Enter your details to see your rental income potential",
  "Full Name",
  "Email Address",
  "Phone Number",
  "First Name",
  "Last Name",
  "Your email",
  "Your name",
  "Your phone number",
  "See My Results",
  "Unlock Your Free Report",
  "Get Your Free Analysis",
  "We respect your privacy",
  "By submitting, you agree to receive emails from Coach Inayah",
  
  // Results & Reports
  "Annual Revenue Estimate",
  "Monthly Revenue Estimate",
  "Conservative",
  "Realistic",
  "Optimistic",
  "Revenue Range",
  "Market Overview",
  "Market Analysis",
  "Market Score",
  "Market Trends",
  "Market Comparison",
  "Comparable Properties",
  "Competitor Analysis",
  "Monthly Forecast",
  "Revenue Forecast",
  "Occupancy Forecast",
  "Seasonal Trends",
  "Property Report",
  "Full Property Report",
  "Market Report",
  "Full Market Report",
  "Executive Summary",
  "Key Metrics",
  "Key Findings",
  "Profitability Analysis",
  "Investment Analysis",
  "Risk Assessment",
  "Regulatory Overview",
  "Local Regulations",
  "Neighborhood Analysis",
  "Supply & Demand",
  "Historical Performance",
  "Future Outlook",
  "Recommendations",
  "Data Sources",
  "Powered by AirDNA market data",
  "Trusted by 100,000+ hosts",
  
  // Report Sections
  "Revenue Potential",
  "Expense Breakdown",
  "Monthly Breakdown",
  "Annual Summary",
  "Comparable Listings",
  "Top Performing Properties",
  "Average Performance",
  "Below Average",
  "Above Average",
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "High",
  "Medium",
  "Low",
  "Strong",
  "Moderate",
  "Weak",
  
  // Tools Section
  "Investment Calculator",
  "Market Advisor",
  "Deal Alerts",
  "Opportunity Finder",
  "Market Explorer",
  "Full Report Generator",
  "Map View",
  "Regulation Tracker",
  "Property Comparison",
  "AI Market Advisor",
  "Smart Deal Alerts",
  "Explore Markets",
  "Find Opportunities",
  "Generate Report",
  "Calculate Returns",
  "Track Regulations",
  "Compare Properties",
  "Compare Markets",
  
  // Investment Calculator
  "Investment Details",
  "Financing",
  "Financing Details",
  "Purchase Details",
  "Loan Details",
  "Monthly Payment",
  "Total Investment",
  "Return on Investment",
  "Payback Period",
  "Annual Cash Flow",
  "Monthly Cash Flow",
  "Gross Yield",
  "Net Yield",
  "Debt Service Coverage Ratio",
  "Loan to Value",
  "Total Loan Amount",
  "Monthly Mortgage Payment",
  "Property Taxes",
  "Insurance",
  "HOA Fees",
  "Maintenance",
  "Utilities",
  "Property Management",
  "Cleaning Fees",
  "Supplies",
  "Marketing",
  "Other Expenses",
  "Total Monthly Expenses",
  "Total Annual Expenses",
  
  // Market Advisor
  "Ask me anything about short-term rental markets",
  "Type your question...",
  "Analyzing...",
  "Market Insights",
  "Market Data",
  "Market Statistics",
  "Average Revenue",
  "Average Occupancy",
  "Average ADR",
  "Active Listings",
  "Total Revenue",
  "Revenue Growth",
  "Occupancy Trend",
  "ADR Trend",
  "Supply Growth",
  "Demand Score",
  "Investability Score",
  "Rental Demand",
  "Seasonality",
  
  // Deal Alerts
  "Set Up Deal Alerts",
  "Get notified when new deals match your criteria",
  "Alert Name",
  "Target Market",
  "Minimum Revenue",
  "Maximum Price",
  "Minimum Occupancy",
  "Create Alert",
  "Active Alerts",
  "No active alerts",
  "New Deal Found!",
  "Matches your criteria",
  
  // Shared Reports
  "Shared Report",
  "This report was shared with you",
  "Share This Report",
  "Copy Link",
  "Link Copied!",
  "Share via Email",
  "Share via Text",
  "Share to Slack",
  "Send Report",
  "Report shared successfully",
  "Share with your team",
  "Send to Channel",
  "Select a channel",
  
  // Admin Dashboard
  "Admin Dashboard",
  "Total Users",
  "Total Reports",
  "Total Leads",
  "Active Users",
  "New Users",
  "Reports Generated",
  "Leads Captured",
  "Revenue Tracked",
  "User Activity",
  "Recent Activity",
  "Activity Log",
  "User Management",
  "Lead Management",
  "Report Management",
  "System Settings",
  "Analytics",
  "Overview",
  "Users",
  "Leads",
  "Reports",
  "Activity",
  "Notifications",
  "Bug Reports",
  "Newsletter",
  "Subscribers",
  
  // Status & Labels
  "New",
  "Contacted",
  "Qualified",
  "Converted",
  "Closed",
  "Pending",
  "Active",
  "Inactive",
  "Completed",
  "Failed",
  "Sent",
  "Draft",
  "Published",
  "Archived",
  "Verified",
  "Unverified",
  
  // Time & Dates
  "Today",
  "Yesterday",
  "This Week",
  "This Month",
  "This Year",
  "Last 7 Days",
  "Last 30 Days",
  "Last 90 Days",
  "Last 12 Months",
  "All Time",
  "Custom Range",
  "From",
  "To",
  "Date",
  "Time",
  
  // Notifications
  "You have new notifications",
  "Mark all as read",
  "No new notifications",
  "View all notifications",
  "Notification Settings",
  
  // Error Messages
  "An error occurred",
  "Please try again later",
  "Network error",
  "Server error",
  "Not found",
  "Access denied",
  "Session expired",
  "Please log in to continue",
  "Invalid input",
  "Required field",
  "Invalid email address",
  "Invalid phone number",
  "Feature coming soon",
  
  // Footer & Legal
  "Privacy Policy",
  "Terms of Service",
  "Contact Us",
  "About",
  "Help",
  "FAQ",
  "Support",
  "All rights reserved",
  
  // Onboarding / Tour
  "Welcome!",
  "Let's get started",
  "Skip Tour",
  "Next Step",
  "Previous Step",
  "Finish Tour",
  "Step",
  "of",
  
  // Account Page
  "Account Settings",
  "Profile",
  "Email Notifications",
  "Saved Searches",
  "Favorite Properties",
  "Favorite Markets",
  "Subscription",
  "Billing",
  "Change Password",
  "Update Profile",
  "Delete Account",
  
  // Map View
  "Map View",
  "Satellite",
  "Terrain",
  "Street View",
  "Zoom In",
  "Zoom Out",
  "Center Map",
  "Show Listings",
  "Hide Listings",
  "Property Markers",
  
  // Misc UI
  "or",
  "and",
  "Yes",
  "No",
  "OK",
  "Confirm",
  "Are you sure?",
  "This action cannot be undone",
  "Select All",
  "Deselect All",
  "Expand",
  "Collapse",
  "Refresh",
  "Retry",
  "Upload",
  "Drag and drop",
  "Browse files",
  "No data available",
  "Coming soon",
  "Beta",
  "New",
  "Updated",
  "Popular",
  "Recommended",
  "Featured",
  "Premium",
  "Free",
  "per month",
  "per year",
  "Unlimited",
  
  // Newsletter
  "Subscribe to our newsletter",
  "Enter your email",
  "Subscribe",
  "Unsubscribe",
  "Thank you for subscribing!",
  "Stay updated with the latest market insights",
  
  // Bug Reports
  "Report a Bug",
  "Describe the issue",
  "Steps to reproduce",
  "Expected behavior",
  "Actual behavior",
  "Submit Bug Report",
  "Thank you for your feedback!",
  
  // Comparison
  "Compare",
  "Side by Side",
  "Add Property",
  "Add Market",
  "Remove",
  "Difference",
  "Better",
  "Worse",
  "Same",
  "Winner",
  
  // Voice
  "Tap to speak",
  "Listening...",
  "Recording...",
  "Stop recording",
  
  // Regulation Tracker
  "Short-Term Rental Regulations",
  "Permit Required",
  "License Required",
  "Registration Required",
  "No Restrictions",
  "Restricted",
  "Banned",
  "Allowed",
  "Conditional",
  "Check local regulations before investing",
  "Regulation Status",
  "Last Updated",
  "Source",
  "Confidence Level",
];

// Target languages for pre-translation
const TARGET_LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
];

/**
 * Translate a batch of strings using Gemini API
 */
async function translateBatchWithGemini(texts, targetLangName) {
  const textsMap = {};
  texts.forEach((text, i) => {
    textsMap[`s${i}`] = text;
  });

  const systemPrompt = `You are a professional translator. Translate all values in the given JSON object to ${targetLangName}.

Rules:
- Return a valid JSON object with the same keys but translated values
- Preserve all numbers, currency symbols, and units exactly as-is
- Preserve abbreviations like "BR" (bedrooms), "BA" (bathrooms) — translate them to the target language equivalent
- Do NOT translate the JSON keys — only translate the values
- For real estate and financial terminology, use standard terms in the target language
- Keep translations concise — these are UI labels, not paragraphs
- Maintain the same capitalization style as the original`;

  const response = await fetch(
    `${GEMINI_API_URL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(textsMap) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error('No response from Gemini');

  const translated = JSON.parse(responseText);
  const result = [];
  texts.forEach((text, i) => {
    const key = `s${i}`;
    result.push({
      sourceText: text,
      translatedText: translated[key] || text,
    });
  });
  return result;
}

/**
 * Insert translations into the database using raw SQL
 */
async function insertTranslations(entries) {
  // Use mysql2 directly
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(DATABASE_URL);

  let inserted = 0;
  for (const entry of entries) {
    const { createHash } = await import('crypto');
    const hash = createHash('md5').update(entry.sourceText.trim()).digest('hex');
    
    try {
      await connection.execute(
        `INSERT INTO translation_cache (sourceHash, sourceText, targetLang, translatedText, context, hitCount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE translatedText = VALUES(translatedText), updatedAt = NOW()`,
        [hash, entry.sourceText.trim(), entry.targetLang, entry.translatedText.trim(), 'UI string']
      );
      inserted++;
    } catch (err) {
      console.error(`  Failed to insert "${entry.sourceText}":`, err.message);
    }
  }

  await connection.end();
  return inserted;
}

/**
 * Main seed function
 */
async function main() {
  console.log(`\n🌐 Translation Cache Seeder`);
  console.log(`   Strings to translate: ${UI_STRINGS.length}`);
  console.log(`   Target languages: ${TARGET_LANGUAGES.map(l => l.name).join(', ')}`);
  console.log(`   Total translations: ${UI_STRINGS.length * TARGET_LANGUAGES.length}\n`);

  const BATCH_SIZE = 40; // Gemini can handle ~40 short strings per call

  for (const lang of TARGET_LANGUAGES) {
    console.log(`\n📝 Translating to ${lang.name} (${lang.code})...`);
    const allEntries = [];

    for (let i = 0; i < UI_STRINGS.length; i += BATCH_SIZE) {
      const batch = UI_STRINGS.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(UI_STRINGS.length / BATCH_SIZE);
      
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} strings)... `);

      try {
        const results = await translateBatchWithGemini(batch, lang.name);
        for (const r of results) {
          allEntries.push({
            sourceText: r.sourceText,
            targetLang: lang.code,
            translatedText: r.translatedText,
          });
        }
        console.log('✓');
      } catch (err) {
        console.log(`✗ Error: ${err.message}`);
      }

      // Rate limit: wait 500ms between batches
      await new Promise(r => setTimeout(r, 500));
    }

    // Insert all translations for this language
    console.log(`  Inserting ${allEntries.length} translations into database...`);
    const inserted = await insertTranslations(allEntries);
    console.log(`  ✓ Inserted/updated ${inserted} translations for ${lang.name}`);
  }

  console.log(`\n✅ Seeding complete!\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
