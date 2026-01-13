import type { SavedMarket, SavedProperty } from '@/hooks/useSavedItems';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export async function exportSavedItemsToPdf(
  savedMarkets: SavedMarket[],
  savedProperties: SavedProperty[]
) {
  // Dynamically import jspdf to avoid SSR issues
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;
  
  // Helper function to add new page if needed
  const checkNewPage = (height: number) => {
    if (yPos + height > 270) {
      doc.addPage();
      yPos = 20;
    }
  };
  
  // Helper function to wrap text
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };
  
  // Title
  doc.setFontSize(24);
  doc.setTextColor(139, 92, 42); // Gold color
  doc.text('Rental Analysis Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  
  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;
  
  // Summary
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text(`Total Saved: ${savedMarkets.length} Markets, ${savedProperties.length} Properties`, margin, yPos);
  yPos += 15;
  
  // Saved Markets Section
  if (savedMarkets.length > 0) {
    checkNewPage(30);
    
    // Section header
    doc.setFillColor(139, 92, 42);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Saved Markets', margin + 5, yPos + 2);
    yPos += 15;
    
    // Markets list
    savedMarkets.forEach((market, index) => {
      // Calculate card height based on notes
      const hasNotes = market.notes && market.notes.trim().length > 0;
      let cardHeight = 28;
      let noteLines: string[] = [];
      
      if (hasNotes) {
        doc.setFontSize(9);
        noteLines = wrapText(market.notes!, pageWidth - margin * 2 - 20);
        cardHeight += 10 + (noteLines.length * 5);
      }
      
      checkNewPage(cardHeight + 10);
      
      // Market card background
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, yPos - 3, pageWidth - margin * 2, cardHeight, 3, 3, 'F');
      
      // Market name
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(`${index + 1}. ${market.name}, ${market.state}`, margin + 5, yPos + 5);
      
      // Market stats
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Average Revenue: ${formatCurrency(market.avgRevenue)}/year`, margin + 5, yPos + 13);
      doc.text(`Average Occupancy: ${Math.round(market.avgOccupancy)}%`, margin + 5, yPos + 20);
      
      // Saved date
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Saved: ${formatDate(market.savedAt)}`, pageWidth - margin - 40, yPos + 5);
      
      // Notes
      if (hasNotes) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('📝 Notes:', margin + 5, yPos + 28);
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        noteLines.forEach((line, lineIndex) => {
          doc.text(line, margin + 20, yPos + 33 + (lineIndex * 5));
        });
      }
      
      yPos += cardHeight + 5;
    });
    
    yPos += 10;
  }
  
  // Saved Properties Section
  if (savedProperties.length > 0) {
    checkNewPage(30);
    
    // Section header
    doc.setFillColor(59, 130, 246); // Blue color
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Saved Properties', margin + 5, yPos + 2);
    yPos += 15;
    
    // Properties list
    savedProperties.forEach((property, index) => {
      // Calculate card height based on notes
      const hasNotes = property.notes && property.notes.trim().length > 0;
      let cardHeight = 38;
      let noteLines: string[] = [];
      
      if (hasNotes) {
        doc.setFontSize(9);
        noteLines = wrapText(property.notes!, pageWidth - margin * 2 - 20);
        cardHeight += 10 + (noteLines.length * 5);
      }
      
      checkNewPage(cardHeight + 10);
      
      // Property card background
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, yPos - 3, pageWidth - margin * 2, cardHeight, 3, 3, 'F');
      
      // Property title (truncated if too long)
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const truncatedTitle = property.title.length > 50 
        ? property.title.substring(0, 50) + '...' 
        : property.title;
      doc.text(`${index + 1}. ${truncatedTitle}`, margin + 5, yPos + 5);
      
      // Property details
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Location: ${property.address}`, margin + 5, yPos + 13);
      doc.text(`Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms}`, margin + 5, yPos + 20);
      
      // Financial stats
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`Revenue: ${formatCurrency(property.revenue)}/year`, margin + 5, yPos + 28);
      doc.setTextColor(80, 80, 80);
      doc.text(`ADR: ${formatCurrency(property.adr)}/night | Occupancy: ${Math.round(property.occupancy)}%`, margin + 90, yPos + 28);
      
      // Saved date
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Saved: ${formatDate(property.savedAt)}`, pageWidth - margin - 40, yPos + 5);
      
      // Notes
      if (hasNotes) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('📝 Notes:', margin + 5, yPos + 36);
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        noteLines.forEach((line, lineIndex) => {
          doc.text(line, margin + 20, yPos + 41 + (lineIndex * 5));
        });
      }
      
      yPos += cardHeight + 5;
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Generated by Rental Revenue Calculator`,
      pageWidth / 2,
      285,
      { align: 'center' }
    );
  }
  
  // Save the PDF
  doc.save('rental-analysis-report.pdf');
}
