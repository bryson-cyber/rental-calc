/**
 * Lease Reader & Addendum Maker
 * 
 * Uses Claude Vision to analyze rental leases for Airbnb arbitrage compatibility.
 * Generates professional addendums as PDF and email/text format.
 */

import { callLLMWithVision, callLLM, type VisionContent } from './llm-provider';
import { storagePut } from './storage';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface LeaseAnalysis {
  // Overall assessment
  overallGrade: string; // A+, A, B+, B, C+, C, D, F
  overallScore: number; // 0-100
  arbitrageFriendliness: 'Highly Favorable' | 'Favorable' | 'Neutral' | 'Unfavorable' | 'Highly Unfavorable';
  summaryVerdict: string; // One-line plain English verdict
  
  // Key lease terms
  keyTerms: {
    leaseDuration: string;
    monthlyRent: string;
    securityDeposit: string;
    leaseStartDate: string;
    leaseEndDate: string;
    landlordName: string;
    propertyAddress: string;
    tenantName: string;
  };
  
  // Clause analysis
  clauses: {
    subletting: {
      status: 'Allowed' | 'Prohibited' | 'Silent' | 'Requires Permission';
      details: string;
      riskLevel: 'Low' | 'Medium' | 'High';
      exactText: string; // Quoted text from lease
    };
    shortTermRental: {
      status: 'Allowed' | 'Prohibited' | 'Silent' | 'Requires Permission';
      details: string;
      riskLevel: 'Low' | 'Medium' | 'High';
      exactText: string;
    };
    assignment: {
      status: 'Allowed' | 'Prohibited' | 'Silent' | 'Requires Permission';
      details: string;
      riskLevel: 'Low' | 'Medium' | 'High';
      exactText: string;
    };
    guestPolicy: {
      status: 'Restrictive' | 'Moderate' | 'Permissive' | 'Silent';
      details: string;
      riskLevel: 'Low' | 'Medium' | 'High';
      exactText: string;
    };
    earlyTermination: {
      penalty: string;
      noticePeriod: string;
      details: string;
    };
    insurance: {
      required: boolean;
      details: string;
    };
    modifications: {
      allowed: boolean;
      details: string;
    };
  };
  
  // Red flags
  redFlags: Array<{
    title: string;
    description: string;
    severity: 'Critical' | 'Warning' | 'Info';
    recommendation: string;
  }>;
  
  // Green flags
  greenFlags: Array<{
    title: string;
    description: string;
  }>;
  
  // Recommendations
  recommendations: Array<{
    priority: 'High' | 'Medium' | 'Low';
    action: string;
    reason: string;
  }>;
  
  // Addendum suggestions
  addendumPoints: Array<{
    clause: string;
    suggestedLanguage: string;
    reason: string;
  }>;
}

export interface AddendumOutput {
  // The full addendum text (formatted for PDF)
  formalText: string;
  // Email version to send to landlord
  emailVersion: {
    subject: string;
    body: string;
  };
  // SMS/text version (shorter)
  textVersion: string;
}

// ---------------------------------------------------------------------------
// LEASE ANALYSIS (Claude Vision)
// ---------------------------------------------------------------------------

const LEASE_ANALYSIS_SYSTEM_PROMPT = `You are an expert real estate attorney and Airbnb arbitrage consultant. You analyze rental leases to determine their compatibility with short-term rental (Airbnb/VRBO) arbitrage operations.

Your analysis must be thorough, accurate, and actionable. You are helping a beginner who wants to rent a property and list it on Airbnb for short-term rentals.

IMPORTANT RULES:
- Quote exact text from the lease when referencing specific clauses
- If a clause is not found, say "Not found in lease" — do not make assumptions
- Grade conservatively — it's better to warn about a potential issue than miss it
- Use plain English that a complete beginner would understand
- Focus on what matters for Airbnb arbitrage specifically`;

