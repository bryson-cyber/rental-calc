/**
 * Bug Report Button Component
 * 
 * A floating button that allows users to easily report bugs.
 * Automatically captures context like current page, property info, and browser details.
 */

import { useState } from 'react';
import { Bug, X, Send, Loader2, CheckCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

interface BugReportButtonProps {
  // Optional context to pre-fill
  toolName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  marketId?: string;
  errorMessage?: string;
}

export function BugReportButton({
  toolName,
  propertyAddress,
  city,
  state,
  marketId,
  errorMessage,
}: BugReportButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    reporterEmail: '',
    reporterName: '',
  });

  const createBugReport = trpc.bugReports.create.useMutation({
    onSuccess: (data) => {
      if (data.success && data.shareUrl) {
        setShareUrl(data.shareUrl);
        setSubmitted(true);
        toast.success('Bug report submitted successfully!');
      } else {
        toast.error('Failed to submit bug report');
      }
    },
    onError: () => {
      toast.error('Failed to submit bug report');
    },
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title for the bug report');
      return;
    }

    // Capture browser info
    const browserInfo = `${navigator.userAgent}`;
    const screenSize = `${window.innerWidth}x${window.innerHeight}`;
    const pagePath = window.location.pathname + window.location.search;

    // Get session ID from localStorage if available
    const sessionId = localStorage.getItem('sessionId') || undefined;

    createBugReport.mutate({
      title: formData.title,
      description: formData.description,
      stepsToReproduce: formData.stepsToReproduce,
      expectedBehavior: formData.expectedBehavior,
      actualBehavior: formData.actualBehavior,
      reporterEmail: formData.reporterEmail || undefined,
      reporterName: formData.reporterName || undefined,
      toolName,
      propertyAddress,
      city,
      state,
      marketId,
      errorMessage,
      browserInfo,
      screenSize,
      pagePath,
      sessionId,
    });
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      stepsToReproduce: '',
      expectedBehavior: '',
      actualBehavior: '',
      reporterEmail: '',
      reporterName: '',
    });
    setSubmitted(false);
    setShareUrl('');
  };

  // Only show for admin users
  if (!user || user.role !== 'admin') return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-24 sm:bottom-[8.5rem] right-4 sm:right-6 z-50 bg-white shadow-lg hover:bg-gray-50 border-gray-200"
        >
          <Bug className="w-4 h-4 mr-2" />
          Report Bug
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-[#C9A962]" />
            {submitted ? 'Bug Report Submitted!' : 'Report a Bug'}
          </DialogTitle>
          <DialogDescription>
            {submitted
              ? 'Thank you for helping us improve! Share this link to track the bug.'
              : 'Help us improve by reporting any issues you encounter.'}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <div className="space-y-2">
              <Label>Shareable Bug Report Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyShareUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Share this link to track the status of your bug report.
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={resetForm} className="flex-1">
                Report Another Bug
              </Button>
              <Button onClick={() => setOpen(false)} className="flex-1 bg-[#0F172A] hover:bg-[#1e293b]">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Bug Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What happened? What were you trying to do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Steps to Reproduce */}
            <div className="space-y-2">
              <Label htmlFor="steps">Steps to Reproduce</Label>
              <Textarea
                id="steps"
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                value={formData.stepsToReproduce}
                onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                rows={3}
              />
            </div>

            {/* Expected vs Actual */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected">Expected Behavior</Label>
                <Textarea
                  id="expected"
                  placeholder="What should happen?"
                  value={formData.expectedBehavior}
                  onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Behavior</Label>
                <Textarea
                  id="actual"
                  placeholder="What actually happened?"
                  value={formData.actualBehavior}
                  onChange={(e) => setFormData({ ...formData, actualBehavior: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            {/* Contact Info (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.reporterName}
                  onChange={(e) => setFormData({ ...formData, reporterName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Your Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.reporterEmail}
                  onChange={(e) => setFormData({ ...formData, reporterEmail: e.target.value })}
                />
              </div>
            </div>

            {/* Context Info (Auto-captured) */}
            {(toolName || propertyAddress || city || errorMessage) && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium text-gray-700 mb-2">Auto-captured context:</p>
                <ul className="space-y-1 text-gray-600">
                  {toolName && <li>• Tool: {toolName}</li>}
                  {propertyAddress && <li>• Property: {propertyAddress}</li>}
                  {city && state && <li>• Location: {city}, {state}</li>}
                  {errorMessage && <li>• Error: {errorMessage}</li>}
                </ul>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createBugReport.isPending}
                className="flex-1 bg-[#0F172A] hover:bg-[#1e293b]"
              >
                {createBugReport.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Bug Report
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BugReportButton;
