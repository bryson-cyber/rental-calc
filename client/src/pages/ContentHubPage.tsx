/**
 * Content Hub — Full Pipeline Video Generation UI
 *
 * Features:
 *   - Topic suggestion engine (AI picks topics from platform data)
 *   - Brain dump input (paste rough idea → Opus enhances it)
 *   - Manual topic entry with format selection
 *   - Script review workflow (edit before sending to video)
 *   - Batch generation (multiple topics at once)
 *   - Presets (save favorite configurations)
 *   - Video status polling with progress indicators
 *   - Video list with filters
 *
 * Exports:
 *   - ContentHubTab: Embeddable component for the admin dashboard
 *   - ContentHubPage: Standalone page wrapper
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  Film,
  Zap,
  RefreshCw,
  AlertCircle,
  Video,
  Play,
  Download,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Brain,
  Layers,
  ListChecks,
  Save,
  Lightbulb,
  Send,
  Pencil,
  CheckCircle,
  XCircle,
  Timer,
  Plus,
  Wand2,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ── Status Helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  pipeline_queued: { label: 'Queued', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  researching: { label: 'Researching...', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 },
  scripting: { label: 'Writing Script...', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Loader2 },
  script_review: { label: 'Script Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Pencil },
  script_only: { label: 'Script Only', color: 'bg-teal-100 text-teal-700 border-teal-200', icon: CheckCircle },
  video_generating: { label: 'Generating Video...', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Loader2 },
  video_complete: { label: 'Complete', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  video_failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  pipeline_failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pipeline_queued;
  const Icon = config.icon;
  const isAnimated = ['researching', 'scripting', 'video_generating', 'pipeline_queued'].includes(status);
  return (
    <Badge variant="outline" className={`${config.color} gap-1.5`}>
      <Icon className={`w-3 h-3 ${isAnimated ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

const FORMAT_META: Record<string, { icon: typeof BookOpen; label: string; desc: string }> = {
  lesson: { icon: BookOpen, label: 'Lesson', desc: '5-8 min coaching video' },
  deep_dive: { icon: GraduationCap, label: 'Deep Dive', desc: '8-12 min masterclass' },
};

// ── Main Content Hub Component ──────────────────────────────────────────────

function ContentHubCore() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'create' | 'videos' | 'presets'>('create');

  // ── Create Section State ──────────────────────────────────────────────────
  const [mode, setMode] = useState<'topic' | 'braindump' | 'suggest'>('topic');
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState<'lesson' | 'deep_dive'>('lesson');
  const [brainDump, setBrainDump] = useState('');
  const [scriptOnly, setScriptOnly] = useState(false);
  const [bgMusic, setBgMusic] = useState('engaging');
  const [ttsStyle, setTtsStyle] = useState('solo-female');
  const [timing, setTiming] = useState('10');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Batch State ───────────────────────────────────────────────────────────
  const [batchTopics, setBatchTopics] = useState<Array<{ topic: string; format: 'lesson' | 'deep_dive' }>>([]);
  const [showBatch, setShowBatch] = useState(false);

  // ── Video Detail State ────────────────────────────────────────────────────
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────
  const videosQuery = trpc.contentHub.listVideos.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 10000 },
  );

  const videoDetailQuery = trpc.contentHub.getVideo.useQuery(
    { id: selectedVideoId! },
    {
      enabled: !!selectedVideoId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 5000;
        const activeStatuses = ['pipeline_queued', 'researching', 'scripting', 'video_generating'];
        return activeStatuses.includes(data.status) ? 5000 : false;
      },
    },
  );

  const presetsQuery = trpc.contentHub.listPresets.useQuery();

  // ── Mutations ─────────────────────────────────────────────────────────────
  const startPipeline = trpc.contentHub.startPipeline.useMutation({
    onSuccess: (data) => {
      toast({ title: 'Pipeline started', description: `Video #${data.videoId} is being generated.`, variant: 'default' });
      setSelectedVideoId(data.videoId);
      setActiveSection('videos');
      setTopic('');
      setBrainDump('');
      videosQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Pipeline failed', description: err.message, variant: 'destructive' });
    },
  });

  const suggestTopicsMut = trpc.contentHub.suggestTopics.useMutation({
    onError: (err) => {
      toast({ title: 'Topic suggestion failed', description: err.message, variant: 'destructive' });
    },
  });

  const updateScriptMut = trpc.contentHub.updateScript.useMutation({
    onSuccess: () => {
      toast({ title: 'Script updated', variant: 'default' });
      setEditingScript(false);
      videoDetailQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteVideoMut = trpc.contentHub.deleteVideo.useMutation({
    onSuccess: () => {
      toast({ title: 'Video deleted', variant: 'default' });
      setSelectedVideoId(null);
      videosQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const startBatchMut = trpc.contentHub.startBatch.useMutation({
    onSuccess: (data) => {
      toast({ title: 'Batch started', description: `${data.results.length} pipelines queued.`, variant: 'default' });
      setBatchTopics([]);
      setShowBatch(false);
      setActiveSection('videos');
      videosQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Batch failed', description: err.message, variant: 'destructive' });
    },
  });

  const savePresetMut = trpc.contentHub.savePreset.useMutation({
    onSuccess: () => {
      toast({ title: 'Preset saved', variant: 'default' });
      presetsQuery.refetch();
    },
  });

  const deletePresetMut = trpc.contentHub.deletePreset.useMutation({
    onSuccess: () => {
      presetsQuery.refetch();
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartPipeline = () => {
    if (!topic.trim()) {
      toast({ title: 'Enter a topic', variant: 'destructive' });
      return;
    }
    startPipeline.mutate({
      topic: topic.trim(),
      format,
      scriptOnly,
      brainDump: mode === 'braindump' && brainDump.trim() ? brainDump.trim() : undefined,
      bgMusic,
      ttsStyle,
      timing,
    });
  };

  const handleUseSuggestion = (suggestion: { topic: string; format: string }) => {
    setTopic(suggestion.topic);
    setFormat(suggestion.format as 'lesson' | 'deep_dive');
    setMode('topic');
    toast({ title: 'Topic loaded', description: 'Review and start the pipeline.', variant: 'default' });
  };

  const handleAddToBatch = () => {
    if (!topic.trim()) return;
    setBatchTopics((prev) => [...prev, { topic: topic.trim(), format }]);
    setTopic('');
  };

  const handleStartBatch = () => {
    if (batchTopics.length === 0) return;
    startBatchMut.mutate({
      topics: batchTopics,
      scriptOnly,
      bgMusic,
      ttsStyle,
      timing,
    });
  };

  const handleSavePreset = () => {
    const name = prompt('Preset name:');
    if (!name) return;
    savePresetMut.mutate({
      name,
      format,
      bgMusic,
      persona: 'coach-inayah',
    });
  };

  const handleApplyPreset = (preset: any) => {
    if (preset.format) setFormat(preset.format);
    if (preset.bgMusic) setBgMusic(preset.bgMusic);
    toast({ title: `Preset "${preset.name}" applied`, variant: 'default' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const activeVideos = useMemo(() => {
    return (videosQuery.data?.videos || []).filter((v: any) =>
      ['pipeline_queued', 'researching', 'scripting', 'video_generating'].includes(v.status),
    );
  }, [videosQuery.data]);

  const videoDetail = videoDetailQuery.data;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-serif text-foreground">Content Hub</h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered video pipeline: Topic → Script (Opus 4.6) → Video (Golpo AI)
          </p>
        </div>
        {activeVideos.length > 0 && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {activeVideos.length} active pipeline{activeVideos.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="gap-2">
            <Wand2 className="w-4 h-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2">
            <Film className="w-4 h-4" />
            Videos ({videosQuery.data?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="presets" className="gap-2">
            <Save className="w-4 h-4" />
            Presets
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* CREATE TAB */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="create" className="space-y-4 mt-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'topic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('topic')}
              className="gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Enter Topic
            </Button>
            <Button
              variant={mode === 'braindump' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('braindump')}
              className="gap-1.5"
            >
              <Brain className="w-3.5 h-3.5" />
              Brain Dump
            </Button>
            <Button
              variant={mode === 'suggest' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMode('suggest');
                if (!suggestTopicsMut.data) {
                  suggestTopicsMut.mutate({ count: 5 });
                }
              }}
              className="gap-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              AI Suggest
            </Button>
          </div>

          {/* Topic Input Mode */}
          {mode === 'topic' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enter Topic</CardTitle>
                <CardDescription>Type a specific topic for the video script</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="e.g., How to find your first Airbnb arbitrage deal in Denver for under $3,000"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-3">
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">Lesson (5-8 min)</SelectItem>
                      <SelectItem value="deep_dive">Deep Dive (8-12 min)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch checked={scriptOnly} onCheckedChange={setScriptOnly} />
                    <span className="text-sm text-muted-foreground">Script only (no video)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Brain Dump Mode */}
          {mode === 'braindump' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  Brain Dump
                </CardTitle>
                <CardDescription>
                  Paste your rough idea — Opus 4.6 will enhance it into a polished script
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Topic title (e.g., Why Denver is the best market for beginners)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <Textarea
                  placeholder="Dump your rough thoughts here... bullet points, half-formed ideas, key stats you want to mention, the angle you're going for. Opus will transform this into a complete narration script."
                  value={brainDump}
                  onChange={(e) => setBrainDump(e.target.value)}
                  rows={8}
                  className="text-sm"
                />
                <div className="flex gap-3">
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">Lesson (5-8 min)</SelectItem>
                      <SelectItem value="deep_dive">Deep Dive (8-12 min)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch checked={scriptOnly} onCheckedChange={setScriptOnly} />
                    <span className="text-sm text-muted-foreground">Script only</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Suggest Mode */}
          {mode === 'suggest' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  AI Topic Suggestions
                </CardTitle>
                <CardDescription>
                  Topics generated from your live platform data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {suggestTopicsMut.isPending ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing platform data and generating topics...
                  </div>
                ) : suggestTopicsMut.data?.topics?.length ? (
                  <div className="space-y-3">
                    {suggestTopicsMut.data.topics.map((suggestion: any, i: number) => (
                      <div
                        key={i}
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer group"
                        onClick={() => handleUseSuggestion(suggestion)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {suggestion.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}
                              </Badge>
                              {suggestion.estimatedEngagement === 'high' && (
                                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                  High Engagement
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm">{suggestion.topic}</p>
                            <p className="text-xs text-muted-foreground mt-1">{suggestion.angle}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Use
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => suggestTopicsMut.mutate({ count: 5 })}
                      className="w-full gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate Suggestions
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No suggestions yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => suggestTopicsMut.mutate({ count: 5 })}
                      className="mt-2 gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Topics
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced Options
            </button>
            {showAdvanced && (
              <Card className="mt-2">
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Background Music</label>
                      <Select value={bgMusic} onValueChange={setBgMusic}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engaging">Engaging</SelectItem>
                          <SelectItem value="calm">Calm</SelectItem>
                          <SelectItem value="upbeat">Upbeat</SelectItem>
                          <SelectItem value="inspiring">Inspiring</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Voice Style</label>
                      <Select value={ttsStyle} onValueChange={setTtsStyle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solo-female">Solo Female</SelectItem>
                          <SelectItem value="solo-male">Solo Male</SelectItem>
                          <SelectItem value="duo">Duo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Timing (sec/scene)</label>
                      <Select value={timing} onValueChange={setTiming}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8">8s (Fast)</SelectItem>
                          <SelectItem value="10">10s (Normal)</SelectItem>
                          <SelectItem value="12">12s (Slow)</SelectItem>
                          <SelectItem value="15">15s (Very Slow)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleSavePreset} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      Save as Preset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleStartPipeline}
              disabled={!topic.trim() || startPipeline.isPending}
              className="gap-2 flex-1"
            >
              {startPipeline.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {scriptOnly ? 'Generate Script' : 'Generate Script + Video'}
            </Button>
            {!showBatch && (
              <Button variant="outline" onClick={() => setShowBatch(true)} className="gap-1.5">
                <Layers className="w-4 h-4" />
                Batch
              </Button>
            )}
          </div>

          {/* Batch Panel */}
          {showBatch && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Batch Generation
                </CardTitle>
                <CardDescription>Queue multiple topics at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a topic..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddToBatch()}
                    className="text-sm flex-1"
                  />
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">Lesson</SelectItem>
                      <SelectItem value="deep_dive">Deep Dive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddToBatch} disabled={!topic.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {batchTopics.length > 0 && (
                  <div className="space-y-2">
                    {batchTopics.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-accent/50 rounded-md px-3 py-2">
                        <Badge variant="outline" className="text-xs">{item.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}</Badge>
                        <span className="flex-1 truncate">{item.topic}</span>
                        <button
                          onClick={() => setBatchTopics((prev) => prev.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button onClick={handleStartBatch} disabled={startBatchMut.isPending} className="gap-1.5 flex-1">
                        {startBatchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Start Batch ({batchTopics.length} videos)
                      </Button>
                      <Button variant="outline" onClick={() => { setBatchTopics([]); setShowBatch(false); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VIDEOS TAB */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="videos" className="space-y-4 mt-4">
          {/* Video Detail View */}
          {selectedVideoId && videoDetail ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedVideoId(null); setEditingScript(false); }}
                className="gap-1.5 -ml-2"
              >
                <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                Back to list
              </Button>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{videoDetail.topic}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={videoDetail.status} />
                        <Badge variant="outline">{videoDetail.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}</Badge>
                        {videoDetail.totalDurationMs && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {Math.round(videoDetail.totalDurationMs / 1000)}s total
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {videoDetail.videoUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={videoDetail.videoUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Watch Video
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive gap-1.5"
                        onClick={() => {
                          if (confirm('Delete this video?')) deleteVideoMut.mutate({ id: videoDetail.id });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pipeline Progress */}
                  {videoDetail.pipelineStage && (
                    <div className="text-sm text-muted-foreground bg-accent/50 rounded-md px-3 py-2 flex items-center gap-2">
                      <Layers className="w-4 h-4 flex-shrink-0" />
                      {videoDetail.pipelineStage}
                    </div>
                  )}

                  {/* Layer Timings */}
                  {(videoDetail.layer1DurationMs || videoDetail.layer2DurationMs || videoDetail.layer3DurationMs) && (
                    <div className="grid grid-cols-3 gap-3">
                      {videoDetail.layer1DurationMs && (
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium">Layer 1: Research</p>
                          <p className="text-lg font-bold text-blue-700">{(videoDetail.layer1DurationMs / 1000).toFixed(1)}s</p>
                        </div>
                      )}
                      {videoDetail.layer2DurationMs && (
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-xs text-purple-600 font-medium">Layer 2: Script</p>
                          <p className="text-lg font-bold text-purple-700">{(videoDetail.layer2DurationMs / 1000).toFixed(1)}s</p>
                        </div>
                      )}
                      {videoDetail.layer3DurationMs && (
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                          <p className="text-xs text-indigo-600 font-medium">Layer 3: Video</p>
                          <p className="text-lg font-bold text-indigo-700">{(videoDetail.layer3DurationMs / 1000).toFixed(0)}s</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Script */}
                  {videoDetail.narrationScript && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">Narration Script</h4>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(videoDetail.narrationScript || '')}
                            className="gap-1 h-7 text-xs"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </Button>
                          {['script_review', 'script_only', 'pipeline_failed', 'video_failed'].includes(videoDetail.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingScript(true);
                                setEditedScript(videoDetail.narrationScript || '');
                              }}
                              className="gap-1 h-7 text-xs"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                      {editingScript ? (
                        <div className="space-y-3">
                          <Textarea
                            value={editedScript}
                            onChange={(e) => setEditedScript(e.target.value)}
                            rows={20}
                            className="text-sm font-mono"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateScriptMut.mutate({
                                videoId: videoDetail.id,
                                script: editedScript,
                                continueToVideo: false,
                              })}
                              disabled={updateScriptMut.isPending}
                              className="gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save Script
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateScriptMut.mutate({
                                videoId: videoDetail.id,
                                script: editedScript,
                                continueToVideo: true,
                              })}
                              disabled={updateScriptMut.isPending}
                              className="gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Save & Generate Video
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingScript(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-accent/30 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{videoDetail.narrationScript}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {videoDetail.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700 text-sm">Error</p>
                        <p className="text-sm text-red-600 mt-1">{videoDetail.error}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Video List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground">
                  {videosQuery.data?.total || 0} video{(videosQuery.data?.total || 0) !== 1 ? 's' : ''}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => videosQuery.refetch()}
                  className="gap-1.5 h-7"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </Button>
              </div>

              {videosQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (videosQuery.data?.videos || []).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Film className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">No videos yet. Create your first one above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {(videosQuery.data?.videos || []).map((video: any) => (
                    <Card
                      key={video.id}
                      className="cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => setSelectedVideoId(video.id)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{video.topic}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusBadge status={video.status} />
                              <Badge variant="outline" className="text-xs">
                                {video.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(video.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {video.videoUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(video.videoUrl, '_blank');
                              }}
                              className="gap-1 h-7 text-xs"
                            >
                              <Play className="w-3 h-3" />
                              Watch
                            </Button>
                          )}
                          <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PRESETS TAB */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="presets" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saved Presets</CardTitle>
              <CardDescription>Quick-apply your favorite configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {presetsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (presetsQuery.data || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Save className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No presets saved yet.</p>
                  <p className="text-xs mt-1">Open Advanced Options in Create tab to save a preset.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(presetsQuery.data || []).map((preset: any) => (
                    <div
                      key={preset.id}
                      className="flex items-center gap-3 border rounded-lg p-3 hover:bg-accent/30 transition-colors"
                    >
                      <span className="text-lg">{preset.emoji || '⚡'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.format === 'deep_dive' ? 'Deep Dive' : preset.format === 'lesson' ? 'Lesson' : 'Any format'}
                          {preset.bgMusic ? ` · ${preset.bgMusic} music` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyPreset(preset)}
                        className="gap-1 h-7 text-xs"
                      >
                        Apply
                      </Button>
                      <button
                        onClick={() => deletePresetMut.mutate({ id: preset.id })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Exports ─────────────────────────────────────────────────────────────────

export function ContentHubTab() {
  return <ContentHubCore />;
}

export default function ContentHubPage() {
  return (
    <div className="container max-w-5xl py-8">
      <ContentHubCore />
    </div>
  );
}
