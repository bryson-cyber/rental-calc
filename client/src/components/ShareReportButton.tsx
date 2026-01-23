import { useState } from 'react';
import { Share2, Copy, Check, Link2, Clock, Eye, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface ShareReportButtonProps {
  reportType: 'property' | 'market';
  reportData: any;
  address?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  marketId?: string;
  marketName?: string;
}

export function ShareReportButton({ 
  reportType, 
  reportData, 
  address,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  marketId,
  marketName
}: ShareReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiration, setExpiration] = useState<string>('7');
  const [maxViews, setMaxViews] = useState<string>('unlimited');
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const createShare = trpc.sharedReports.create.useMutation();

  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      const result = await createShare.mutateAsync({
        reportType,
        reportData: JSON.stringify(reportData),
        address,
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        marketId,
        marketName,
        expiresInDays: expiration === 'never' ? undefined : parseInt(expiration),
        maxViews: maxViews === 'unlimited' ? undefined : parseInt(maxViews)
      });

      if (result.success && result.shareId) {
        const url = `${window.location.origin}/report/${result.shareId}`;
        setShareUrl(url);
        toast.success('Share link created!');
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // Generate PDF using the browser's print functionality
      // This creates a clean PDF of the current report
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to download PDF');
        return;
      }

      // Get the property info for the filename
      const filename = address 
        ? `Airbnb-Analysis-${address.split(',')[0].replace(/\s+/g, '-')}.pdf`
        : `Airbnb-Analysis-${marketName || 'Report'}.pdf`;

      // Create a styled HTML document for printing
      const revenue = reportData?.revenue_estimate?.annual || reportData?.estimates?.annual_revenue || 0;
      const occupancy = reportData?.revenue_estimate?.occupancy || reportData?.estimates?.occupancy_rate || 0;
      const adr = reportData?.revenue_estimate?.nightly || reportData?.estimates?.average_daily_rate || 0;
      const propertyAddress = reportData?.property?.address || address || 'Property Report';
      const propertyCity = reportData?.property?.city || '';
      const propertyState = reportData?.property?.state || '';
      const propertyBedrooms = reportData?.property?.bedrooms || bedrooms || 0;
      const propertyBathrooms = reportData?.property?.bathrooms || bathrooms || 0;
      const propertyAccommodates = reportData?.property?.accommodates || 0;
      const marketDataName = reportData?.market_data?.name || marketName || '';
      const marketMetrics = reportData?.market_data?.metrics || {};
      const comps = reportData?.comps || [];
      const monthlyForecast = reportData?.monthly_forecast || [];

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      };

      const formatPercent = (value: number) => {
        const percent = value > 1 ? value : value * 100;
        return `${Math.round(percent)}%`;
      };

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${filename}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: white;
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #D4A84B;
            }
            .header h1 {
              font-size: 28px;
              color: #1a1a1a;
              margin-bottom: 8px;
            }
            .header .subtitle {
              color: #666;
              font-size: 14px;
            }
            .header .brand {
              color: #D4A84B;
              font-weight: 600;
              margin-top: 8px;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin-bottom: 40px;
            }
            .metric-card {
              background: #f8f7f5;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
            }
            .metric-card .label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .metric-card .value {
              font-size: 24px;
              font-weight: 700;
              color: #1a1a1a;
              margin-top: 4px;
            }
            .metric-card .value.highlight {
              color: #D4A84B;
            }
            .section {
              margin-bottom: 32px;
            }
            .section h2 {
              font-size: 18px;
              color: #1a1a1a;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 2px solid #eee;
            }
            .property-details {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .detail-row .label {
              color: #666;
            }
            .detail-row .value {
              font-weight: 600;
            }
            .comps-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            .comps-table th {
              background: #f8f7f5;
              padding: 12px 8px;
              text-align: left;
              font-weight: 600;
              border-bottom: 2px solid #ddd;
            }
            .comps-table td {
              padding: 10px 8px;
              border-bottom: 1px solid #eee;
            }
            .comps-table tr:nth-child(even) {
              background: #fafafa;
            }
            .forecast-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 8px;
            }
            .forecast-month {
              text-align: center;
              padding: 12px 8px;
              background: #f8f7f5;
              border-radius: 6px;
            }
            .forecast-month .month {
              font-size: 12px;
              color: #666;
              margin-bottom: 4px;
            }
            .forecast-month .revenue {
              font-weight: 600;
              font-size: 14px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #eee;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .footer .brand {
              color: #D4A84B;
              font-weight: 600;
            }
            @media print {
              body {
                padding: 20px;
              }
              .metrics-grid {
                grid-template-columns: repeat(4, 1fr);
              }
              .forecast-grid {
                grid-template-columns: repeat(6, 1fr);
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Airbnb Arbitrage Analysis</h1>
            <div class="subtitle">${propertyAddress}</div>
            <div class="brand">Powered by Coach Inayah's Turnkey Program</div>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="label">Est. Annual Revenue</div>
              <div class="value highlight">${formatCurrency(revenue)}</div>
            </div>
            <div class="metric-card">
              <div class="label">Avg. Nightly Rate</div>
              <div class="value">${formatCurrency(adr)}</div>
            </div>
            <div class="metric-card">
              <div class="label">Occupancy Rate</div>
              <div class="value">${formatPercent(occupancy)}</div>
            </div>
            <div class="metric-card">
              <div class="label">Monthly Average</div>
              <div class="value">${formatCurrency(revenue / 12)}</div>
            </div>
          </div>

          <div class="section">
            <h2>Property Details</h2>
            <div class="property-details">
              <div class="detail-row">
                <span class="label">Address</span>
                <span class="value">${propertyAddress}</span>
              </div>
              <div class="detail-row">
                <span class="label">Location</span>
                <span class="value">${propertyCity}${propertyState ? ', ' + propertyState : ''}</span>
              </div>
              <div class="detail-row">
                <span class="label">Bedrooms</span>
                <span class="value">${propertyBedrooms}</span>
              </div>
              <div class="detail-row">
                <span class="label">Bathrooms</span>
                <span class="value">${propertyBathrooms}</span>
              </div>
              <div class="detail-row">
                <span class="label">Accommodates</span>
                <span class="value">${propertyAccommodates} guests</span>
              </div>
              <div class="detail-row">
                <span class="label">Market</span>
                <span class="value">${marketDataName}</span>
              </div>
            </div>
          </div>

          ${monthlyForecast.length > 0 ? `
          <div class="section">
            <h2>12-Month Revenue Forecast</h2>
            <div class="forecast-grid">
              ${monthlyForecast.slice(0, 12).map((m: any) => `
                <div class="forecast-month">
                  <div class="month">${m.month}</div>
                  <div class="revenue">${formatCurrency(m.revenue)}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${comps.length > 0 ? `
          <div class="section">
            <h2>Comparable Properties</h2>
            <table class="comps-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Beds</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>Annual Revenue</th>
                  <th>ADR</th>
                  <th>Occupancy</th>
                </tr>
              </thead>
              <tbody>
                ${comps.slice(0, 10).map((comp: any) => `
                  <tr>
                    <td>${comp.title || 'Comparable Property'}</td>
                    <td>${comp.bedrooms || '-'}</td>
                    <td>${comp.rating ? comp.rating.toFixed(1) + '★' : '-'}</td>
                    <td>${comp.reviews || '-'}</td>
                    <td>${formatCurrency(comp.annual_revenue || 0)}</td>
                    <td>${formatCurrency(comp.adr || 0)}</td>
                    <td>${formatPercent(comp.occupancy || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${marketMetrics.occupancy ? `
          <div class="section">
            <h2>Market Overview: ${marketDataName}</h2>
            <div class="property-details">
              <div class="detail-row">
                <span class="label">Market Occupancy</span>
                <span class="value">${formatPercent(marketMetrics.occupancy)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Market ADR</span>
                <span class="value">${formatCurrency(marketMetrics.adr || 0)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Market Revenue</span>
                <span class="value">${formatCurrency(marketMetrics.revenue || 0)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Active Listings</span>
                <span class="value">${(marketMetrics.active_listings || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <p>Report generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p class="brand">Coach Inayah's Turnkey Program - coachinayahturnkeytool.com</p>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      
      // Wait for content to load then trigger print
      setTimeout(() => {
        printWindow.print();
        // Close the window after a delay to allow print dialog
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 500);

      toast.success('PDF ready for download!');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setShareUrl(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          Share Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Share Report
          </DialogTitle>
          <DialogDescription>
            Create a shareable link or download a PDF of this report.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4 py-4">
            {/* PDF Download Button */}
            <Button 
              variant="outline" 
              className="w-full gap-2 border-[#D4A84B]/30 hover:bg-[#D4A84B]/10"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <FileText className="w-4 h-4" />
                  Download as PDF
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or create shareable link
                </span>
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Link Expiration
              </Label>
              <Select value={expiration} onValueChange={setExpiration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="never">Never expires</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Views */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Limit
              </Label>
              <Select value={maxViews} onValueChange={setMaxViews}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited views</SelectItem>
                  <SelectItem value="1">1 view</SelectItem>
                  <SelectItem value="5">5 views</SelectItem>
                  <SelectItem value="10">10 views</SelectItem>
                  <SelectItem value="25">25 views</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateShare} 
              className="w-full"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Create Share Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {expiration === 'never' 
                    ? 'Never expires' 
                    : `Expires in ${expiration} day(s)`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span>
                  {maxViews === 'unlimited' 
                    ? 'Unlimited views' 
                    : `${maxViews} view(s) allowed`}
                </span>
              </div>
            </div>

            {/* PDF Download in success state too */}
            <Button 
              variant="outline" 
              className="w-full gap-2 border-[#D4A84B]/30 hover:bg-[#D4A84B]/10"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download as PDF
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Done
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => {
                  setShareUrl(null);
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ShareReportButton;
