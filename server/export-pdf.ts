/**
 * PDF Export Service
 * 
 * Generates professional PDF reports from analysis data
 */

// Use inline type to avoid circular dependency
interface AnalysisData {
  property_estimate?: {
    property: {
      address: string;
      bedrooms: number;
      bathrooms: number;
    };
    estimates: {
      annual_revenue: number;
      annual_revenue_low: number;
      annual_revenue_high: number;
      average_daily_rate: number;
      occupancy_rate: number;
    };
  } | null;
  monthly_rent: number;
  market_details?: {
    name: string;
  };
  property_roi?: {
    annual_profit_realistic: number;
  };
  narrative_report?: {
    executive_summary: string;
    market_overview: string;
    revenue_analysis: string;
    competitive_landscape: string;
    seasonal_strategy: string;
    risk_assessment: string;
    investment_recommendation: string;
  };
  enhanced_narrative_report?: {
    executive_summary: string;
    market_overview: string;
    revenue_analysis: string;
    competitive_landscape: string;
    seasonal_strategy: string;
    risk_assessment: string;
    investment_recommendation: string;
    action_items?: Array<{
      priority: string;
      action: string;
      timeline: string;
    }>;
  };
  ai_analysis?: {
    verdict?: {
      rating: string;
    };
  } | null;
}

interface PDFSection {
  title: string;
  content: string;
}

/**
 * Format currency values
 */
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'N/A';
  return '$' + Math.round(value).toLocaleString();
}

/**
 * Format percentage values
 */
function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'N/A';
  // Handle both decimal (0.75) and percentage (75) formats
  const pct = value > 1 ? value : value * 100;
  return pct.toFixed(1) + '%';
}

/**
 * Generate HTML content for PDF
 */
