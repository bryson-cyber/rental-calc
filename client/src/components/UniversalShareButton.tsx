import { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, Link2, Loader2, Mail, Phone, Send } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export type ReportType = 
  | 'revenue'
  | 'validator'
  | 'market'
  | 'ai_advisor'
  | 'listings'
  | 'comparison'
  | 'map'
  | 'regulation';

interface UniversalShareButtonProps {
  /** Type of report being shared */
  reportType: ReportType;
  /** Full report data to be stored */
  reportData: any;
  /** Property address (if applicable) */
  address?: string;
  /** City name */
  city?: string;
  /** State */
  state?: string;
  /** Zip code */
  zipCode?: string;
  /** Latitude */
  latitude?: number;
  /** Longitude */
  longitude?: number;
  /** Number of bedrooms */
  bedrooms?: number;
  /** Number of bathrooms */
  bathrooms?: number;
  /** Monthly rent */
  monthlyRent?: number;
  /** Market ID */
  marketId?: string;
  /** Market name */
  marketName?: string;
  /** Report title for display */
  title?: string;
  /** Brief summary for preview */
  summary?: string;
  /** Annual revenue (key metric) */
  annualRevenue?: number;
  /** Occupancy rate */
  occupancyRate?: number;
  /** Average daily rate */
  averageDailyRate?: number;
  /** Profit margin */
  profitMargin?: number;
  /** Verdict (GO, CAUTION, NO-GO) */
  verdict?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional class names */
  className?: string;
  /** Show text label */
  showLabel?: boolean;
  /** Pre-existing share code (if already created) */
  existingShareCode?: string;
  /** Callback when a share code is created */
  onShareCreated?: (shareCode: string) => void;
  /** Admin revenue override to persist when creating the share */
  revenueOverride?: number | null;
  /** Admin occupancy/booking rate override to persist when creating the share */
  occupancyOverride?: number | null;
  /** Admin-curated comp selection to persist when creating the share */
  selectedCompIds?: string[] | null;
}

/**
 * UniversalShareButton - Creates shareable links for any tool's analysis results
 * 
 * Uses the universal_shareable_reports system to store full report data
 * and generate unique share codes that can be accessed at /share/:shareCode
 */
