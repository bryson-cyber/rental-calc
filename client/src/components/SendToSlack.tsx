/**
 * SendToSlack Admin Component
 * 
 * Allows admin to:
 * 1. Search and select a Slack channel from the workspace
 * 2. Pick an existing property report (Step 5 or Universal Shareable)
 * 3. Generate an AI deal summary via Gemini
 * 4. Send the report link + deal summary to the selected channel
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Hash,
  Send,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  Building,
  Calendar,
  DollarSign,
  ExternalLink,
  X,
  MessageSquare,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface SlackChannel {
  id: string;
  name: string;
  purpose?: string;
  created?: string;
}

interface ReportItem {
  id: number;
  shareCode: string;
  reportType: string;
  address: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  title: string | null;
  annualRevenue: number | null;
  occupancyRate: string | null;
  averageDailyRate: number | null;
  verdict: string | null;
  createdAt: string | null;
  source: "shared" | "universal";
  shareUrl: string;
}

// ============================================
// COMPONENT
// ============================================

export default function SendToSlack() {
  // --- State ---
  const [channelSearch, setChannelSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  const [reportSearch, setReportSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const [dealSummary, setDealSummary] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sentPermalink, setSentPermalink] = useState<string | null>(null);

  // --- Queries ---
  const channelsQuery = trpc.slackAdmin.searchChannels.useQuery(
    { query: channelSearch || "a" },
    { enabled: channelSearch.length > 0 || showChannelDropdown, staleTime: 10000 }
  );

  const reportsQuery = trpc.slackAdmin.getReports.useQuery(
    { search: reportSearch || undefined, limit: 20 },
    { staleTime: 5000 }
  );

  // --- Mutations ---
  const generateSummaryMutation = trpc.slackAdmin.generateSummary.useMutation({
    onSuccess: (data) => {
      setDealSummary(data.summary);
      toast.success("Deal summary generated");
    },
    onError: (err) => {
      toast.error(`Failed to generate summary: ${err.message}`);
    },
  });

  const sendReportMutation = trpc.slackAdmin.sendReport.useMutation({
    onSuccess: (data) => {
      setSent(true);
      setSentPermalink(data.permalink || null);
      toast.success(`Report sent to #${data.channelName || selectedChannel?.name}`);
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
    },
  });

  // --- Handlers ---
  const handleGenerateSummary = () => {
    if (!selectedReport) return;
    
    generateSummaryMutation.mutate({
      address: selectedReport.address || "Unknown",
      bedrooms: selectedReport.bedrooms || undefined,
      bathrooms: selectedReport.bathrooms ? parseFloat(selectedReport.bathrooms) : undefined,
      annualRevenue: selectedReport.annualRevenue || undefined,
      occupancyRate: selectedReport.occupancyRate ? parseFloat(selectedReport.occupancyRate) : undefined,
      averageDailyRate: selectedReport.averageDailyRate || undefined,
      verdict: selectedReport.verdict || undefined,
      reportType: selectedReport.reportType,
    });
  };

  const handleSend = () => {
    if (!selectedChannel || !selectedReport || !dealSummary) return;

    sendReportMutation.mutate({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      shareCode: selectedReport.shareCode,
      reportSource: selectedReport.source,
      address: selectedReport.address || "Unknown",
      dealSummary,
      customMessage: customMessage || undefined,
    });
  };

  const handleReset = () => {
    setSelectedChannel(null);
    setSelectedReport(null);
    setDealSummary("");
    setCustomMessage("");
    setSent(false);
    setSentPermalink(null);
    setChannelSearch("");
    setReportSearch("");
  };

  // --- Derived ---
  const channels = channelsQuery.data?.channels || [];
  const reports = reportsQuery.data?.reports || [];
  const canSend = selectedChannel && selectedReport && dealSummary.trim().length > 0;
  const isSending = sendReportMutation.isPending;

  // Format helpers
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string | Date) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const reportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full: "Full Report",
      property: "Property",
      market: "Market",
      revenue: "Revenue",
      validator: "Validator",
      ai_advisor: "AI Advisor",
      listings: "Listings",
      comparison: "Comparison",
      map: "Map",
      regulation: "Regulation",
    };
    return labels[type] || type;
  };

  // --- Success State ---
  if (sent) {
    return (
      <div className="space-y-6">
        <Card className="bg-[#1e293b] border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Report Sent Successfully</h3>
                <p className="text-white/70">
                  Sent to <span className="font-medium text-[#C9A962]">#{selectedChannel?.name}</span>
                </p>
                <p className="text-sm text-white/50 mt-1">{selectedReport?.address}</p>
              </div>
              {sentPermalink && (
                <a
                  href={sentPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#C9A962] hover:text-[#b8963f] underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View in Slack
                </a>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                className="mt-4 border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]"
              >
                Send Another Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="space-y-6">
      {/* Step 1: Select Channel */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#C9A962]" />
            1. Select Slack Channel
          </CardTitle>
          <CardDescription className="text-white/50">
            Search your workspace to find the client's channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedChannel ? (
            <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#C9A962]" />
                <span className="font-medium text-white">{selectedChannel.name}</span>
                {selectedChannel.purpose && (
                  <span className="text-sm text-white/40 truncate max-w-[200px]">
                    — {selectedChannel.purpose}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedChannel(null);
                  setChannelSearch("");
                }}
                className="text-white/50 hover:text-white hover:bg-[#334155]"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search channels..."
                  value={channelSearch}
                  onChange={(e) => {
                    setChannelSearch(e.target.value);
                    setShowChannelDropdown(true);
                  }}
                  onFocus={() => setShowChannelDropdown(true)}
                  className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
                />
              </div>
              {showChannelDropdown && channelSearch.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-[#334155] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {channelsQuery.isLoading ? (
                    <div className="flex items-center justify-center p-4 gap-2 text-sm text-white/50">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching channels...
                    </div>
                  ) : channels.length === 0 ? (
                    <div className="p-4 text-sm text-white/50 text-center">
                      No channels found for "{channelSearch}"
                    </div>
                  ) : (
                    channels.map((ch) => (
                      <button
                        key={ch.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#334155] transition-colors flex items-center gap-2"
                        onClick={() => {
                          setSelectedChannel(ch);
                          setShowChannelDropdown(false);
                          setChannelSearch("");
                        }}
                      >
                        <Hash className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-white">{ch.name}</span>
                          {ch.purpose && (
                            <p className="text-xs text-white/40 truncate">{ch.purpose}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Report */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A962]" />
            2. Select Report
          </CardTitle>
          <CardDescription className="text-white/50">
            Choose an existing property report to send
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedReport ? (
            <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
              <div className="flex items-center gap-3 min-w-0">
                <Building className="w-4 h-4 text-[#C9A962] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white truncate">
                      {selectedReport.address || "Unknown Address"}
                    </span>
                    <Badge variant="outline" className="text-xs text-[#C9A962] border-[#C9A962]/30 flex-shrink-0">
                      {reportTypeLabel(selectedReport.reportType)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                    {selectedReport.annualRevenue && (
                      <span>{formatCurrency(selectedReport.annualRevenue)}/yr</span>
                    )}
                    {selectedReport.bedrooms && <span>{selectedReport.bedrooms} BR</span>}
                    {selectedReport.createdAt && <span>{formatDate(selectedReport.createdAt)}</span>}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedReport(null);
                  setDealSummary("");
                }}
                className="text-white/50 hover:text-white hover:bg-[#334155]"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search by address..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
                />
              </div>
              <div className="border border-[#334155] rounded-lg max-h-64 overflow-y-auto">
                {reportsQuery.isLoading ? (
                  <div className="flex items-center justify-center p-6 gap-2 text-sm text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading reports...
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-6 text-sm text-white/50 text-center">
                    No reports found{reportSearch ? ` for "${reportSearch}"` : ""}
                  </div>
                ) : (
                  reports.map((report) => (
                    <button
                      key={`${report.source}-${report.id}`}
                      className="w-full text-left px-3 py-3 hover:bg-[#334155] transition-colors border-b border-[#334155] last:border-b-0 flex items-center gap-3"
                      onClick={() => {
                        setSelectedReport(report as ReportItem);
                        setDealSummary("");
                      }}
                    >
                      <Building className="w-4 h-4 text-white/40 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white truncate">
                            {report.address || report.title || "Unknown"}
                          </span>
                          <Badge variant="outline" className="text-xs text-white/50 border-[#334155] flex-shrink-0">
                            {reportTypeLabel(report.reportType)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                          {report.annualRevenue && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(report.annualRevenue)}/yr
                            </span>
                          )}
                          {report.bedrooms && <span>{report.bedrooms} BR</span>}
                          {report.verdict && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                report.verdict.toLowerCase().includes("strong")
                                  ? "text-green-400 border-green-500/30"
                                  : report.verdict.toLowerCase().includes("moderate")
                                  ? "text-yellow-400 border-yellow-500/30"
                                  : "text-white/50 border-[#334155]"
                              }`}
                            >
                              {report.verdict}
                            </Badge>
                          )}
                          {report.createdAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(report.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: AI Deal Summary */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C9A962]" />
            3. Deal Summary
          </CardTitle>
          <CardDescription className="text-white/50">
            AI-generated opportunity pitch — edit before sending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={!selectedReport || generateSummaryMutation.isPending}
              className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155] flex items-center gap-2"
            >
              {generateSummaryMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {dealSummary ? "Regenerate" : "Generate"} Summary
            </Button>
            {dealSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDealSummary("")}
                className="text-white/50 hover:text-white hover:bg-[#334155]"
              >
                Clear
              </Button>
            )}
          </div>
          <Textarea
            placeholder={
              selectedReport
                ? "Click 'Generate Summary' to create an AI deal pitch, or write your own..."
                : "Select a report first to generate a deal summary"
            }
            value={dealSummary}
            onChange={(e) => setDealSummary(e.target.value)}
            rows={5}
            disabled={!selectedReport}
            className="resize-none bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
          />
        </CardContent>
      </Card>

      {/* Step 4: Custom Message (Optional) */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C9A962]" />
            4. Personal Message
            <Badge variant="outline" className="text-white/40 border-[#334155] text-xs">Optional</Badge>
          </CardTitle>
          <CardDescription className="text-white/50">
            Add a personal note above the deal summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Hey! Check out this property I found for you..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
            className="resize-none bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
          />
        </CardContent>
      </Card>

      {/* Send Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleReset}
          className="text-white/50 hover:text-white hover:bg-[#334155]"
        >
          Reset All
        </Button>
        <Button
          onClick={handleSend}
          disabled={!canSend || isSending}
          size="lg"
          className="bg-[#C9A962] text-[#0F172A] hover:bg-[#b8963f] font-medium flex items-center gap-2 min-w-[160px]"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send to Slack
            </>
          )}
        </Button>
      </div>

      {/* Preview */}
      {canSend && (
        <Card className="bg-[#0F172A] border-[#334155] border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/40">Message Preview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-white/70">
            {customMessage && (
              <>
                <p>{customMessage}</p>
                <hr className="border-[#334155] border-dashed" />
              </>
            )}
            <p className="whitespace-pre-wrap">{dealSummary}</p>
            <p className="text-[#C9A962] font-medium">
              View Full Report
            </p>
            <p className="text-xs text-white/40">
              Zillow | Redfin
            </p>
            <p className="text-xs text-white/30 italic">
              Sent by Coach Inayah's Turnkey Tool
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