const LEASE_ANALYSIS_PROMPT = `Analyze this rental lease document for Airbnb arbitrage compatibility. Extract all relevant information and return a JSON response.

You MUST return ONLY valid JSON matching this exact structure (no markdown, no code blocks, just raw JSON):

{
  "overallGrade": "B+",
  "overallScore": 72,
  "arbitrageFriendliness": "Favorable",
  "summaryVerdict": "One sentence plain English summary",
  "keyTerms": {
    "leaseDuration": "12 months",
    "monthlyRent": "$1,500",
    "securityDeposit": "$1,500",
    "leaseStartDate": "Jan 1, 2026",
    "leaseEndDate": "Dec 31, 2026",
    "landlordName": "John Smith",
    "propertyAddress": "123 Main St, City, ST 12345",
    "tenantName": "Jane Doe"
  },
  "clauses": {
    "subletting": {
      "status": "Requires Permission",
      "details": "Plain English explanation",
      "riskLevel": "Medium",
      "exactText": "Quoted text from lease or 'Not found in lease'"
    },
    "shortTermRental": {
      "status": "Silent",
      "details": "Plain English explanation",
      "riskLevel": "Medium",
      "exactText": "Quoted text from lease or 'Not found in lease'"
    },
    "assignment": {
      "status": "Prohibited",
      "details": "Plain English explanation",
      "riskLevel": "Low",
      "exactText": "Quoted text from lease or 'Not found in lease'"
    },
    "guestPolicy": {
      "status": "Moderate",
      "details": "Plain English explanation",
      "riskLevel": "Low",
      "exactText": "Quoted text from lease or 'Not found in lease'"
    },
    "earlyTermination": {
      "penalty": "$X or X months rent",
      "noticePeriod": "30 days",
      "details": "Plain English explanation"
    },
    "insurance": {
      "required": true,
      "details": "Plain English explanation"
    },
    "modifications": {
      "allowed": false,
      "details": "Plain English explanation"
    }
  },
  "redFlags": [
    {
      "title": "Short title",
      "description": "What the issue is in plain English",
      "severity": "Critical",
      "recommendation": "What to do about it"
    }
  ],
  "greenFlags": [
    {
      "title": "Short title",
      "description": "Why this is good for arbitrage"
    }
  ],
  "recommendations": [
    {
      "priority": "High",
      "action": "What to do",
      "reason": "Why"
    }
  ],
  "addendumPoints": [
    {
      "clause": "Which clause this addresses",
      "suggestedLanguage": "The exact legal language to add to the addendum",
      "reason": "Why this is needed in plain English"
    }
  ]
}

GRADING SCALE:
- A+ (90-100): Lease explicitly allows short-term rentals or subletting
- A (80-89): Lease is silent on STR with no restrictive clauses
- B+ (70-79): Lease requires permission but has no prohibitions
- B (60-69): Some restrictions but workable with an addendum
- C+ (50-59): Significant restrictions, addendum essential
- C (40-49): Multiple red flags, high risk without major modifications
- D (25-39): Lease is hostile to arbitrage, major negotiation needed
- F (0-24): Lease explicitly prohibits all relevant activities

Analyze the lease thoroughly and return the JSON.`;

export async function analyzeLeaseDocument(
  fileUrl: string,
  fileType: 'pdf' | 'image'
): Promise<LeaseAnalysis> {
  console.log(`[LeaseReader] Analyzing lease document: ${fileType} from ${fileUrl.substring(0, 80)}...`);
  
  // Build vision content based on file type
  const visionContent: VisionContent[] = [];
  
  if (fileType === 'pdf') {
    // For PDFs, we need to fetch and convert to base64
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch lease document: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Claude supports PDF via base64 with document type
    // We'll send as a document content block
    visionContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    });
  } else {
    // For images, use URL directly
    visionContent.push({
      type: 'image',
      source: {
        type: 'url',
        url: fileUrl,
      },
    });
  }
  
  const result = await callLLMWithVision(
    LEASE_ANALYSIS_PROMPT,
    visionContent,
    {
      model: 'pro',
      maxTokens: 16384,
      thinkingLevel: 'high',
      systemPrompt: LEASE_ANALYSIS_SYSTEM_PROMPT,
    }
  );
  
  // Parse JSON response
  let analysis: LeaseAnalysis;
  try {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    analysis = JSON.parse(jsonStr);
    console.log(`[LeaseReader] Analysis complete. Grade: ${analysis.overallGrade}, Score: ${analysis.overallScore}`);
  } catch (parseError) {
    console.error('[LeaseReader] Failed to parse analysis JSON:', parseError);
    console.error('[LeaseReader] Raw response:', result.substring(0, 500));
    throw new Error('Failed to parse lease analysis. Please try again.');
  }
  
  return analysis;
}

