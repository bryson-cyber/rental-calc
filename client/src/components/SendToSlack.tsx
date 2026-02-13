/**
 * SendToSlack Admin Component
 * 
 * Three tabs:
 * 1. Send Report — pick a channel, report, generate AI summary, send
 * 2. Batch Send — pick multiple channels, same report + summary, send to all
 * 3. Delivery History — see all past sends with stats
 */

import { useState, useMemo } from "react";
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
  History,
  Users,
  BarChart3,
  AlertCircle,
  ChevronDown,
  ChevronUp,
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

type TabId = "send" | "batch" | "history";

// ============================================
// HELPERS
// ============================================

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatDateTime = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const reportTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    full: "Full Report", property: "Property", market: "Market", revenue: "Revenue",
    validator: "Validator", ai_advisor: "AI Advisor", listings: "Listings",
    comparison: "Comparison", map: "Map", regulation: "Regulation",
  };
  return labels[type] || type;
};

// ============================================
// SUB-COMPONENTS
// ============================================

/** Reusable channel search + select */
function ChannelPicker({
  selectedChannel,
  onSelect,
  onClear,
}: {
  selectedChannel: SlackChannel | null;
  onSelect: (ch: SlackChannel) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const channelsQuery = trpc.slackAdmin.searchChannels.useQuery(
    { query: search || "a" },
    { enabled: search.length > 0 || showDropdown, staleTime: 10000 }
  );
  const channels = channelsQuery.data?.channels || [];

  if (selectedChannel) {
    return (
      <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-[#C9A962]" />
          <span className="font-medium text-white">{selectedChannel.name}</span>
          {selectedChannel.purpose && (
            <span className="text-sm text-white/40 truncate max-w-[200px]">— {selectedChannel.purpose}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-white/50 hover:text-white hover:bg-[#334155]">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Search channels..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
        />
      </div>
      {showDropdown && search.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-[#334155] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {channelsQuery.isLoading ? (
            <div className="flex items-center justify-center p-4 gap-2 text-sm text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-sm text-white/50 text-center">No channels found for "{search}"</div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                className="w-full text-left px-3 py-2.5 hover:bg-[#334155] transition-colors flex items-center gap-2"
                onClick={() => { onSelect(ch); setShowDropdown(false); setSearch(""); }}
              >
                <Hash className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-sm text-white">{ch.name}</span>
                  {ch.purpose && <p className="text-xs text-white/40 truncate">{ch.purpose}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Multi-channel picker for batch send */
function MultiChannelPicker({
  selectedChannels,
  onAdd,
  onRemove,
}: {
  selectedChannels: SlackChannel[];
  onAdd: (ch: SlackChannel) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const channelsQuery = trpc.slackAdmin.searchChannels.useQuery(
    { query: search || "a" },
    { enabled: search.length > 0 || showDropdown, staleTime: 10000 }
  );
  const channels = channelsQuery.data?.channels || [];
  const selectedIds = useMemo(() => new Set(selectedChannels.map(c => c.id)), [selectedChannels]);

  return (
    <div className="space-y-3">
      {selectedChannels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedChannels.map((ch) => (
            <div key={ch.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0F172A] rounded-md border border-[#334155]">
              <Hash className="w-3 h-3 text-[#C9A962]" />
              <span className="text-sm text-white">{ch.name}</span>
              <button onClick={() => onRemove(ch.id)} className="text-white/40 hover:text-white ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search and add channels..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
          />
        </div>
        {showDropdown && search.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-[#334155] rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {channelsQuery.isLoading ? (
              <div className="flex items-center justify-center p-4 gap-2 text-sm text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            ) : channels.length === 0 ? (
              <div className="p-4 text-sm text-white/50 text-center">No channels found</div>
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  disabled={selectedIds.has(ch.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2 ${
                    selectedIds.has(ch.id) ? "opacity-40 cursor-not-allowed" : "hover:bg-[#334155]"
                  }`}
                  onClick={() => { if (!selectedIds.has(ch.id)) { onAdd(ch); setSearch(""); } }}
                >
                  <Hash className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                  <span className="font-medium text-sm text-white">{ch.name}</span>
                  {selectedIds.has(ch.id) && (
                    <Badge variant="outline" className="text-xs text-white/30 border-[#334155] ml-auto">Added</Badge>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Report picker (shared between single and batch) */
function ReportPicker({
  selectedReport,
  onSelect,
  onClear,
}: {
  selectedReport: ReportItem | null;
  onSelect: (r: ReportItem) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");

  const reportsQuery = trpc.slackAdmin.getReports.useQuery(
    { search: search || undefined, limit: 20 },
    { staleTime: 5000 }
  );
  const reports = reportsQuery.data?.reports || [];

  if (selectedReport) {
    return (
      <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
        <div className="flex items-center gap-3 min-w-0">
          <Building className="w-4 h-4 text-[#C9A962] flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-white truncate">{selectedReport.address || "Unknown Address"}</span>
              <Badge variant="outline" className="text-xs text-[#C9A962] border-[#C9A962]/30 flex-shrink-0">
                {reportTypeLabel(selectedReport.reportType)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
              {selectedReport.annualRevenue && <span>{formatCurrency(selectedReport.annualRevenue)}/yr</span>}
              {selectedReport.bedrooms && <span>{selectedReport.bedrooms} BR</span>}
              {selectedReport.createdAt && <span>{formatDate(selectedReport.createdAt)}</span>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-white/50 hover:text-white hover:bg-[#334155]">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Search by address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
        />
      </div>
      <div className="border border-[#334155] rounded-lg max-h-64 overflow-y-auto">
        {reportsQuery.isLoading ? (
          <div className="flex items-center justify-center p-6 gap-2 text-sm text-white/50">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-sm text-white/50 text-center">
            No reports found{search ? ` for "${search}"` : ""}
          </div>
        ) : (
          reports.map((report) => (
            <button
              key={`${report.source}-${report.id}`}
              className="w-full text-left px-3 py-3 hover:bg-[#334155] transition-colors border-b border-[#334155] last:border-b-0 flex items-center gap-3"
              onClick={() => { onSelect(report as ReportItem); }}
            >
              <Building className="w-4 h-4 text-white/40 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white truncate">{report.address || report.title || "Unknown"}</span>
                  <Badge variant="outline" className="text-xs text-white/50 border-[#334155] flex-shrink-0">
                    {reportTypeLabel(report.reportType)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                  {report.annualRevenue && (
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatCurrency(report.annualRevenue)}/yr</span>
                  )}
                  {report.bedrooms && <span>{report.bedrooms} BR</span>}
                  {report.verdict && (
                    <Badge variant="outline" className={`text-xs ${
                      report.verdict.toLowerCase().includes("strong") ? "text-green-400 border-green-500/30" :
                      report.verdict.toLowerCase().includes("moderate") ? "text-yellow-400 border-yellow-500/30" :
                      "text-white/50 border-[#334155]"
                    }`}>{report.verdict}</Badge>
                  )}
                  {report.createdAt && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(report.createdAt)}</span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/** Deal summary generator + editor */
function DealSummarySection({
  selectedReport,
  dealSummary,
  setDealSummary,
}: {
  selectedReport: ReportItem | null;
  dealSummary: string;
  setDealSummary: (v: string) => void;
}) {
  const generateMutation = trpc.slackAdmin.generateSummary.useMutation({
    onSuccess: (data) => { setDealSummary(data.summary); toast.success("Deal summary generated"); },
    onError: (err) => { toast.error(`Failed to generate summary: ${err.message}`); },
  });

  const handleGenerate = () => {
    if (!selectedReport) return;
    generateMutation.mutate({
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

  return (
    <Card className="bg-[#1e293b] border-[#334155]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C9A962]" /> Deal Summary
        </CardTitle>
        <CardDescription className="text-white/50">AI-generated opportunity pitch — edit before sending</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={handleGenerate}
            disabled={!selectedReport || generateMutation.isPending}
            className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155] flex items-center gap-2"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {dealSummary ? "Regenerate" : "Generate"} Summary
          </Button>
          {dealSummary && (
            <Button variant="ghost" size="sm" onClick={() => setDealSummary("")} className="text-white/50 hover:text-white hover:bg-[#334155]">
              Clear
            </Button>
          )}
        </div>
        <Textarea
          placeholder={selectedReport ? "Click 'Generate Summary' to create an AI deal pitch, or write your own..." : "Select a report first"}
          value={dealSummary}
          onChange={(e) => setDealSummary(e.target.value)}
          rows={5}
          disabled={!selectedReport}
          className="resize-none bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
        />
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SendToSlack() {
  const [activeTab, setActiveTab] = useState<TabId>("send");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "send", label: "Send Report", icon: <Send className="w-4 h-4" /> },
    { id: "batch", label: "Batch Send", icon: <Users className="w-4 h-4" /> },
    { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-[#0F172A] rounded-lg border border-[#334155]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[#1e293b] text-[#C9A962] shadow-sm"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "send" && <SingleSendTab />}
      {activeTab === "batch" && <BatchSendTab />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

// ============================================
// TAB: Single Send
// ============================================

function SingleSendTab() {
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [dealSummary, setDealSummary] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sentPermalink, setSentPermalink] = useState<string | null>(null);

  const sendMutation = trpc.slackAdmin.sendReport.useMutation({
    onSuccess: (data) => {
      setSent(true);
      setSentPermalink(data.permalink || null);
      toast.success(`Report sent to #${data.channelName || selectedChannel?.name}`);
    },
    onError: (err) => { toast.error(`Failed to send: ${err.message}`); },
  });

  const handleSend = () => {
    if (!selectedChannel || !selectedReport || !dealSummary) return;
    sendMutation.mutate({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      shareCode: selectedReport.shareCode,
      reportSource: selectedReport.source,
      address: selectedReport.address || "Unknown",
      reportType: selectedReport.reportType,
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
  };

  const canSend = selectedChannel && selectedReport && dealSummary.trim().length > 0;

  if (sent) {
    return (
      <Card className="bg-[#1e293b] border-green-500/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">Report Sent</h3>
              <p className="text-white/70">Sent to <span className="font-medium text-[#C9A962]">#{selectedChannel?.name}</span></p>
              <p className="text-sm text-white/50 mt-1">{selectedReport?.address}</p>
            </div>
            {sentPermalink && (
              <a href={sentPermalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[#C9A962] hover:text-[#b8963f] underline">
                <ExternalLink className="w-4 h-4" /> View in Slack
              </a>
            )}
            <Button onClick={handleReset} variant="outline" className="mt-4 border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]">
              Send Another Report
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Channel */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#C9A962]" /> 1. Select Channel
          </CardTitle>
          <CardDescription className="text-white/50">Search your workspace to find the client's channel</CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelPicker selectedChannel={selectedChannel} onSelect={setSelectedChannel} onClear={() => setSelectedChannel(null)} />
        </CardContent>
      </Card>

      {/* Step 2: Report */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A962]" /> 2. Select Report
          </CardTitle>
          <CardDescription className="text-white/50">Choose an existing property report to send</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportPicker selectedReport={selectedReport} onSelect={(r) => { setSelectedReport(r); setDealSummary(""); }} onClear={() => { setSelectedReport(null); setDealSummary(""); }} />
        </CardContent>
      </Card>

      {/* Step 3: Deal Summary */}
      <DealSummarySection selectedReport={selectedReport} dealSummary={dealSummary} setDealSummary={setDealSummary} />

      {/* Step 4: Custom Message */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C9A962]" /> Personal Message
            <Badge variant="outline" className="text-white/40 border-[#334155] text-xs">Optional</Badge>
          </CardTitle>
          <CardDescription className="text-white/50">Add a personal note above the deal summary</CardDescription>
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
        <Button variant="ghost" onClick={handleReset} className="text-white/50 hover:text-white hover:bg-[#334155]">Reset All</Button>
        <Button
          onClick={handleSend}
          disabled={!canSend || sendMutation.isPending}
          size="lg"
          className="bg-[#C9A962] text-[#0F172A] hover:bg-[#b8963f] font-medium flex items-center gap-2 min-w-[160px]"
        >
          {sendMutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>) : (<><Send className="w-4 h-4" /> Send to Slack</>)}
        </Button>
      </div>

      {/* Preview */}
      {canSend && (
        <Card className="bg-[#0F172A] border-[#334155] border-dashed">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white/40">Message Preview</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2 text-white/70">
            {customMessage && (<><p>{customMessage}</p><hr className="border-[#334155] border-dashed" /></>)}
            <p className="whitespace-pre-wrap">{dealSummary}</p>
            <p className="text-[#C9A962] font-medium">View Full Report</p>
            <p className="text-xs text-white/40">Zillow | Redfin</p>
            <p className="text-xs text-white/30 italic">Sent by Coach Inayah's Turnkey Tool</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// TAB: Batch Send
// ============================================

function BatchSendTab() {
  const [selectedChannels, setSelectedChannels] = useState<SlackChannel[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [dealSummary, setDealSummary] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [batchResult, setBatchResult] = useState<{
    batchId: string;
    totalChannels: number;
    successCount: number;
    failCount: number;
    results: Array<{ channelId: string; channelName?: string; success: boolean; error?: string }>;
  } | null>(null);

  const batchMutation = trpc.slackAdmin.batchSendReport.useMutation({
    onSuccess: (data) => {
      setBatchResult(data);
      toast.success(`Sent to ${data.successCount}/${data.totalChannels} channels`);
    },
    onError: (err) => { toast.error(`Batch send failed: ${err.message}`); },
  });

  const handleBatchSend = () => {
    if (selectedChannels.length === 0 || !selectedReport || !dealSummary) return;
    batchMutation.mutate({
      channels: selectedChannels.map(ch => ({ id: ch.id, name: ch.name })),
      shareCode: selectedReport.shareCode,
      reportSource: selectedReport.source,
      address: selectedReport.address || "Unknown",
      reportType: selectedReport.reportType,
      dealSummary,
      customMessage: customMessage || undefined,
    });
  };

  const handleReset = () => {
    setSelectedChannels([]);
    setSelectedReport(null);
    setDealSummary("");
    setCustomMessage("");
    setBatchResult(null);
  };

  const canSend = selectedChannels.length > 0 && selectedReport && dealSummary.trim().length > 0;

  if (batchResult) {
    return (
      <div className="space-y-4">
        <Card className="bg-[#1e293b] border-[#334155]">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                batchResult.failCount === 0 ? "bg-green-900/30" : "bg-yellow-900/30"
              }`}>
                {batchResult.failCount === 0 ? (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Batch Send Complete</h3>
                <p className="text-white/70">
                  <span className="text-green-400 font-medium">{batchResult.successCount} sent</span>
                  {batchResult.failCount > 0 && (
                    <> / <span className="text-red-400 font-medium">{batchResult.failCount} failed</span></>
                  )}
                  {" "}out of {batchResult.totalChannels} channels
                </p>
              </div>
            </div>

            {/* Per-channel results */}
            <div className="border border-[#334155] rounded-lg divide-y divide-[#334155] mt-4">
              {batchResult.results.map((r) => (
                <div key={r.channelId} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-sm text-white">{r.channelName || r.channelId}</span>
                  </div>
                  {r.success ? (
                    <Badge className="bg-green-900/30 text-green-400 border-green-500/30">Sent</Badge>
                  ) : (
                    <Badge className="bg-red-900/30 text-red-400 border-red-500/30">{r.error || "Failed"}</Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-6">
              <Button onClick={handleReset} variant="outline" className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]">
                Send Another Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Channels */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C9A962]" /> 1. Select Channels
            {selectedChannels.length > 0 && (
              <Badge variant="outline" className="text-[#C9A962] border-[#C9A962]/30 text-xs ml-auto">
                {selectedChannels.length} selected
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-white/50">Search and add multiple client channels</CardDescription>
        </CardHeader>
        <CardContent>
          <MultiChannelPicker
            selectedChannels={selectedChannels}
            onAdd={(ch) => setSelectedChannels(prev => [...prev, ch])}
            onRemove={(id) => setSelectedChannels(prev => prev.filter(c => c.id !== id))}
          />
        </CardContent>
      </Card>

      {/* Step 2: Report */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A962]" /> 2. Select Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReportPicker selectedReport={selectedReport} onSelect={(r) => { setSelectedReport(r); setDealSummary(""); }} onClear={() => { setSelectedReport(null); setDealSummary(""); }} />
        </CardContent>
      </Card>

      {/* Step 3: Deal Summary */}
      <DealSummarySection selectedReport={selectedReport} dealSummary={dealSummary} setDealSummary={setDealSummary} />

      {/* Step 4: Custom Message */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C9A962]" /> Personal Message
            <Badge variant="outline" className="text-white/40 border-[#334155] text-xs">Optional</Badge>
          </CardTitle>
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

      {/* Batch Send Button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleReset} className="text-white/50 hover:text-white hover:bg-[#334155]">Reset All</Button>
        <Button
          onClick={handleBatchSend}
          disabled={!canSend || batchMutation.isPending}
          size="lg"
          className="bg-[#C9A962] text-[#0F172A] hover:bg-[#b8963f] font-medium flex items-center gap-2 min-w-[200px]"
        >
          {batchMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending to {selectedChannels.length} channels...</>
          ) : (
            <><Send className="w-4 h-4" /> Send to {selectedChannels.length} Channel{selectedChannels.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// TAB: Delivery History
// ============================================

function HistoryTab() {
  const [statusFilter, setStatusFilter] = useState<"sent" | "failed" | undefined>(undefined);
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const statsQuery = trpc.slackAdmin.getDeliveryStats.useQuery(undefined, { staleTime: 10000 });
  const historyQuery = trpc.slackAdmin.getDeliveryHistory.useQuery(
    { limit: pageSize, offset: page * pageSize, status: statusFilter, search: searchFilter || undefined },
    { staleTime: 5000 }
  );

  const stats = statsQuery.data;
  const deliveries = historyQuery.data?.deliveries || [];
  const total = historyQuery.data?.total || 0;
  const hasMore = historyQuery.data?.hasMore || false;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-[#1e293b] border-[#334155]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Total Sent</p>
              <p className="text-2xl font-semibold text-white mt-1">{stats.sent}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1e293b] border-[#334155]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Failed</p>
              <p className="text-2xl font-semibold text-red-400 mt-1">{stats.failed}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1e293b] border-[#334155]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Channels</p>
              <p className="text-2xl font-semibold text-[#C9A962] mt-1">{stats.uniqueChannels}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1e293b] border-[#334155]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Reports</p>
              <p className="text-2xl font-semibold text-white mt-1">{stats.uniqueReports}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search by address..."
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setPage(0); }}
            className="pl-9 bg-[#0F172A] border-[#334155] text-white placeholder:text-white/30"
          />
        </div>
        <div className="flex gap-1 p-1 bg-[#0F172A] rounded-lg border border-[#334155]">
          {[
            { value: undefined, label: "All" },
            { value: "sent" as const, label: "Sent" },
            { value: "failed" as const, label: "Failed" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setStatusFilter(opt.value); setPage(0); }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-[#1e293b] text-[#C9A962]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery List */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardContent className="p-0">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center p-8 gap-2 text-sm text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading delivery history...
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-white/50">
              <History className="w-8 h-8 text-white/20" />
              <p className="text-sm">No deliveries found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#334155]">
              {deliveries.map((d) => (
                <div key={d.id} className="px-4 py-3 hover:bg-[#0F172A]/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <span className="text-sm font-medium text-white">{d.channelName || d.channelId}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            d.status === "sent" ? "text-green-400 border-green-500/30" :
                            d.status === "failed" ? "text-red-400 border-red-500/30" :
                            "text-yellow-400 border-yellow-500/30"
                          }`}
                        >
                          {d.status}
                        </Badge>
                        {d.batchId && (
                          <Badge variant="outline" className="text-xs text-white/30 border-[#334155]">Batch</Badge>
                        )}
                      </div>
                      <p className="text-sm text-white/60 truncate">{d.address || "Unknown address"}</p>
                      {d.dealSummary && (
                        <p className="text-xs text-white/40 mt-1 line-clamp-2">{d.dealSummary}</p>
                      )}
                      {d.errorMessage && (
                        <p className="text-xs text-red-400/70 mt-1">{d.errorMessage}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-white/40">{formatDateTime(d.createdAt)}</p>
                      {d.sentByName && <p className="text-xs text-white/30 mt-0.5">by {d.sentByName}</p>}
                      {d.slackPermalink && (
                        <a href={d.slackPermalink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C9A962] hover:underline mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/40">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]"
            >
              <ChevronUp className="w-4 h-4 rotate-[-90deg]" /> Prev
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]"
            >
              Next <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
