/**
 * SharePageButton - Generates shareable URLs for standalone pages
 * 
 * Unlike ShareToolButton (which uses query params on the main page),
 * this component creates links to standalone pages with their own state.
 * 
 * Supports:
 * - /market-advisor?market=Denver&marketId=123
 * - /opportunity-finder?city=Austin&state=TX
 * - /discover-markets?type=coastal&minScore=70
 * - /compare-markets?markets=123,456,789
 */

import { useState } from 'react';
import { Share2, Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

interface SharePageButtonProps {
  /** The page path (e.g., '/market-advisor') */
  pagePath: string;
  /** Query parameters to include in the URL */
  params?: Record<string, string | number | boolean | undefined>;
  /** Description of what's being shared */
  shareDescription?: string;
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
 * SharePageButton - Generates shareable URLs for standalone pages
 */
export function SharePageButton({
  pagePath,
  params = {},
  shareDescription = 'this view',
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
}: SharePageButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const generateShareUrl = () => {
    const baseUrl = window.location.origin;
    const urlParams = new URLSearchParams();
    
    // Add all provided params, filtering out undefined values
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        urlParams.set(key, String(value));
      }
    });
    
    const queryString = urlParams.toString();
    return queryString ? `${baseUrl}${pagePath}?${queryString}` : `${baseUrl}${pagePath}`;
  };

  const shareUrl = generateShareUrl();

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
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
              Anyone with this link will see {shareDescription}
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
 * QuickSharePageButton - Simple inline share button that copies URL immediately
 */
export function QuickSharePageButton({
  pagePath,
  params = {},
  variant = 'ghost',
  size = 'icon',
  className = '',
}: Omit<SharePageButtonProps, 'showLabel' | 'shareDescription'>) {
  const [copied, setCopied] = useState(false);

  const generateShareUrl = () => {
    const baseUrl = window.location.origin;
    const urlParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        urlParams.set(key, String(value));
      }
    });
    
    const queryString = urlParams.toString();
    return queryString ? `${baseUrl}${pagePath}?${queryString}` : `${baseUrl}${pagePath}`;
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
