import { useState } from 'react';
import { Share2, Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

interface ShareToolButtonProps {
  /** The step number (1-9) corresponding to the tool */
  step: number;
  /** City name for the share link */
  city?: string;
  /** State abbreviation for the share link */
  state?: string;
  /** Optional zip code */
  zipCode?: string;
  /** Optional address for property-specific tools */
  address?: string;
  /** Optional bedrooms */
  bedrooms?: number;
  /** Optional bathrooms */
  bathrooms?: number;
  /** Optional monthly rent */
  rent?: number;
  /** Optional market ID for market-specific tools */
  marketId?: string;
  /** Optional latitude */
  lat?: number;
  /** Optional longitude */
  lng?: number;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional class names */
  className?: string;
  /** Show text label */
  showLabel?: boolean;
}

/**
 * ShareToolButton - Generates shareable URLs for any tool with current state
 * 
 * Creates a URL like: https://coachinayahturnkeytool.com/?step=3&city=Austin&state=TX
 * When someone clicks this link, they land on the exact tool with the city pre-filled.
 */
export function ShareToolButton({
  step,
  city,
  state,
  zipCode,
  address,
  bedrooms,
  bathrooms,
  rent,
  marketId,
  lat,
  lng,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
}: ShareToolButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const generateShareUrl = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    
    // Always include step
    params.set('step', step.toString());
    
    // Add location params if available
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (zipCode) params.set('zip', zipCode);
    
    // Add property-specific params if available
    if (address) params.set('address', address);
    if (bedrooms) params.set('bedrooms', bedrooms.toString());
    if (bathrooms) params.set('bathrooms', bathrooms.toString());
    if (rent) params.set('rent', rent.toString());
    
    // Add market-specific params if available
    if (marketId) params.set('marketId', marketId);
    
    // Add coordinates if available
    if (lat) params.set('lat', lat.toString());
    if (lng) params.set('lng', lng.toString());
    
    // Auto-analyze flag to trigger search on load
    params.set('autoAnalyze', 'true');
    
    return `${baseUrl}/?${params.toString()}`;
  };

  const shareUrl = generateShareUrl();

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers or insecure contexts
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
      toast.success('Link copied! Share it with anyone.');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      toast.error('Could not copy automatically. Please copy the link manually.');
    }
  };

  const handleQuickCopy = async () => {
    await handleCopy();
    setOpen(false);
  };

  // Get tool name based on step
  const getToolName = (step: number): string => {
    const toolNames: Record<number, string> = {
      1: 'Check Regulations',
      2: 'Find a Property',
      3: 'See Real Revenue',
      4: 'Explore Listings',
      5: 'Validate the Deal',
      6: 'Compare Favorites',
      7: 'See the Map',
      8: 'Market Advisor',
      9: 'AI Advisor',
    };
    return toolNames[step] || 'Tool';
  };

  const toolName = getToolName(step);
  const locationText = city && state ? `${city}, ${state}` : city || state || 'this location';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-2 ${className}`}
        >
          <Share2 className="h-4 w-4" />
          {showLabel && <span>Share</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Share this view</h4>
            <p className="text-xs text-muted-foreground">
              Anyone with this link will see {toolName} for {locationText}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="w-full px-3 py-2 text-xs bg-muted rounded-md border border-border pr-10 truncate"
              />
              <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          
          <Button
            onClick={handleQuickCopy}
            className="w-full gap-2"
            variant={copied ? 'secondary' : 'default'}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Link
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Link never expires
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Simple inline share button that copies URL immediately on click
 */
export function QuickShareButton({
  step,
  city,
  state,
  zipCode,
  address,
  bedrooms,
  bathrooms,
  rent,
  marketId,
  lat,
  lng,
  variant = 'ghost',
  size = 'icon',
  className = '',
}: Omit<ShareToolButtonProps, 'showLabel'>) {
  const [copied, setCopied] = useState(false);

  const generateShareUrl = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    
    params.set('step', step.toString());
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (zipCode) params.set('zip', zipCode);
    if (address) params.set('address', address);
    if (bedrooms) params.set('bedrooms', bedrooms.toString());
    if (bathrooms) params.set('bathrooms', bathrooms.toString());
    if (rent) params.set('rent', rent.toString());
    if (marketId) params.set('marketId', marketId);
    if (lat) params.set('lat', lat.toString());
    if (lng) params.set('lng', lng.toString());
    params.set('autoAnalyze', 'true');
    
    return `${baseUrl}/?${params.toString()}`;
  };

  const handleCopy = async () => {
    const shareUrl = generateShareUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Share link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Could not copy link');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={className}
      title="Copy share link"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </Button>
  );
}
