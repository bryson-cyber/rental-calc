import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DISCLAIMER_TEXT } from '@/components/ReportDisclaimer';

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface Comp {
  title: string;
  bedrooms: number;
  bathrooms: number;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
}

interface PropertyEstimate {
  property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
  };
  estimates: {
    annual_revenue: number;
    annual_revenue_low: number;
    annual_revenue_high: number;
    average_daily_rate: number;
    occupancy_rate: number;
  };
  monthly_forecast: MonthlyForecast[];
  comps: Comp[];
}

interface MarketData {
  id: string;
  name: string;
  listing_count: number;
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
    active_listings: number;
  };
}

interface BedroomPerformance {
  bedrooms: number;
  revenue: number;
  adr: number;
  occupancy: number;
  listing_count: number;
}

interface ListingData {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
}

interface ReportData {
  property: PropertyEstimate;
  market: MarketData | null;
  bedroom_performance: BedroomPerformance[];
  same_bedroom_comps?: ListingData[];
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  // Handle both decimal (0.62) and whole number (62) formats
  const pct = value > 1 ? value : value * 100;
  return `${Math.round(pct)}%`;
};

export const generateRentalReportPdf = (data: ReportData): void => {
  const { property, market, bedroom_performance, same_bedroom_comps } = data;
  const { property: propertyInfo, estimates, monthly_forecast, comps } = property;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // Colors
  const navy = [15, 23, 42] as [number, number, number];
  const gold = [201, 169, 98] as [number, number, number];
  const green = [22, 101, 52] as [number, number, number];
  const gray = [100, 116, 139] as [number, number, number];

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  // ===== HEADER =====
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Rental Analysis Report', margin, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gold);
  doc.text(propertyInfo.address, margin, 35);
  
  doc.setTextColor(200, 200, 200);
  doc.text(
    `${propertyInfo.bedrooms} BR • ${propertyInfo.bathrooms} BA • Sleeps ${propertyInfo.accommodates}${market ? ` • ${market.name} Market` : ''}`,
    margin,
    43
  );

  yPos = 65;

  // ===== SECTION 1: REVENUE POTENTIAL =====
  doc.setTextColor(...green);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('What This Property Could Earn', margin, yPos);
  yPos += 12;

  // Revenue boxes
  const boxWidth = (pageWidth - margin * 2 - 20) / 3;
  const boxHeight = 35;
  
  // Annual Revenue
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text('ANNUAL REVENUE', margin + 5, yPos + 10);
  doc.setTextColor(...green);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(estimates.annual_revenue), margin + 5, yPos + 22);
  doc.setTextColor(...gray);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Range: ${formatCurrency(estimates.annual_revenue_low)} - ${formatCurrency(estimates.annual_revenue_high)}`, margin + 5, yPos + 30);

  // Monthly Average
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + boxWidth + 10, yPos, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text('MONTHLY AVERAGE', margin + boxWidth + 15, yPos + 10);
  doc.setTextColor(...navy);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(Math.round(estimates.annual_revenue / 12)), margin + boxWidth + 15, yPos + 22);
  doc.setTextColor(...gray);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Per month', margin + boxWidth + 15, yPos + 30);

  // Nightly Rate
  doc.setFillColor(254, 249, 235);
  doc.roundedRect(margin + (boxWidth + 10) * 2, yPos, boxWidth, boxHeight, 3, 3, 'F');
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text('AVG. NIGHTLY RATE', margin + (boxWidth + 10) * 2 + 5, yPos + 10);
  doc.setTextColor(...gold);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(estimates.average_daily_rate), margin + (boxWidth + 10) * 2 + 5, yPos + 22);
  doc.setTextColor(...gray);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatPercent(estimates.occupancy_rate)} occupancy`, margin + (boxWidth + 10) * 2 + 5, yPos + 30);

  yPos += boxHeight + 15;

  // ===== SECTION 2: MONTHLY FORECAST =====
  checkPageBreak(80);
  
  doc.setTextColor(...navy);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Month-by-Month Forecast', margin, yPos);
  yPos += 10;

  if (monthly_forecast.length > 0) {
    const monthlyData = monthly_forecast.map(m => [
      m.month,
      formatCurrency(m.revenue),
      formatCurrency(m.adr),
      formatPercent(m.occupancy)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Month', 'Revenue', 'ADR', 'Occupancy']],
      body: monthlyData,
      theme: 'striped',
      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // ===== SECTION 3: MARKET OVERVIEW =====
  if (market) {
    checkPageBreak(60);
    
    doc.setTextColor(...gold);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${market.name} Market Overview`, margin, yPos);
    yPos += 12;

    const marketBoxWidth = (pageWidth - margin * 2 - 30) / 4;
    const marketBoxHeight = 30;

    // Occupancy
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, marketBoxWidth, marketBoxHeight, 3, 3, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.text('AVG. OCCUPANCY', margin + 5, yPos + 10);
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatPercent(market.metrics.occupancy), margin + 5, yPos + 22);

    // ADR
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + marketBoxWidth + 10, yPos, marketBoxWidth, marketBoxHeight, 3, 3, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('AVG. DAILY RATE', margin + marketBoxWidth + 15, yPos + 10);
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(market.metrics.adr), margin + marketBoxWidth + 15, yPos + 22);

    // Revenue
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + (marketBoxWidth + 10) * 2, yPos, marketBoxWidth, marketBoxHeight, 3, 3, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('AVG. REVENUE', margin + (marketBoxWidth + 10) * 2 + 5, yPos + 10);
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(market.metrics.revenue), margin + (marketBoxWidth + 10) * 2 + 5, yPos + 22);

    // Active Listings
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + (marketBoxWidth + 10) * 3, yPos, marketBoxWidth, marketBoxHeight, 3, 3, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('ACTIVE LISTINGS', margin + (marketBoxWidth + 10) * 3 + 5, yPos + 10);
    doc.setTextColor(...navy);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(market.metrics.active_listings.toLocaleString(), margin + (marketBoxWidth + 10) * 3 + 5, yPos + 22);

    yPos += marketBoxHeight + 15;
  }

  // ===== SECTION 4: BEDROOM PERFORMANCE =====
  if (bedroom_performance && bedroom_performance.length > 0) {
    checkPageBreak(60);
    
    doc.setTextColor(...navy);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance by Bedroom Count', margin, yPos);
    yPos += 10;

    const bedroomData = bedroom_performance.map(bp => {
      const isUserProperty = bp.bedrooms === propertyInfo.bedrooms;
      return [
        `${bp.bedrooms} BR${isUserProperty ? ' (Your Property)' : ''}`,
        formatCurrency(bp.revenue),
        formatCurrency(bp.adr),
        formatPercent(bp.occupancy)
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Bedrooms', 'Avg. Revenue', 'Avg. ADR', 'Occupancy']],
      body: bedroomData,
      theme: 'striped',
      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Highlight user's property row
        if (data.row.index !== undefined && bedroom_performance[data.row.index]?.bedrooms === propertyInfo.bedrooms) {
          data.cell.styles.fillColor = [254, 249, 235];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // ===== SECTION 5: SAME BEDROOM COMPS (Apples-to-Apples) =====
  const compsToShow = same_bedroom_comps && same_bedroom_comps.length > 0 ? same_bedroom_comps : comps;
  
  if (compsToShow && compsToShow.length > 0) {
    checkPageBreak(80);
    
    doc.setTextColor(...navy);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const compTitle = same_bedroom_comps && same_bedroom_comps.length > 0 
      ? `Top ${propertyInfo.bedrooms}-Bedroom Properties Nearby`
      : 'Top Performing Properties Nearby';
    doc.text(compTitle, margin, yPos);
    yPos += 10;

    const compData = compsToShow.slice(0, 8).map((comp, idx) => [
      `#${idx + 1}`,
      comp.title.length > 35 ? comp.title.substring(0, 35) + '...' : comp.title,
      `${comp.bedrooms} BR / ${comp.bathrooms} BA`,
      formatCurrency(comp.annual_revenue),
      formatCurrency(comp.adr),
      formatPercent(comp.occupancy)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Rank', 'Property', 'Size', 'Annual Revenue', 'ADR', 'Occupancy']],
      body: compData,
      theme: 'striped',
      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 55 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
      },
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // ===== FOOTER / CTA =====
  checkPageBreak(50);
  
  doc.setFillColor(...navy);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 45, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ready to Turn This Into Reality?', margin + 10, yPos + 15);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(
    'We handle everything for you — from finding the right property to getting it fully',
    margin + 10,
    yPos + 25
  );
  doc.text(
    'furnished and listed. You just collect the income.',
    margin + 10,
    yPos + 32
  );
  
  doc.setTextColor(...gold);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Schedule a call to get started →', margin + 10, yPos + 40);

  // === Disclaimer Page ===
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLAIMER', margin, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER_TEXT.replace('DISCLAIMER: ', ''), pageWidth - margin * 2);
  doc.text(disclaimerLines, margin, 40);

  // Generate filename and save
  const addressSlug = propertyInfo.address
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);
  const filename = `rental-analysis-${addressSlug}.pdf`;
  
  doc.save(filename);
};
