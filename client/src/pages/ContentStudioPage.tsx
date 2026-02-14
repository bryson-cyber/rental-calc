/**
 * Content Studio — Autonomous Script & Video Generator
 *
 * One-click generates complete YT-style narration scripts and whiteboard
 * animation videos using real platform data. Only long-form formats
 * (Lesson and Deep Dive) — no Reels or Shorts.
 *
 * Video generation is async with polling to avoid timeouts.
 *
 * Exports:
 *   - ContentStudioTab: Embeddable component for the admin dashboard
 *   - ContentStudioPage: Standalone page wrapper
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Clock,
  Users,
  TrendingUp,
  Database,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  Film,
  Zap,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Video,
  Play,
  Download,
  ExternalLink,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ── Format metadata (YT-only) ──────────────────────────────────────────────

const FORMAT_META: Record<string, { icon: typeof BookOpen; color: string; label: string; desc: string }> = {
  lesson: {
    icon: BookOpen,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Lesson',
    desc: '2-5 min educational video',
  },
  deep_dive: {
    icon: GraduationCap,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Deep Dive',
    desc: '5-10 min comprehensive analysis',
  },
};

// ── Main Content Studio Component ───────────────────────────────────────────

function ContentStudioCore() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>('any');
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [expandedScript, setExpandedScript] = useState<number | null>(null);

  // Video job polling state
  const [activeVideoJobId, setActiveVideoJobId] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<{ videoUrl: string; title: string } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── tRPC hooks ──────────────────────────────────────────────────────────

  const autoGenerate = trpc.contentStudio.autoGenerate.useMutation({
    onSuccess: () => {
      scriptsList.refetch();
      toast({
        title: 'Script generated!',
        description: 'Your ready-to-film script is below.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Generation failed',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const dataPreview = trpc.contentStudio.previewData.useQuery(undefined, {
    enabled: showDataPreview,
    staleTime: 60_000,
  });

  const scriptsList = trpc.contentStudio.listScripts.useQuery(
    {
      limit: 50,
      format: formatFilter !== 'any' ? (formatFilter as 'lesson' | 'deep_dive') : undefined,
    },
    { staleTime: 30_000 },
  );

  const deleteScript = trpc.contentStudio.deleteScript.useMutation({
    onSuccess: () => {
      scriptsList.refetch();
      toast({ title: 'Script deleted' });
    },
  });

  const startVideoMutation = trpc.contentStudio.startVideo.useMutation({
    onSuccess: (data) => {
      setActiveVideoJobId(data.jobId);
      toast({
        title: 'Video generation started',
        description: `"${data.title}" is being created. This takes 3-8 minutes.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to start video',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const quickStartVideoMutation = trpc.contentStudio.quickStartVideo.useMutation({
    onSuccess: (data) => {
      setActiveVideoJobId(data.jobId);
      scriptsList.refetch();
      toast({
        title: 'Script + video generation started',
        description: `"${data.title}" is being created. This takes 3-8 minutes.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Generation failed',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const videoStatusQuery = trpc.contentStudio.videoStatus.useQuery(
    { jobId: activeVideoJobId! },
    {
      enabled: !!activeVideoJobId,
      refetchInterval: activeVideoJobId ? 5000 : false,
    },
  );

  // Watch for video completion
  useEffect(() => {
    if (!videoStatusQuery.data) return;
    const status = videoStatusQuery.data;

    if (status.status === 'completed' && status.videoUrl) {
      setVideoResult({ videoUrl: status.videoUrl, title: status.title });
      setActiveVideoJobId(null);
      toast({
        title: 'Video ready!',
        description: `"${status.title}" is ready to watch and download.`,
      });
    } else if (status.status === 'failed') {
      setActiveVideoJobId(null);
      toast({
        title: 'Video generation failed',
        description: status.error || 'An unknown error occurred.',
        variant: 'error',
      });
    }
  }, [videoStatusQuery.data]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = (format?: string) => {
    autoGenerate.mutate(
      format && format !== 'any'
        ? { format: format as 'lesson' | 'deep_dive' }
        : undefined,
    );
  };

  const handleStartVideo = (scriptId: number) => {
    setVideoResult(null);
    startVideoMutation.mutate({ scriptId });
  };

  const handleQuickStartVideo = (format?: 'lesson' | 'deep_dive') => {
    setVideoResult(null);
    quickStartVideoMutation.mutate(format ? { format } : undefined);
  };

  const isGenerating = autoGenerate.isPending;
  const isVideoStarting = startVideoMutation.isPending || quickStartVideoMutation.isPending;
  const isVideoProcessing = !!activeVideoJobId;
  const isBusy = isGenerating || isVideoStarting || isVideoProcessing;

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const latestScript = autoGenerate.data;

  // ── Elapsed time for video generation ──────────────────────────────────

  const videoElapsed = videoStatusQuery.data?.startedAt
    ? Math.floor((Date.now() - videoStatusQuery.data.startedAt) / 1000)
    : 0;
  const videoElapsedStr = videoElapsed > 0
    ? `${Math.floor(videoElapsed / 60)}:${String(videoElapsed % 60).padStart(2, '0')}`
    : '';

  return (
    <div className="space-y-6">
      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-primary font-medium text-sm uppercase tracking-wider">
                  Content Studio
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                YouTube Video Generator
              </h2>
              <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
                One-click generates complete scripts and whiteboard animation videos using your real
                platform data. AI picks the best topic, writes the narrative, and produces a
                ready-to-upload video in Coach Inayah's voice.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {/* Primary actions */}
              <div className="flex gap-2">
                <Button
                  size="lg"
                  onClick={() => handleGenerate()}
                  disabled={isBusy}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> Generate Script</>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleQuickStartVideo()}
                  disabled={isBusy}
                  className="border-primary/30 text-primary hover:bg-primary/5 font-semibold px-6"
                >
                  {isVideoStarting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                  ) : (
                    <><Video className="w-4 h-4 mr-2" /> Script + Video</>
                  )}
                </Button>
              </div>

              {/* Format quick-select */}
              <div className="flex gap-2">
                {Object.entries(FORMAT_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate(key)}
                      disabled={isBusy}
                      className="border-border text-muted-foreground hover:text-foreground hover:border-primary/30 text-xs flex-1"
                    >
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Script generation progress */}
          {isGenerating && (
            <div className="mt-6 flex items-center gap-3 text-muted-foreground text-sm bg-secondary rounded-lg p-3 border border-border">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Pulling platform data... analyzing trends... crafting narrative...</span>
            </div>
          )}

          {/* Video generation progress */}
          {isVideoProcessing && (
            <div className="mt-6 bg-secondary rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Creating Video</p>
                  <p className="text-xs text-muted-foreground">
                    Building whiteboard animation with AI voiceover...
                    {videoElapsedStr && <span className="ml-2 font-mono">{videoElapsedStr}</span>}
                  </p>
                </div>
              </div>
              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(95, (videoElapsed / 480) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Typically takes 3-8 minutes. You can leave this tab open.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Video Result ─────────────────────────────────────────────── */}
      {videoResult && (
        <Card className="border-primary/30 bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Video Ready</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  "{videoResult.title}" — whiteboard explainer with Coach Inayah's voiceover.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => window.open(videoResult.videoUrl, '_blank')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Play className="w-4 h-4 mr-1" /> Watch Video
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = videoResult.videoUrl;
                      a.download = 'coach-inayah-video.mp4';
                      a.click();
                    }}
                    className="border-border"
                  >
                    <Download className="w-4 h-4 mr-1" /> Download MP4
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(videoResult.videoUrl);
                      toast({ title: 'Video URL copied' });
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" /> Copy URL
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Generated Script Result ──────────────────────────────────── */}
      {latestScript && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={FORMAT_META[latestScript.format]?.color || 'bg-secondary text-foreground'}>
                    {latestScript.format === 'lesson' ? 'Lesson' : 'Deep Dive'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    ~{latestScript.estimatedDurationSeconds}s
                  </Badge>
                </div>
                <CardTitle className="text-xl text-foreground">
                  {latestScript.title}
                </CardTitle>
                {latestScript.narrativeAngle && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    Angle: {latestScript.narrativeAngle}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(latestScript.script, 'full-script')}
                >
                  {copiedField === 'full-script' ? (
                    <><Check className="w-4 h-4 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-1" /> Copy</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hook */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Hook (first 3 seconds)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyToClipboard(latestScript.hook, 'hook')}
                >
                  {copiedField === 'hook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <p className="text-foreground font-medium">{latestScript.hook}</p>
            </div>

            {/* Full Script */}
            <div className="bg-secondary/50 border border-border rounded-lg p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Full Narration Script
              </span>
              <div className="text-foreground/80 whitespace-pre-wrap leading-relaxed text-sm">
                {latestScript.script}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-green-700">
                  Call to Action
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyToClipboard(latestScript.cta, 'cta')}
                >
                  {copiedField === 'cta' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <p className="text-green-800 font-medium">{latestScript.cta}</p>
            </div>

            {/* Make Video from this script */}
            {latestScript.id && (
              <div className="bg-secondary border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      Turn this script into a video
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Whiteboard animation with AI voiceover
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartVideo(latestScript.id!)}
                    disabled={isBusy}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isVideoStarting ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Starting...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-1" /> Make Video</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap gap-3 pt-2">
              {latestScript.targetAudience && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {latestScript.targetAudience}
                </div>
              )}
              {latestScript.keyDataPoints && latestScript.keyDataPoints.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BarChart3 className="w-3 h-3" />
                  {latestScript.keyDataPoints.length} data points used
                </div>
              )}
              {latestScript.dataPreview && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Database className="w-3 h-3" />
                  {latestScript.dataPreview.propertiesUsed} properties, {latestScript.dataPreview.marketsUsed} markets
                </div>
              )}
            </div>

            {/* Data points used */}
            {latestScript.keyDataPoints && latestScript.keyDataPoints.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Real Data Points Used
                </p>
                <div className="flex flex-wrap gap-2">
                  {latestScript.keyDataPoints.map((dp: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">
                      {dp}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Data Preview Toggle ──────────────────────────────────────── */}
      <Card className="border-dashed border-border">
        <CardContent className="p-4">
          <button
            onClick={() => setShowDataPreview(!showDataPreview)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Data the AI will use</span>
            {showDataPreview ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showDataPreview && dataPreview.data && (
            <div className="mt-4 space-y-4">
              {/* Platform Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Reports', value: dataPreview.data.platformStats.totalReports },
                  { label: 'Total Leads', value: dataPreview.data.platformStats.totalLeads },
                  { label: 'Recent Properties', value: dataPreview.data.recentProperties.length },
                  { label: 'Markets', value: dataPreview.data.marketSnapshots.length },
                ].map((stat) => (
                  <div key={stat.label} className="bg-secondary rounded-lg p-3 text-center border border-border">
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent Properties */}
              {dataPreview.data.recentProperties.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Recent Property Data
                  </p>
                  <div className="space-y-1">
                    {dataPreview.data.recentProperties.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded px-3 py-1.5 border border-border">
                        <span className="font-medium text-foreground">{p.city}, {p.state}</span>
                        <span>·</span>
                        <span>{p.bedrooms}BR</span>
                        <span>·</span>
                        <span>${Math.round(p.annualRevenue / 12).toLocaleString()}/mo</span>
                        <span>·</span>
                        <Badge variant="outline" className={`text-[10px] ${p.verdict === 'GO' ? 'border-green-500 text-green-600' : p.verdict === 'CAUTION' ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600'}`}>
                          {p.verdict}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Markets */}
              {dataPreview.data.platformStats.topMarkets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Top Markets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dataPreview.data.platformStats.topMarkets.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {m.market} ({m.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Topics */}
              {dataPreview.data.previousTopics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Previous Topics (AI avoids repeats)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dataPreview.data.previousTopics.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {dataPreview.data.recentProperties.length === 0 && dataPreview.data.platformStats.totalReports === 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <AlertCircle className="w-4 h-4" />
                  <span>No platform data yet. The AI will use its knowledge base to generate scripts. Run some property analyses first for real data.</span>
                </div>
              )}
            </div>
          )}

          {showDataPreview && dataPreview.isLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading platform data...
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Script Library ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Script Library</h3>
            {scriptsList.data && (
              <Badge variant="secondary" className="text-xs">
                {scriptsList.data.total} scripts
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={formatFilter} onValueChange={setFormatFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All formats</SelectItem>
                <SelectItem value="lesson">Lessons</SelectItem>
                <SelectItem value="deep_dive">Deep Dives</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scriptsList.refetch()}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${scriptsList.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {scriptsList.isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading scripts...
          </div>
        )}

        {scriptsList.data && scriptsList.data.scripts.length === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-10 h-10 text-primary/30 mb-3" />
              <p className="text-foreground font-medium mb-1">No scripts yet</p>
              <p className="text-muted-foreground text-sm">
                Click "Generate Script" above to create your first one.
              </p>
            </CardContent>
          </Card>
        )}

        {scriptsList.data && scriptsList.data.scripts.length > 0 && (
          <div className="space-y-3">
            {scriptsList.data.scripts.map((script) => {
              const isExpanded = expandedScript === script.id;
              const meta = FORMAT_META[script.format] || FORMAT_META.lesson;

              return (
                <Card key={script.id} className="hover:shadow-md transition-shadow border-border">
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${meta.color} text-[10px]`}>
                            {meta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(script.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h4 className="font-semibold text-foreground text-sm truncate">
                          {script.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {script.topic}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyToClipboard(script.script, `script-${script.id}`)}
                        >
                          {copiedField === `script-${script.id}` ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpandedScript(isExpanded ? null : script.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive/50 hover:text-destructive"
                          onClick={() => {
                            if (confirm('Delete this script?')) {
                              deleteScript.mutate({ id: script.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded view */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Hook</p>
                          <p className="text-sm text-foreground">{script.hook}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Full Script</p>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {script.script}
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-1">CTA</p>
                          <p className="text-sm text-green-800">{script.cta}</p>
                        </div>
                        {script.keyDataPoints && (script.keyDataPoints as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(script.keyDataPoints as string[]).map((dp, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{dp}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Video generation for library scripts */}
                        <div className="bg-secondary border border-border rounded-lg p-3 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1">
                              <Video className="w-3 h-3 text-primary" />
                              Generate video from this script
                            </span>
                            <Button
                              size="sm"
                              className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                              onClick={() => handleStartVideo(script.id)}
                              disabled={isBusy}
                            >
                              {isVideoStarting ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Starting...</>
                              ) : (
                                <><Play className="w-3 h-3 mr-1" /> Make Video</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exported components ─────────────────────────────────────────────────────

/** Embeddable tab for the admin dashboard */
export function ContentStudioTab() {
  return <ContentStudioCore />;
}

/** Standalone page (for direct URL access) */
export default function ContentStudioPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ContentStudioCore />
      </div>
    </div>
  );
}