// ---------------------------------------------------------------------------
// ADDENDUM GENERATION
// ---------------------------------------------------------------------------

const ADDENDUM_SYSTEM_PROMPT = `You are an expert real estate attorney who specializes in creating lease addendums for Airbnb arbitrage operators. You write clear, professional, legally-sound addendums that protect both the tenant and landlord.

Your addendums should be:
- Professional and legally formatted
- Clear and easy to understand
- Protective of both parties
- Specific to the lease terms analyzed
- Compliant with standard real estate practices`;

export async function generateAddendum(
  analysis: LeaseAnalysis,
  tenantInfo: {
    name: string;
    email?: string;
    phone?: string;
  }
): Promise<AddendumOutput> {
  console.log(`[LeaseReader] Generating addendum for ${analysis.keyTerms.propertyAddress}`);
  
  const addendumPrompt = `Based on the following lease analysis, generate three versions of a lease addendum requesting permission for short-term rental (Airbnb/VRBO) use.

LEASE ANALYSIS:
- Property: ${analysis.keyTerms.propertyAddress}
- Landlord: ${analysis.keyTerms.landlordName}
- Tenant: ${tenantInfo.name || analysis.keyTerms.tenantName}
- Monthly Rent: ${analysis.keyTerms.monthlyRent}
- Lease Duration: ${analysis.keyTerms.leaseDuration}
- Overall Grade: ${analysis.overallGrade}
- Subletting Status: ${analysis.clauses.subletting.status}
- STR Status: ${analysis.clauses.shortTermRental.status}

SPECIFIC ADDENDUM POINTS TO ADDRESS:
${analysis.addendumPoints.map((p, i) => `${i + 1}. ${p.clause}: ${p.suggestedLanguage} (Reason: ${p.reason})`).join('\n')}

RED FLAGS TO MITIGATE:
${analysis.redFlags.map((f, i) => `${i + 1}. ${f.title}: ${f.recommendation}`).join('\n')}

Return ONLY valid JSON (no markdown, no code blocks) with this structure:

{
  "formalText": "The full formal addendum text with proper legal formatting. Use \\n for line breaks. Include: title, date line, parties, recitals, numbered sections for each clause, signature blocks. Make it professional and complete.",
  "emailVersion": {
    "subject": "Email subject line",
    "body": "Professional email body to send to the landlord requesting the addendum be signed. Friendly but professional tone. Include key points from the addendum. Use \\n for line breaks."
  },
  "textVersion": "A shorter SMS-friendly version (under 500 characters) that introduces the request and asks the landlord to check their email for the full addendum."
}

ADDENDUM REQUIREMENTS:
1. Title: "LEASE ADDENDUM - SHORT-TERM RENTAL AUTHORIZATION"
2. Reference the original lease date and property address
3. Include sections for:
   - Permission for short-term rental platforms (Airbnb, VRBO, etc.)
   - Guest screening and vetting procedures
   - Liability insurance commitment (minimum $1M coverage)
   - Noise and nuisance prevention measures
   - Property maintenance standards
   - Communication protocol with landlord
   - Revenue sharing if applicable (suggest 5-10% as negotiation starting point)
   - Termination of addendum provisions
4. Signature blocks for both parties with date lines
5. Professional legal language but readable

EMAIL REQUIREMENTS:
1. Warm, professional tone
2. Introduce yourself and the concept briefly
3. Highlight the benefits to the landlord (guaranteed rent, property care, insurance)
4. Mention the attached addendum
5. Request a meeting or call to discuss

TEXT/SMS REQUIREMENTS:
1. Under 500 characters
2. Friendly and brief
3. Reference the email with full details
4. Ask for a good time to discuss`;

  const result = await callLLM(addendumPrompt, {
    model: 'pro',
    maxTokens: 16384,
    thinkingLevel: 'high',
    systemPrompt: ADDENDUM_SYSTEM_PROMPT,
  });
  
  // Parse JSON response
  let addendum: AddendumOutput;
  try {
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    addendum = JSON.parse(jsonStr);
    console.log(`[LeaseReader] Addendum generated successfully`);
  } catch (parseError) {
    console.error('[LeaseReader] Failed to parse addendum JSON:', parseError);
    console.error('[LeaseReader] Raw response:', result.substring(0, 500));
    throw new Error('Failed to generate addendum. Please try again.');
  }
  
  return addendum;
}