export function UniversalShareButton({
  reportType,
  reportData,
  address,
  city,
  state,
  zipCode,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  monthlyRent,
  marketId,
  marketName,
  title,
  summary,
  annualRevenue,
  occupancyRate,
  averageDailyRate,
  profitMargin,
  verdict,
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  existingShareCode,
  onShareCreated,
  revenueOverride,
  occupancyOverride,
  selectedCompIds,
}: UniversalShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    existingShareCode ? `${window.location.origin}/share/${existingShareCode}` : null
  );
  const [shareCode, setShareCode] = useState<string | null>(existingShareCode || null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'send'>('link');
  
  // Send notification state
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isSending, setIsSending] = useState(false);

  const createReport = trpc.shareableReports.create.useMutation();
  const sendNotifications = trpc.shareableReports.sendNotifications.useMutation();
  const updateOverrideMutation = trpc.shareableReports.updateRevenueOverride.useMutation();
  const saveCompSelectionMutation = trpc.shareableReports.saveCompSelection.useMutation();

  // Auto-sync selectedCompIds to DB when it changes AFTER a share was already created
  const lastSyncedCompIds = useRef<string[] | null | undefined>(undefined);
  useEffect(() => {
    if (!shareCode) return;
    if (lastSyncedCompIds.current === undefined) {
      lastSyncedCompIds.current = selectedCompIds ?? null;
      return;
    }
    const newVal = selectedCompIds ?? null;
    const oldVal = lastSyncedCompIds.current;
    // Compare arrays
    const changed = !newVal && !!oldVal || !!newVal && !oldVal ||
      (newVal && oldVal && (newVal.length !== oldVal.length || newVal.some((id, i) => id !== oldVal[i])));
    if (!changed) return;
    lastSyncedCompIds.current = newVal;
    if (newVal && newVal.length > 0) {
      saveCompSelectionMutation.mutate({ shareCode, selectedCompIds: newVal });
    }
  }, [shareCode, selectedCompIds]);

  // Auto-sync revenueOverride to DB when it changes AFTER a share was already created
  const lastSyncedOverride = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!shareCode) return; // No share yet
    // Skip initial mount — only sync actual changes
    if (lastSyncedOverride.current === undefined) {
      lastSyncedOverride.current = revenueOverride ?? null;
      return;
    }
    const newVal = revenueOverride ?? null;
    if (newVal === lastSyncedOverride.current) return; // No change
    lastSyncedOverride.current = newVal;
    updateOverrideMutation.mutate({
      shareCode,
      revenueOverride: newVal,
    });
  }, [shareCode, revenueOverride]);

  // Auto-sync occupancyOverride to DB when it changes AFTER a share was already created
  const updateOccupancyOverrideMutation = trpc.shareableReports.updateOccupancyOverride.useMutation();
  const lastSyncedOccupancyOverride = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!shareCode) return;
    if (lastSyncedOccupancyOverride.current === undefined) {
      lastSyncedOccupancyOverride.current = occupancyOverride ?? null;
      return;
    }
    const newVal = occupancyOverride ?? null;
    if (newVal === lastSyncedOccupancyOverride.current) return;
    lastSyncedOccupancyOverride.current = newVal;
    updateOccupancyOverrideMutation.mutate({
      shareCode,
      occupancyOverride: newVal,
    });
  }, [shareCode, occupancyOverride]);

  const handleCreateShare = async () => {
    if (shareUrl) return; // Already created
    
    setIsCreating(true);
    try {
      // If admin has overridden revenue, occupancy, or curated comps, embed in the report data
      let finalReportData = { ...reportData };
      if (revenueOverride != null) {
        finalReportData._revenueOverride = revenueOverride;
      }
      if (occupancyOverride != null) {
        finalReportData._occupancyOverride = occupancyOverride;
      }
      if (selectedCompIds && selectedCompIds.length > 0) {
        finalReportData._selectedCompIds = selectedCompIds;
      }
      const finalAnnualRevenue = revenueOverride ?? annualRevenue;

      const result = await createReport.mutateAsync({
        reportType,
        reportData: finalReportData,
        address,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        monthlyRent,
        marketId,
        marketName,
        title: title || generateTitle(),
        summary: summary || generateSummary(),
        annualRevenue: finalAnnualRevenue,
        occupancyRate,
        averageDailyRate,
        profitMargin,
        verdict,
        revenueOverride: revenueOverride ?? undefined,
      });

      if (result.success && result.shareCode) {
        const url = `${window.location.origin}/share/${result.shareCode}`;
        setShareUrl(url);
        setShareCode(result.shareCode);
        onShareCreated?.(result.shareCode);
        
        // Also save comp selection to dedicated column if admin has curated comps
        if (selectedCompIds && selectedCompIds.length > 0) {
          saveCompSelectionMutation.mutate({
            shareCode: result.shareCode,
            selectedCompIds,
          });
        }
        
        toast.success('Share link created!');
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  };

  const generateTitle = (): string => {
    const typeLabels: Record<ReportType, string> = {
      revenue: 'Revenue Analysis',
      validator: 'Property Validation',
      market: 'Market Analysis',
      ai_advisor: 'AI Advisor Analysis',
      listings: 'Listings Report',
      comparison: 'Property Comparison',
      map: 'Map View',
      regulation: 'Regulation Check',
    };
    
    const location = address || (city && state ? `${city}, ${state}` : city || marketName || 'Property');
    return `${typeLabels[reportType]} - ${location}`;
  };

  const generateSummary = (): string => {
    const parts: string[] = [];
    
    if (annualRevenue) {
      parts.push(`$${annualRevenue.toLocaleString()}/year projected revenue`);
    }
    if (occupancyRate) {
      const rate = occupancyRate > 1 ? occupancyRate : occupancyRate * 100;
      parts.push(`${Math.round(rate)}% occupancy`);
    }
    if (verdict) {
      parts.push(`Verdict: ${verdict}`);
    }
    
    return parts.join(' • ') || 'View the full analysis report';
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      toast.error('Could not copy automatically. Please copy the link manually.');
    }
  };

  const handleSendNotifications = async () => {
    if (!shareCode) {
      toast.error('Please create a share link first');
      return;
    }
    
    if (!recipientEmail && !recipientPhone) {
      toast.error('Please enter an email or phone number');
      return;
    }
    
    setIsSending(true);
    try {
      const result = await sendNotifications.mutateAsync({
        shareCode,
        reportType,
        email: recipientEmail || undefined,
        phone: recipientPhone || undefined,
      });
      
      if (result.success) {
        const methods: string[] = [];
        if ((result.notifications as { smsSent?: boolean })?.smsSent) methods.push('SMS');
        if ((result.notifications as { emailSent?: boolean })?.emailSent) methods.push('email');
        
        if (methods.length > 0) {
          toast.success(`Report sent via ${methods.join(' and ')}!`);
          setRecipientEmail('');
          setRecipientPhone('');
        } else {
          toast.error('Failed to send notifications');
        }
      }
    } catch (error) {
      console.error('Failed to send notifications:', error);
      toast.error('Failed to send notifications');
    } finally {
      setIsSending(false);
    }
  };

  const getReportTypeLabel = (): string => {
    const labels: Record<ReportType, string> = {
      revenue: 'Revenue Analysis',
      validator: 'Deal Validation',
      market: 'Market Analysis',
      ai_advisor: 'AI Analysis',
      listings: 'Listings Report',
      comparison: 'Comparison',
      map: 'Map View',
      regulation: 'Regulation Check',
    };
    return labels[reportType];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-2 ${className}`}
          onClick={() => {
            if (!shareUrl) {
              handleCreateShare();
            }
          }}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {showLabel && <span>Share Report</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-amber-600" />
            Share {getReportTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Share this analysis with clients, partners, or friends
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'link' | 'send')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Copy Link
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-2">
              <Send className="h-4 w-4" />
              Send Directly
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="link" className="space-y-4 mt-4">
            {isCreating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                <span className="ml-2 text-sm text-muted-foreground">Creating share link...</span>
              </div>
            ) : shareUrl ? (
              <>
                <div className="space-y-2">
                  <Label>Share Link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant={copied ? 'secondary' : 'default'}
                      size="icon"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    Anyone with this link can view the full analysis report. The link never expires.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Button onClick={handleCreateShare} disabled={isCreating}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Generate Share Link
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="send" className="space-y-4 mt-4">
            {!shareUrl ? (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Create a share link first to send directly
                </p>
                <Button onClick={handleCreateShare} disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Create Share Link
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number (SMS)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={handleSendNotifications}
                  disabled={isSending || (!recipientEmail && !recipientPhone)}
                  className="w-full"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Report
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  They'll receive a link to view the full analysis
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact share button for inline use in results headers
 */
export function CompactShareButton(props: UniversalShareButtonProps) {
  return (
    <UniversalShareButton
      {...props}
      variant="outline"
      size="sm"
      showLabel={true}
    />
  );
}

/**
 * Icon-only share button for tight spaces
 */
export function IconShareButton(props: UniversalShareButtonProps) {
  return (
    <UniversalShareButton
      {...props}
      variant="ghost"
      size="icon"
      showLabel={false}
    />
  );
}
