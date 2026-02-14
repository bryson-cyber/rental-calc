/**
 * SendToSlackModal
 * 
 * A modal dialog that lets admins send a property report directly to a Slack channel.
 * Used inline on the report page — no need to visit the admin panel.
 * 
 * Features:
 * - Dynamic channel search across the entire Slack workspace
 * - Auto-generates an AI deal summary via Gemini
 * - Optional custom message
 * - Posts report link + deal summary + Zillow/Redfin links to the selected channel
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Hash,
  Loader2,
  Sparkles,
  Send,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface SendToSlackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The share code for the report (shareId or shareCode) */
  shareCode: string;
  /** Whether this is a "shared" report (/report/:id) or "universal" report (/share/:code) */
  reportSource: "shared" | "universal";
  /** Property address */
  address: string;
  /** Report data for AI summary generation */
  reportData: {
    bedrooms?: number;
    bathrooms?: number;
    annualRevenue?: number;
    occupancyRate?: number;
    averageDailyRate?: number;
    verdict?: string;
    reportType?: string;
  };
}

export default function SendToSlackModal({
  open,
  onOpenChange,
  shareCode,
  reportSource,
  address,
  reportData,
}: SendToSlackModalProps) {
  // Channel search state
  const [channelQuery, setChannelQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showChannelResults, setShowChannelResults] = useState(false);
  const channelSearchRef = useRef<HTMLDivElement>(null);

  // Message state
  const [dealSummary, setDealSummary] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [summaryGenerated, setSummaryGenerated] = useState(false);

  // Success state
  const [sendSuccess, setSendSuccess] = useState(false);
  const [permalink, setPermalink] = useState<string | null>(null);

  // Search channels query
  const channelSearch = trpc.slackAdmin.searchChannels.useQuery(
    { query: channelQuery || "general" },
    {
      enabled: open && channelQuery.length >= 0,
      staleTime: 10000,
    }
  );

  // Generate summary mutation
  const generateSummary = trpc.slackAdmin.generateSummary.useMutation({
    onSuccess: (result) => {
      setDealSummary(result.summary);
      setSummaryGenerated(true);
      toast.success("Deal summary generated");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate summary");
    },
  });

  // Send report mutation
  const sendReport = trpc.slackAdmin.sendReport.useMutation({
    onSuccess: (result) => {
      setSendSuccess(true);
      setPermalink(result.permalink || null);
      toast.success(`Report sent to #${result.channelName || selectedChannel?.name}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send to Slack");
    },
  });

  // Auto-generate summary when modal opens
  useEffect(() => {
    if (open && !summaryGenerated && !generateSummary.isPending && address) {
      generateSummary.mutate({
        address,
        bedrooms: reportData.bedrooms,
        bathrooms: reportData.bathrooms,
        annualRevenue: reportData.annualRevenue,
        occupancyRate: reportData.occupancyRate,
        averageDailyRate: reportData.averageDailyRate,
        verdict: reportData.verdict,
        reportType: reportData.reportType || "property",
      });
    }
  }, [open]);

  // Close channel dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        channelSearchRef.current &&
        !channelSearchRef.current.contains(event.target as Node)
      ) {
        setShowChannelResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedChannel(null);
        setChannelQuery("");
        setDealSummary("");
        setCustomMessage("");
        setSummaryGenerated(false);
        setSendSuccess(false);
        setPermalink(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  const handleSend = () => {
    if (!selectedChannel || !dealSummary.trim()) return;

    sendReport.mutate({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      shareCode,
      reportSource,
      address,
      reportType: reportData.reportType || "property",
      dealSummary: dealSummary.trim(),
      customMessage: customMessage.trim() || undefined,
    });
  };

  const canSend =
    selectedChannel &&
    dealSummary.trim() &&
    !sendReport.isPending &&
    !sendSuccess;

  // Success view
  if (sendSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-[#0F172A]">
                Sent to #{selectedChannel?.name}
              </h3>
              <p className="text-sm text-[#64748b] mt-1">
                The deal report for {address} has been posted.
              </p>
            </div>
            {permalink && (
              <a
                href={permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#C9A962] hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View in Slack
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="mt-2"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A]">Send to Slack</DialogTitle>
          <DialogDescription>
            Send this property report to a client's Slack channel with an AI-generated deal summary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Property info */}
          <div className="bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
            <p className="text-sm font-medium text-[#0F172A]">{address}</p>
            <p className="text-xs text-[#64748b] mt-0.5">
              {reportData.bedrooms && `${reportData.bedrooms} BR`}
              {reportData.bathrooms && ` / ${reportData.bathrooms} BA`}
              {reportData.annualRevenue &&
                ` — $${reportData.annualRevenue.toLocaleString()}/yr`}
            </p>
          </div>

          {/* Channel search */}
          <div ref={channelSearchRef} className="relative">
            <Label className="text-sm font-medium text-[#0F172A]">
              Slack Channel
            </Label>
            {selectedChannel ? (
              <div className="mt-1.5 flex items-center justify-between bg-[#f0fdf4] border border-green-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {selectedChannel.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedChannel(null);
                    setChannelQuery("");
                  }}
                  className="text-xs text-[#64748b] hover:text-[#0F172A]"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <Input
                    placeholder="Search channels..."
                    value={channelQuery}
                    onChange={(e) => {
                      setChannelQuery(e.target.value);
                      setShowChannelResults(true);
                    }}
                    onFocus={() => setShowChannelResults(true)}
                    className="pl-9"
                  />
                </div>
                {showChannelResults && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {channelSearch.isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-[#94a3b8]" />
                        <span className="ml-2 text-sm text-[#94a3b8]">
                          Searching...
                        </span>
                      </div>
                    ) : channelSearch.data?.channels?.length ? (
                      channelSearch.data.channels.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => {
                            setSelectedChannel({ id: ch.id, name: ch.name });
                            setShowChannelResults(false);
                            setChannelQuery("");
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#f8fafc] flex items-center gap-2 transition-colors"
                        >
                          <Hash className="w-3.5 h-3.5 text-[#94a3b8]" />
                          <span className="text-sm text-[#0F172A]">
                            {ch.name}
                          </span>
                          {ch.purpose && (
                            <span className="text-xs text-[#94a3b8] truncate ml-auto max-w-[200px]">
                              {ch.purpose}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="py-4 text-center text-sm text-[#94a3b8]">
                        No channels found
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Deal Summary */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-sm font-medium text-[#0F172A]">
                Deal Summary
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSummaryGenerated(false);
                  generateSummary.mutate({
                    address,
                    bedrooms: reportData.bedrooms,
                    bathrooms: reportData.bathrooms,
                    annualRevenue: reportData.annualRevenue,
                    occupancyRate: reportData.occupancyRate,
                    averageDailyRate: reportData.averageDailyRate,
                    verdict: reportData.verdict,
                    reportType: reportData.reportType || "property",
                  });
                }}
                disabled={generateSummary.isPending}
                className="h-7 text-xs gap-1 text-[#C9A962] hover:text-[#C9A962]/80"
              >
                {generateSummary.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {generateSummary.isPending ? "Generating..." : "Regenerate"}
              </Button>
            </div>
            {generateSummary.isPending && !dealSummary ? (
              <div className="flex items-center justify-center py-6 border border-dashed border-[#e2e8f0] rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-[#C9A962] mr-2" />
                <span className="text-sm text-[#94a3b8]">
                  Writing deal summary...
                </span>
              </div>
            ) : (
              <Textarea
                value={dealSummary}
                onChange={(e) => setDealSummary(e.target.value)}
                rows={4}
                placeholder="AI-generated deal summary will appear here..."
                className="resize-none text-sm"
              />
            )}
          </div>

          {/* Custom message (optional) */}
          <div>
            <Label className="text-sm font-medium text-[#0F172A]">
              Custom Message{" "}
              <span className="text-[#94a3b8] font-normal">(optional)</span>
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
              placeholder="Add a personal note to the client..."
              className="mt-1.5 resize-none text-sm"
            />
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full gap-2 bg-[#0F172A] hover:bg-[#1e293b] text-white"
          >
            {sendReport.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sendReport.isPending
              ? "Sending..."
              : `Send to ${selectedChannel ? "#" + selectedChannel.name : "Slack"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