// ---------------------------------------------------------------------------
// PDF GENERATION (HTML → PDF via built-in API)
// ---------------------------------------------------------------------------

export async function generateAddendumPdf(
  addendum: AddendumOutput,
  analysis: LeaseAnalysis
): Promise<{ url: string; key: string }> {
  console.log(`[LeaseReader] Generating PDF for addendum...`);
  
  // Build HTML for the addendum
  const html = buildAddendumHtml(addendum.formalText, analysis);
  
  // Convert HTML to PDF using the built-in approach: store as HTML, let client render
  // For now, store the HTML and let the frontend handle PDF generation via browser print
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const fileKey = `lease-addendums/addendum-${timestamp}-${randomSuffix}.html`;
  
  const { url, key } = await storagePut(fileKey, html, 'text/html');
  console.log(`[LeaseReader] Addendum HTML stored at: ${url}`);
  
  return { url, key };
}

function buildAddendumHtml(formalText: string, analysis: LeaseAnalysis): string {
  const lines = formalText.split('\n');
  const formattedContent = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<br/>';
    // Detect section headers (numbered or all caps)
    if (/^\d+\./.test(trimmed) || /^SECTION \d+/i.test(trimmed) || /^[A-Z\s]{10,}$/.test(trimmed)) {
      return `<p style="font-weight:bold; margin-top:16px; margin-bottom:4px;">${trimmed}</p>`;
    }
    // Detect signature lines
    if (trimmed.startsWith('___') || trimmed.startsWith('---')) {
      return `<p style="margin-top:24px; border-top:1px solid #000; width:60%; padding-top:4px;">${trimmed.replace(/[_-]+/g, '').trim() || '&nbsp;'}</p>`;
    }
    return `<p style="margin:4px 0; line-height:1.6;">${trimmed}</p>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lease Addendum - ${analysis.keyTerms.propertyAddress}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Crimson Pro', 'Times New Roman', serif;
      font-size: 13pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
      background: #fff;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      color: #555;
    }
    
    .content {
      margin-bottom: 32px;
    }
    
    .footer {
      margin-top: 48px;
      font-family: 'Inter', sans-serif;
      font-size: 9pt;
      color: #888;
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 12px;
    }
    
    @media print {
      body { padding: 0.75in; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lease Addendum</h1>
    <div class="subtitle">Short-Term Rental Authorization | ${analysis.keyTerms.propertyAddress}</div>
  </div>
  
  <div class="content">
    ${formattedContent}
  </div>
  
  <div class="footer">
    Generated by Coach Inayah Turnkey Tool | This document should be reviewed by a licensed attorney before execution
  </div>
  
  <div class="no-print" style="margin-top:32px; text-align:center;">
    <button onclick="window.print()" style="padding:12px 32px; background:#0F172A; color:#fff; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>`;
}
