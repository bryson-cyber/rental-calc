import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DISCLAIMER_TEXT } from '@/components/ReportDisclaimer';

interface MarketData {
  name: string;
  state?: string;
  avgRevenue?: number;
  avgOccupancy?: number;
  avgAdr?: number;
  propertyCount?: number;
  medianRevenue?: number;
  topPerformerRevenue?: number;
}

interface ExportOptions {
  title?: string;
  subtitle?: string;
  includeDate?: boolean;
  includeBranding?: boolean;
}

// Format currency
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format percentage
const formatPercent = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A';
  return `${Math.round(value * 100)}%`;
};

// Brand colors
const COLORS = {
  primary: [15, 23, 42] as [number, number, number], // Navy #0F172A
  accent: [201, 169, 98] as [number, number, number], // Gold #C9A962
  text: [51, 51, 51] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/**
 * Export market comparison data to PDF
 */
export function exportMarketComparisonPDF(
  markets: MarketData[],
  options: ExportOptions = {}
): void {
  const {
    title = 'Market Comparison Report',
    subtitle = 'Rental Revenue Analysis',
    includeDate = true,
    includeBranding = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, yPosition + 5);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, yPosition + 15);

  // Date
  if (includeDate) {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, yPosition + 25);
  }

  yPosition = 55;

  // Summary section
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Markets Compared: ${markets.length}`, 14, yPosition);
  yPosition += 6;

  if (markets.length > 0) {
    const avgRevenues = markets
      .filter(m => m.avgRevenue !== undefined)
      .map(m => m.avgRevenue!);
    if (avgRevenues.length > 0) {
      const overallAvg = avgRevenues.reduce((a, b) => a + b, 0) / avgRevenues.length;
      const highestRevenue = Math.max(...avgRevenues);
      const lowestRevenue = Math.min(...avgRevenues);
      
      doc.text(`Average Revenue (across markets): ${formatCurrency(overallAvg)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Highest Market Average: ${formatCurrency(highestRevenue)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Lowest Market Average: ${formatCurrency(lowestRevenue)}`, 14, yPosition);
      yPosition += 6;
    }
  }

  yPosition += 10;

  // Market comparison table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Market Details', 14, yPosition);
  yPosition += 5;

  const tableData = markets.map(market => [
    market.name + (market.state ? `, ${market.state}` : ''),
    formatCurrency(market.avgRevenue),
    formatPercent(market.avgOccupancy),
    formatCurrency(market.avgAdr),
    market.propertyCount?.toString() || 'N/A',
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Market', 'Avg Revenue', 'Occupancy', 'ADR', 'Properties']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Get the final Y position after the table
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition + 50;

  // Branding footer
  if (includeBranding) {
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, footerY - 5, pageWidth, 20, 'F');
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Free Tools by Coach Inayah', 14, footerY + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Rental Revenue Calculator - Your Path to Rental Riches', 14, footerY + 9);
  }

  // Save the PDF
  const filename = `market-comparison-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export favorites list to PDF
 */
export function exportFavoritesPDF(
  favorites: MarketData[],
  options: ExportOptions = {}
): void {
  const {
    title = 'My Favorite Markets',
    subtitle = 'Saved Markets Report',
    includeDate = true,
    includeBranding = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, yPosition + 5);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, yPosition + 15);

  // Date
  if (includeDate) {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, yPosition + 25);
  }

  yPosition = 55;

  // Summary stats
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Portfolio Summary', 14, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Saved Markets: ${favorites.length}`, 14, yPosition);
  yPosition += 6;

  if (favorites.length > 0) {
    const avgRevenues = favorites
      .filter(m => m.avgRevenue !== undefined)
      .map(m => m.avgRevenue!);
    if (avgRevenues.length > 0) {
      const portfolioAvg = avgRevenues.reduce((a, b) => a + b, 0) / avgRevenues.length;
      doc.text(`Portfolio Average Revenue: ${formatCurrency(portfolioAvg)}`, 14, yPosition);
      yPosition += 6;
    }

    const avgOccupancies = favorites
      .filter(m => m.avgOccupancy !== undefined)
      .map(m => m.avgOccupancy!);
    if (avgOccupancies.length > 0) {
      const portfolioOcc = avgOccupancies.reduce((a, b) => a + b, 0) / avgOccupancies.length;
      doc.text(`Portfolio Average Occupancy: ${formatPercent(portfolioOcc)}`, 14, yPosition);
      yPosition += 6;
    }
  }

  yPosition += 10;

  // Favorites table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Saved Markets', 14, yPosition);
  yPosition += 5;

  const tableData = favorites.map(market => [
    market.name + (market.state ? `, ${market.state}` : ''),
    formatCurrency(market.avgRevenue),
    formatPercent(market.avgOccupancy),
    formatCurrency(market.avgAdr),
    formatCurrency(market.topPerformerRevenue),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Market', 'Avg Revenue', 'Occupancy', 'ADR', 'Top Performer']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Branding footer
  if (includeBranding) {
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, footerY - 5, pageWidth, 20, 'F');
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Free Tools by Coach Inayah', 14, footerY + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Rental Revenue Calculator - Your Path to Rental Riches', 14, footerY + 9);
  }

  // Save the PDF
  const filename = `my-favorites-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * Export single market detail to PDF
 */
export function exportMarketDetailPDF(
  market: MarketData & {
    listings?: Array<{
      title: string;
      bedrooms: number;
      bathrooms: number;
      revenue: number;
      occupancy: number;
      adr: number;
      rating?: number;
    }>;
  },
  options: ExportOptions = {}
): void {
  const {
    title = market.name,
    subtitle = 'Market Analysis Report',
    includeDate = true,
    includeBranding = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title + (market.state ? `, ${market.state}` : ''), 14, yPosition + 5);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, yPosition + 15);

  // Date
  if (includeDate) {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, yPosition + 25);
  }

  yPosition = 55;

  // Key metrics section
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', 14, yPosition);
  yPosition += 10;

  // Metrics boxes
  const metrics = [
    { label: 'Avg Revenue', value: formatCurrency(market.avgRevenue) },
    { label: 'Occupancy', value: formatPercent(market.avgOccupancy) },
    { label: 'ADR', value: formatCurrency(market.avgAdr) },
    { label: 'Properties', value: market.propertyCount?.toString() || 'N/A' },
  ];

  const boxWidth = 42;
  const boxHeight = 25;
  const startX = 14;

  metrics.forEach((metric, index) => {
    const x = startX + index * (boxWidth + 5);
    
    // Box background
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(x, yPosition, boxWidth, boxHeight, 2, 2, 'F');
    
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(metric.label, x + 3, yPosition + 8);
    
    // Value
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(metric.value, x + 3, yPosition + 18);
  });

  yPosition += boxHeight + 15;

  // Top listings table (if available)
  if (market.listings && market.listings.length > 0) {
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Performing Listings', 14, yPosition);
    yPosition += 5;

    const listingData = market.listings.slice(0, 10).map(listing => [
      listing.title.substring(0, 35) + (listing.title.length > 35 ? '...' : ''),
      `${listing.bedrooms}/${listing.bathrooms}`,
      formatCurrency(listing.revenue),
      formatPercent(listing.occupancy),
      listing.rating?.toFixed(1) || 'N/A',
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Property', 'BR/BA', 'Revenue', 'Occ', 'Rating']],
      body: listingData,
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.text,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightGray,
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Branding footer
  if (includeBranding) {
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, footerY - 5, pageWidth, 20, 'F');
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Free Tools by Coach Inayah', 14, footerY + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Rental Revenue Calculator - Your Path to Rental Riches', 14, footerY + 9);
  }

  // === Disclaimer Page ===
  doc.addPage();
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLAIMER', 14, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER_TEXT.replace('DISCLAIMER: ', ''), pageWidth - 28);
  doc.text(disclaimerLines, 14, 35);

  // Save the PDF
  const safeName = market.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `${safeName}-report-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