function generatePDFHTML(analysis: AnalysisData): string {
  const verdict = analysis.ai_analysis?.verdict?.rating || 'PENDING';
  const property = analysis.property_estimate?.property;
  const estimates = analysis.property_estimate?.estimates;
  const narrative = analysis.narrative_report;
  const enhanced = analysis.enhanced_narrative_report;
  
  // Build sections
  const sections: PDFSection[] = [];
  
  // Executive Summary
  if (narrative?.executive_summary || enhanced?.executive_summary) {
    sections.push({
      title: 'Executive Summary',
      content: enhanced?.executive_summary || narrative?.executive_summary || ''
    });
  }
  
  // Market Overview
  if (narrative?.market_overview || enhanced?.market_overview) {
    sections.push({
      title: 'Market Overview',
      content: enhanced?.market_overview || narrative?.market_overview || ''
    });
  }
  
  // Revenue Analysis
  if (narrative?.revenue_analysis || enhanced?.revenue_analysis) {
    sections.push({
      title: 'Revenue Analysis',
      content: enhanced?.revenue_analysis || narrative?.revenue_analysis || ''
    });
  }
  
  // Competitive Landscape
  if (narrative?.competitive_landscape || enhanced?.competitive_landscape) {
    sections.push({
      title: 'Competitive Landscape',
      content: enhanced?.competitive_landscape || narrative?.competitive_landscape || ''
    });
  }
  
  // Seasonal Strategy
  if (narrative?.seasonal_strategy || enhanced?.seasonal_strategy) {
    sections.push({
      title: 'Seasonal Strategy',
      content: enhanced?.seasonal_strategy || narrative?.seasonal_strategy || ''
    });
  }
  
  // Risk Assessment
  if (narrative?.risk_assessment || enhanced?.risk_assessment) {
    sections.push({
      title: 'Risk Assessment',
      content: enhanced?.risk_assessment || narrative?.risk_assessment || ''
    });
  }
  
  // Investment Recommendation
  if (narrative?.investment_recommendation || enhanced?.investment_recommendation) {
    sections.push({
      title: 'Investment Recommendation',
      content: enhanced?.investment_recommendation || narrative?.investment_recommendation || ''
    });
  }
  
  const sectionsHTML = sections.map(s => `
    <div class="section">
      <h2>${s.title}</h2>
      <div class="content">${s.content.replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');
  
  // Action items if available
  let actionItemsHTML = '';
  if (enhanced?.action_items && enhanced.action_items.length > 0) {
    const itemsList = enhanced.action_items.map(item => `
      <li>
        <strong>${item.priority.toUpperCase()}</strong>: ${item.action}
        <br><em>Timeline: ${item.timeline}</em>
      </li>
    `).join('');
    actionItemsHTML = `
      <div class="section">
        <h2>Action Items</h2>
        <ul class="action-items">${itemsList}</ul>
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rental Arbitrage Analysis Report</title>
  <style>
    @page {
      margin: 1in;
      size: letter;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #f97316;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      color: #1e293b;
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    
    .property-info {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .property-info h3 {
      color: #1e293b;
      margin-top: 0;
      margin-bottom: 15px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .info-value.highlight {
      color: #f97316;
    }
    
    .metrics-row {
      display: flex;
      justify-content: space-between;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
      color: white;
    }
    
    .metric {
      text-align: center;
      flex: 1;
    }
    
    .metric-value {
      font-size: 24px;
      font-weight: 700;
    }
    
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 5px;
    }
    
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    
    .section h2 {
      color: #1e293b;
      font-size: 20px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    
    .section .content {
      color: #475569;
      text-align: justify;
    }
    
    .action-items {
      list-style: none;
      padding: 0;
    }
    
    .action-items li {
      background: #fef3c7;
      border-left: 4px solid #f97316;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 0 8px 8px 0;
    }
    
    .footer {
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    
    .verdict {
      background: ${verdict === 'GO' ? '#dcfce7' : verdict === 'NO-GO' ? '#fee2e2' : '#fef3c7'};
      border: 2px solid ${verdict === 'GO' ? '#22c55e' : verdict === 'NO-GO' ? '#ef4444' : '#f59e0b'};
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .verdict-label {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 5px;
    }
    
    .verdict-value {
      font-size: 32px;
      font-weight: 700;
      color: ${verdict === 'GO' ? '#22c55e' : verdict === 'NO-GO' ? '#ef4444' : '#f59e0b'};
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rental Arbitrage Analysis Report</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</div>
  </div>
  
  <div class="property-info">
    <h3>Property Details</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Address</span>
        <span class="info-value">${property?.address || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Configuration</span>
        <span class="info-value">${property?.bedrooms || 0} BR / ${property?.bathrooms || 0} BA</span>
      </div>
      <div class="info-item">
        <span class="info-label">Monthly Rent</span>
        <span class="info-value">${formatCurrency(analysis.monthly_rent)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Market</span>
        <span class="info-value">${analysis.market_details?.name || 'N/A'}</span>
      </div>
    </div>
  </div>
  
  <div class="verdict">
    <div class="verdict-label">Investment Verdict</div>
    <div class="verdict-value">${verdict}</div>
  </div>
  
  <div class="metrics-row">
    <div class="metric">
      <div class="metric-value">${formatCurrency(estimates?.annual_revenue)}</div>
      <div class="metric-label">Est. Annual Revenue</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatCurrency(analysis.property_roi?.annual_profit_realistic)}</div>
      <div class="metric-label">Est. Annual Profit</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatPercent(estimates?.occupancy_rate)}</div>
      <div class="metric-label">Est. Occupancy</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatCurrency(estimates?.average_daily_rate)}</div>
      <div class="metric-label">Est. ADR</div>
    </div>
  </div>
  
  ${sectionsHTML}
  ${actionItemsHTML}
  
  <div class="footer">
    <p>This report was generated by Rental Revenue Calculator powered by AirDNA + AI</p>
    <p>Data is based on market conditions as of ${new Date().toLocaleDateString()}. Past performance does not guarantee future results.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF buffer from analysis data
 */
export async function generatePDFReport(analysis: AnalysisData): Promise<Buffer> {
  const html = generatePDFHTML(analysis);
  
  // Use puppeteer to generate PDF
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF and return as base64 string
 */
export async function generatePDFBase64(analysis: AnalysisData): Promise<string> {
  const buffer = await generatePDFReport(analysis);
  return buffer.toString('base64');
}

export { generatePDFHTML };
