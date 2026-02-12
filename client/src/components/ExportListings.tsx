/**
 * ExportListings - Export listings data to CSV or Excel format
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Listing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  revenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  latitude: number;
  longitude: number;
  airbnbUrl: string;
  thumbnailUrl?: string | null;
  propertyType?: string;
  distanceToMyProperty?: number;
}

interface ExportListingsProps {
  listings: Listing[];
  locationName?: string;
  filters?: {
    bedrooms?: string;
    propertyType?: string;
    distance?: string;
  };
  className?: string;
}

export function ExportListings({
  listings,
  locationName = 'listings',
  filters,
  className = '',
}: ExportListingsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const formatFilename = (extension: string) => {
    const date = new Date().toISOString().split('T')[0];
    const location = locationName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filterParts: string[] = [];
    
    if (filters?.bedrooms && filters.bedrooms !== 'all') {
      filterParts.push(`${filters.bedrooms}BR`);
    }
    if (filters?.propertyType && filters.propertyType !== 'all') {
      filterParts.push(filters.propertyType.replace(/\s+/g, '_'));
    }
    if (filters?.distance && filters.distance !== 'all') {
      filterParts.push(`${filters.distance}mi`);
    }
    
    const filterStr = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
    return `${location}${filterStr}_${date}.${extension}`;
  };

  const prepareData = () => {
    return listings.map((listing, index) => ({
      '#': index + 1,
      'Title': listing.title,
      'Property Type': listing.propertyType || 'N/A',
      'Bedrooms': listing.bedrooms,
      'Bathrooms': listing.bathrooms,
      'Annual Revenue': listing.revenue,
      'Occupancy (%)': listing.occupancy > 1 ? listing.occupancy : Math.round(listing.occupancy * 100),
      'ADR ($)': Math.round(listing.adr),
      'Rating': listing.rating || 'N/A',
      'Reviews': listing.reviews,
      'Distance (mi)': listing.distanceToMyProperty ? listing.distanceToMyProperty.toFixed(2) : 'N/A',
      'Latitude': listing.latitude?.toFixed(6) || 'N/A',
      'Longitude': listing.longitude?.toFixed(6) || 'N/A',
      'Airbnb URL': listing.airbnbUrl,
    }));
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const data = prepareData();
      const headers = Object.keys(data[0] || {});
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, formatFilename('csv'));
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const data = prepareData();
      const headers = Object.keys(data[0] || {});
      
      // Create workbook and worksheet using exceljs
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Listings');
      
      // Set column widths and headers
      const colWidths = [5, 40, 15, 10, 10, 15, 12, 10, 8, 10, 12, 12, 12, 50];
      ws.columns = headers.map((header, i) => ({
        header,
        key: header,
        width: colWidths[i] || 15,
      }));
      
      // Add data rows
      for (const row of data) {
        ws.addRow(row);
      }
      
      // Generate buffer and save
      const arrayBuffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, formatFilename('xlsx'));
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (listings.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${className}`}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : exportSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exportSuccess ? 'Exported!' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4" />
          Export as CSV
          <span className="text-xs text-slate-400 ml-auto">.csv</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" />
          Export as Excel
          <span className="text-xs text-slate-400 ml-auto">.xlsx</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
