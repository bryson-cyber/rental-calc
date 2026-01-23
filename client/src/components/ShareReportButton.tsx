import { useState } from 'react';
import { Share2, Copy, Check, Link2, Clock, Eye } from 'lucide-react';
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
            Create a shareable link to this report. Anyone with the link can view it.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4 py-4">
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
