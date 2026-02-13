import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Hash,
  MapPin,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface SlackChannel {
  id: string;
  name: string;
  topic?: string;
}

// Pre-configured channels from the workspace
const DEFAULT_CHANNELS: SlackChannel[] = [
  { id: "C07USEEKPNK", name: "cape-coral-property-management" },
  { id: "C07S7FBPC5U", name: "stl-property-management" },
  { id: "C07V45JGHE1", name: "austin-tx-property-management" },
  { id: "C082TEM4W6M", name: "property-issue-tracking" },
  { id: "C08DV0XTZ1D", name: "bilaal-properties" },
  { id: "C049W2T8MUG", name: "general" },
  { id: "C072UDB1ML7", name: "general-coachinayah-management" },
  { id: "C0981C9RK8R", name: "app-to-slack-migration" },
];

export default function SendToSlack() {
  const [selectedChannel, setSelectedChannel] = useState("");
  const [address, setAddress] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [customMessage, setCustomMessage] = useState("");
  const [customChannelId, setCustomChannelId] = useState("");
  const [customChannelName, setCustomChannelName] = useState("");
  const [showCustomChannel, setShowCustomChannel] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    address?: string;
    channelName?: string;
    estimate?: { annual_revenue: number; monthly_revenue: number; adr: number; occupancy: number };
    error?: string;
    preview?: any;
  } | null>(null);

  const sendReport = trpc.slackAdmin.sendReport.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      if (data.success) {
        toast.success(`Revenue estimate for ${data.address} posted to #${data.channelName || selectedChannel}`);
      } else {
        toast.error(data.error || "No webhook URL configured. See preview below.");
      }
    },
    onError: (error) => {
      setLastResult({ success: false, error: error.message });
      toast.error(error.message);
    },
  });

  const getChannelId = useCallback(() => {
    if (showCustomChannel) return customChannelId;
    return selectedChannel;
  }, [showCustomChannel, customChannelId, selectedChannel]);

  const getChannelName = useCallback(() => {
    if (showCustomChannel) return customChannelName;
    const ch = DEFAULT_CHANNELS.find(c => c.id === selectedChannel);
    return ch?.name || "";
  }, [showCustomChannel, customChannelName, selectedChannel]);

  const handleSend = () => {
    const channelId = getChannelId();
    const channelName = getChannelName();

    if (!channelId) {
      toast.error("Choose a Slack channel to send the report to.");
      return;
    }
    if (!address || address.length < 5) {
      toast.error("Provide a full property address to analyze.");
      return;
    }

    sendReport.mutate({
      channelId,
      channelName,
      address,
      bedrooms,
      bathrooms,
      customMessage: customMessage.trim() || undefined,
    });
  };

  const handleReset = () => {
    setAddress("");
    setBedrooms(2);
    setBathrooms(1);
    setCustomMessage("");
    setLastResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Send Report Card */}
      <Card className="bg-[#1e293b] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-[#C9A962]" />
            Send Deal to Slack
          </CardTitle>
          <CardDescription className="text-white/60">
            Run a revenue analysis and send the results directly to a client's Slack channel with your personal message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channel Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#C9A962]" />
              Slack Channel
            </label>
            {!showCustomChannel ? (
              <div className="flex gap-2">
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white">
                    <SelectValue placeholder="Select a channel..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-[#334155]">
                    {DEFAULT_CHANNELS.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id} className="text-white hover:bg-[#334155]">
                        #{ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomChannel(true)}
                  className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155] whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Custom
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Channel ID (e.g. C07USEEKPNK)"
                    value={customChannelId}
                    onChange={(e) => setCustomChannelId(e.target.value)}
                    className="bg-[#0F172A] border-[#334155] text-white"
                  />
                  <Input
                    placeholder="Channel name (e.g. my-channel)"
                    value={customChannelName}
                    onChange={(e) => setCustomChannelName(e.target.value)}
                    className="bg-[#0F172A] border-[#334155] text-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowCustomChannel(false); setCustomChannelId(""); setCustomChannelName(""); }}
                    className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-white/40">
                  Find the Channel ID in Slack: right-click the channel name, copy link, the ID is the last part of the URL.
                </p>
              </div>
            )}
          </div>

          {/* Property Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C9A962]" />
              Property Address
            </label>
            <Input
              placeholder="123 Main St, Atlanta, GA 30301"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[#0F172A] border-[#334155] text-white"
            />
          </div>

          {/* Bedrooms / Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Bedrooms</label>
              <Select value={String(bedrooms)} onValueChange={(v) => setBedrooms(Number(v))}>
                <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-white hover:bg-[#334155]">
                      {n} BR
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Bathrooms</label>
              <Select value={String(bathrooms)} onValueChange={(v) => setBathrooms(Number(v))}>
                <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-white hover:bg-[#334155]">
                      {n} BA
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#C9A962]" />
              Message to Client
              <Badge variant="outline" className="text-white/40 border-[#334155] text-xs">Optional</Badge>
            </label>
            <Textarea
              placeholder="Hey! I found a great deal for you — check out this property..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="bg-[#0F172A] border-[#334155] text-white min-h-[80px] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSend}
              disabled={sendReport.isPending || !address || !getChannelId()}
              className="bg-[#C9A962] text-[#0F172A] hover:bg-[#b8963f] font-medium flex-1"
            >
              {sendReport.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing and Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Report to Slack
                </>
              )}
            </Button>
            {lastResult && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-[#334155] text-white/70 hover:text-white hover:bg-[#334155]"
              >
                New Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Card */}
      {lastResult && (
        <Card className={`border ${lastResult.success ? 'bg-[#1e293b] border-green-500/30' : 'bg-[#1e293b] border-amber-500/30'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {lastResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-white font-medium">
                    {lastResult.success 
                      ? `Report sent to #${lastResult.channelName}` 
                      : lastResult.error || "Report could not be sent"
                    }
                  </p>
                  {lastResult.address && (
                    <p className="text-white/60 text-sm mt-1">{lastResult.address}</p>
                  )}
                </div>

                {lastResult.estimate && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#0F172A] rounded-lg p-3">
                      <p className="text-white/50 text-xs">Annual Revenue</p>
                      <p className="text-white font-semibold">${lastResult.estimate.annual_revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0F172A] rounded-lg p-3">
                      <p className="text-white/50 text-xs">Monthly</p>
                      <p className="text-white font-semibold">${lastResult.estimate.monthly_revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0F172A] rounded-lg p-3">
                      <p className="text-white/50 text-xs">Avg Daily Rate</p>
                      <p className="text-white font-semibold">${lastResult.estimate.adr}</p>
                    </div>
                    <div className="bg-[#0F172A] rounded-lg p-3">
                      <p className="text-white/50 text-xs">Occupancy</p>
                      <p className="text-white font-semibold">{lastResult.estimate.occupancy}%</p>
                    </div>
                  </div>
                )}

                {!lastResult.success && lastResult.preview && (
                  <div className="bg-[#0F172A] rounded-lg p-4 border border-[#334155]">
                    <p className="text-white/50 text-xs mb-2">Message Preview (not sent — no webhook configured)</p>
                    <pre className="text-white/80 text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(lastResult.preview, null, 2).substring(0, 500)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
