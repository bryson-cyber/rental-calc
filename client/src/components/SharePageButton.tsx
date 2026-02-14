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
 * 
 * Includes social sharing options:
 * - Facebook
 * - Twitter/X
 * - LinkedIn
 * - Email
 */

import { useState } from 'react';
import { Share2, Copy, Check, Link2, Mail } from 'lucide-react';
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

// Social media icons as SVG components
const FacebookIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

/**
 * Generate social share URLs with pre-populated messages
 */
function getSocialShareUrls(shareUrl: string, description: string) {
  const encodedUrl = encodeURIComponent(shareUrl);
  const title = 'Check out this rental market analysis';
  const encodedTitle = encodeURIComponent(title);
  
  // Create compelling share messages for each platform
  const twitterText = encodeURIComponent(`${description}\n\nFree rental revenue calculator and market analysis tools by @CoachInayah\n\n`);
  const linkedInSummary = encodeURIComponent(`I found this amazing free tool for analyzing rental property investments. ${description}`);
  const emailSubject = encodeURIComponent(`Check out this rental analysis tool - ${description}`);
  const emailBody = encodeURIComponent(`Hey!\n\nI thought you might find this useful - it's a free rental revenue calculator and market analysis tool.\n\n${description}\n\nCheck it out here: ${shareUrl}\n\nBest,`);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${emailSubject}&body=${emailBody}`,
  };
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
  const socialUrls = getSocialShareUrls(shareUrl, shareDescription);

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

  const handleSocialShare = (platform: 'facebook' | 'twitter' | 'linkedin' | 'email') => {
    const url = socialUrls[platform];
    if (platform === 'email') {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'width=600,height=400,noopener,noreferrer');
    }
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
          
          {/* Social sharing buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSocialShare('facebook')}
              className="h-9 w-9 rounded-full hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"
              title="Share on Facebook"
            >
              <FacebookIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSocialShare('twitter')}
              className="h-9 w-9 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors"
              title="Share on X (Twitter)"
            >
              <TwitterIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSocialShare('linkedin')}
              className="h-9 w-9 rounded-full hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-colors"
              title="Share on LinkedIn"
            >
              <LinkedInIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSocialShare('email')}
              className="h-9 w-9 rounded-full hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors"
              title="Share via Email"
            >
              <Mail className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-popover px-2 text-muted-foreground">or copy link</span>
            </div>
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
