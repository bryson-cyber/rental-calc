/**
 * Content Hub — Full Pipeline Video Generation UI
 *
 * Script Input Modes:
 *   1. My Script — paste your finished script, review → video
 *   2. AI Enhance — paste rough script, AI polishes (keeps your words), review → video
 *   3. Brain Dump — type rough ideas/bullets, AI builds a full script, review → video
 *   4. AI Generate — enter topic, AI writes from scratch, review → video
 *   5. AI Suggest — platform data suggests topics, pick one → AI Generate flow
 *
 * ALL modes pause at script_review before sending to Golpo for video.
 */
import { useState, useMemo, useCallback } from 'react';
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
  ChevronDown,
  ChevronUp,
  Trash2,
  Film,
  Zap,
  RefreshCw,
  AlertCircle,
  Play,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Brain,
  Layers,
  Save,
  Lightbulb,
  Send,
  Pencil,
  CheckCircle,
  XCircle,
  Timer,
  Plus,
  Wand2,
  FileText,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ── Status Helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  pipeline_queued: { label: 'Queued', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  researching: { label: 'Researching...', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 },
  scripting: { label: 'Writing Script...', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Loader2 },
  script_review: { label: 'Ready for Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Pencil },
  script_only: { label: 'Script Only', color: 'bg-teal-100 text-teal-700 border-teal-200', icon: CheckCircle },
  video_generating: { label: 'Generating Video...', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Loader2 },
  video_complete: { label: 'Complete', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  video_failed: { label: 'Video Failed', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
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

type ScriptInputMode = 'my_script' | 'ai_enhance' | 'braindump' | 'ai_generate' | 'suggest';

const MODE_META: Record<ScriptInputMode, { icon: typeof Pencil; label: string; desc: string }> = {
  my_script: { icon: FileText, label: 'My Script', desc: 'Paste your finished script' },
  ai_enhance: { icon: Wand2, label: 'AI Enhance', desc: 'AI polishes your script' },
  braindump: { icon: Brain, label: 'Brain Dump', desc: 'Rough ideas → full script' },
  ai_generate: { icon: Sparkles, label: 'AI Generate', desc: 'AI writes from scratch' },
  suggest: { icon: Lightbulb, label: 'AI Suggest', desc: 'Get topic ideas' },
};

// ── Main Content Hub Component ──────────────────────────────────────────────

function ContentHubCore() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'create' | 'videos' | 'presets'>('create');

  // ── Create Section State ──────────────────────────────────────────────────
  const [mode, setMode] = useState<ScriptInputMode>('my_script');
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState<'lesson' | 'deep_dive'>('lesson');
  const [userScript, setUserScript] = useState('');
  const [brainDump, setBrainDump] = useState('');
  const [scriptOnly, setScriptOnly] = useState(false);
  const [bgMusic, setBgMusic] = useState('engaging');
  const [ttsStyle, setTtsStyle] = useState('solo-female');
  const [timing, setTiming] = useState('auto');
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
      toast({ title: 'Pipeline started', description: `Video #${data.videoId} is being processed.`, variant: 'default' });
      setSelectedVideoId(data.videoId);
      setActiveSection('videos');
      setTopic('');
      setUserScript('');
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
    onSuccess: (data) => {
      toast({ title: data.status === 'video_generating' ? 'Script approved — generating video' : 'Script saved', variant: 'default' });
      setEditingScript(false);
      videoDetailQuery.refetch();
      videosQuery.refetch();
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

  const handleStartPipeline = useCallback(() => {
    // Determine scriptMode based on the current input mode
    let scriptMode: 'own_script' | 'ai_enhance' | 'ai_generate' = 'ai_generate';
    let scriptText: string | undefined;
    let brainDumpText: string | undefined;

    if (mode === 'my_script') {
      if (!userScript.trim()) {
        toast({ title: 'Paste your script', description: 'The script field is required in My Script mode.', variant: 'destructive' });
        return;
      }
      scriptMode = 'own_script';
      scriptText = userScript.trim();
    } else if (mode === 'ai_enhance') {
      if (!userScript.trim()) {
        toast({ title: 'Paste your script', description: 'Paste the script you want AI to enhance.', variant: 'destructive' });
        return;
      }
      scriptMode = 'ai_enhance';
      scriptText = userScript.trim();
    } else if (mode === 'braindump') {
      if (!brainDump.trim()) {
        toast({ title: 'Enter your brain dump', description: 'Type your rough ideas so AI can build a script.', variant: 'destructive' });
        return;
      }
      scriptMode = 'ai_generate';
      brainDumpText = brainDump.trim();
    } else {
      // ai_generate or suggest
      scriptMode = 'ai_generate';
    }

    if (!topic.trim() && mode !== 'my_script') {
      toast({ title: 'Enter a topic', variant: 'destructive' });
      return;
    }

    startPipeline.mutate({
      topic: topic.trim() || 'Untitled Script',
      format,
      scriptOnly,
      scriptMode,
      userScript: scriptText,
      brainDump: brainDumpText,
      bgMusic,
      ttsStyle,
      timing,
    });
  }, [mode, topic, format, userScript, brainDump, scriptOnly, bgMusic, ttsStyle, timing, startPipeline, toast]);

  const handleUseSuggestion = (suggestion: { topic: string; format: string }) => {
    setTopic(suggestion.topic);
    setFormat(suggestion.format as 'lesson' | 'deep_dive');
    setMode('ai_generate');
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

  const reviewVideos = useMemo(() => {
    return (videosQuery.data?.videos || []).filter((v: any) => v.status === 'script_review');
  }, [videosQuery.data]);

  const videoDetail = videoDetailQuery.data;

  const wordCount = useMemo(() => {
    if (mode === 'my_script' || mode === 'ai_enhance') {
      return userScript.trim().split(/\s+/).filter(Boolean).length;
    }
    if (mode === 'braindump') {
      return brainDump.trim().split(/\s+/).filter(Boolean).length;
    }
    return 0;
  }, [mode, userScript, brainDump]);

  // Determine if the main action button should be enabled
  const canSubmit = useMemo(() => {
    if (startPipeline.isPending) return false;
    if (mode === 'my_script') return userScript.trim().length > 50;
    if (mode === 'ai_enhance') return userScript.trim().length > 50 && topic.trim().length > 0;
    if (mode === 'braindump') return brainDump.trim().length > 20 && topic.trim().length > 0;
    if (mode === 'ai_generate') return topic.trim().length > 0;
    if (mode === 'suggest') return topic.trim().length > 0;
    return false;
  }, [mode, userScript, brainDump, topic, startPipeline.isPending]);

  // Action button label
  const actionLabel = useMemo(() => {
    if (mode === 'my_script') return scriptOnly ? 'Save Script' : 'Review & Generate Video';
    if (mode === 'ai_enhance') return 'Enhance Script';
    if (mode === 'braindump') return 'Build Script from Ideas';
    return scriptOnly ? 'Generate Script' : 'Generate Script + Video';
  }, [mode, scriptOnly]);

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
            Write scripts, enhance them with AI, or generate from scratch — then produce videos with Golpo AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reviewVideos.length > 0 && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => {
                setSelectedVideoId(reviewVideos[0].id);
                setActiveSection('videos');
              }}
            >
              <Pencil className="w-3 h-3" />
              {reviewVideos.length} script{reviewVideos.length !== 1 ? 's' : ''} to review
            </Badge>
          )}
          {activeVideos.length > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {activeVideos.length} active
            </Badge>
          )}
        </div>
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
          {/* Mode Selector — 5 modes */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(MODE_META) as [ScriptInputMode, typeof MODE_META[ScriptInputMode]][]).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <Button
                  key={key}
                  variant={mode === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setMode(key);
                    if (key === 'suggest' && !suggestTopicsMut.data) {
                      suggestTopicsMut.mutate({ count: 5 });
                    }
                  }}
                  className="gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {meta.label}
                </Button>
              );
            })}
          </div>

          {/* ── MY SCRIPT MODE ── */}
          {mode === 'my_script' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  My Script
                </CardTitle>
                <CardDescription>
                  Paste your finished script. It goes straight to review — AI won't change a word.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Title (e.g., Why Denver is the best market for beginners)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <div className="relative">
                  <Textarea
                    placeholder="Paste your full narration script here..."
                    value={userScript}
                    onChange={(e) => setUserScript(e.target.value)}
                    rows={14}
                    className="text-sm font-mono"
                  />
                  {wordCount > 0 && (
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {wordCount} words · ~{Math.ceil(wordCount / 150)} min narration
                    </div>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">Lesson (5-8 min)</SelectItem>
                      <SelectItem value="deep_dive">Deep Dive (8-12 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── AI ENHANCE MODE ── */}
          {mode === 'ai_enhance' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-violet-600" />
                  AI Enhance
                </CardTitle>
                <CardDescription>
                  Paste your script — AI will polish the delivery, add transitions, and inject data points.
                  Your words and ideas stay intact.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Topic title (e.g., 5 mistakes new Airbnb hosts make)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <div className="relative">
                  <Textarea
                    placeholder="Paste your rough script here. AI will enhance it — fix flow, add transitions, inject real data — but keep YOUR voice and ideas..."
                    value={userScript}
                    onChange={(e) => setUserScript(e.target.value)}
                    rows={14}
                    className="text-sm font-mono"
                  />
                  {wordCount > 0 && (
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {wordCount} words · ~{Math.ceil(wordCount / 150)} min narration
                    </div>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">Lesson (5-8 min)</SelectItem>
                      <SelectItem value="deep_dive">Deep Dive (8-12 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── BRAIN DUMP MODE ── */}
          {mode === 'braindump' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  Brain Dump
                </CardTitle>
                <CardDescription>
                  Type your rough ideas, bullet points, key stats, the angle you're going for.
                  Opus 4.6 will transform it into a complete narration script.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Topic title (e.g., Why Denver is the best market for beginners)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <div className="relative">
                  <Textarea
                    placeholder={`Dump your rough thoughts here...

Example:
- want to talk about how people overthink their first deal
- mention the student who found a deal in Columbia SC making $2k/mo
- the key is just running the numbers — use the free tool
- mention that 67% occupancy is actually good for a beginner
- end with CTA to the tool`}
                    value={brainDump}
                    onChange={(e) => setBrainDump(e.target.value)}
                    rows={10}
                    className="text-sm"
                  />
                  {wordCount > 0 && (
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {wordCount} words in dump
                    </div>
                  )}
                </div>
                <div className="flex gap-3 items-center">
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

          {/* ── AI GENERATE MODE ── */}
          {mode === 'ai_generate' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  AI Generate
                </CardTitle>
                <CardDescription>
                  Enter a topic — Opus 4.6 writes the full script from scratch using live platform data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="e.g., How to find your first Airbnb arbitrage deal in Denver for under $3,000"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-3 items-center">
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

          {/* ── AI SUGGEST MODE ── */}
          {mode === 'suggest' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  AI Topic Suggestions
                </CardTitle>
                <CardDescription>
                  Topics generated from your live platform data — click one to start
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
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <Zap className="w-3 h-3" />
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
          {mode !== 'suggest' && (
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
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Timing</label>
                        <Select value={timing} onValueChange={setTiming}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (from word count)</SelectItem>
                            <SelectItem value="8">8s/scene (Fast)</SelectItem>
                            <SelectItem value="10">10s/scene (Normal)</SelectItem>
                            <SelectItem value="12">12s/scene (Slow)</SelectItem>
                            <SelectItem value="15">15s/scene (Very Slow)</SelectItem>
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
          )}

          {/* Action Buttons */}
          {mode !== 'suggest' && (
            <div className="flex gap-3">
              <Button
                onClick={handleStartPipeline}
                disabled={!canSubmit}
                className="gap-2 flex-1"
              >
                {startPipeline.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'my_script' ? (
                  <Send className="w-4 h-4" />
                ) : mode === 'ai_enhance' ? (
                  <Wand2 className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {actionLabel}
              </Button>
              {mode === 'ai_generate' && !showBatch && (
                <Button variant="outline" onClick={() => setShowBatch(true)} className="gap-1.5">
                  <Layers className="w-4 h-4" />
                  Batch
                </Button>
              )}
            </div>
          )}

          {/* Batch Panel (only in AI Generate mode) */}
          {mode === 'ai_generate' && showBatch && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Batch Generation
                </CardTitle>
                <CardDescription>Queue multiple topics at once (all use AI Generate)</CardDescription>
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
                <ArrowLeft className="w-4 h-4" />
                Back to list
              </Button>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{videoDetail.topic}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge status={videoDetail.status} />
                        <Badge variant="outline">{videoDetail.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}</Badge>
                        {videoDetail.scriptMode && (
                          <Badge variant="outline" className="text-xs bg-slate-50">
                            {videoDetail.scriptMode === 'own_script' ? 'My Script' : videoDetail.scriptMode === 'ai_enhance' ? 'AI Enhanced' : 'AI Generated'}
                          </Badge>
                        )}
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

                  {/* Script Review Call-to-Action */}
                  {videoDetail.status === 'script_review' && !editingScript && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Pencil className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-800 text-sm">Script ready for your review</p>
                          <p className="text-sm text-amber-700 mt-1">
                            Read the script below. You can edit it, then approve to generate the video.
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingScript(true);
                                setEditedScript(videoDetail.narrationScript || '');
                              }}
                              className="gap-1.5"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Script
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateScriptMut.mutate({
                                videoId: videoDetail.id,
                                script: videoDetail.narrationScript || '',
                                continueToVideo: true,
                              })}
                              disabled={updateScriptMut.isPending}
                              className="gap-1.5"
                            >
                              {updateScriptMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Approve & Generate Video
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Layer Timings */}
                  {(videoDetail.layer1DurationMs || videoDetail.layer2DurationMs || videoDetail.layer3DurationMs) && (
                    <div className="grid grid-cols-3 gap-3">
                      {videoDetail.layer1DurationMs != null && (
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium">Layer 1: Research</p>
                          <p className="text-lg font-bold text-blue-700">{(videoDetail.layer1DurationMs / 1000).toFixed(1)}s</p>
                        </div>
                      )}
                      {videoDetail.layer2DurationMs != null && (
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-xs text-purple-600 font-medium">Layer 2: Script</p>
                          <p className="text-lg font-bold text-purple-700">{(videoDetail.layer2DurationMs / 1000).toFixed(1)}s</p>
                        </div>
                      )}
                      {videoDetail.layer3DurationMs != null && (
                        <div className="text-center p-3 bg-indigo-50 rounded-lg">
                          <p className="text-xs text-indigo-600 font-medium">Layer 3: Video</p>
                          <p className="text-lg font-bold text-indigo-700">{(videoDetail.layer3DurationMs / 1000).toFixed(0)}s</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Script Display / Edit */}
                  {videoDetail.narrationScript && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">
                          Narration Script
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            ({videoDetail.narrationScript.split(/\s+/).length} words)
                          </span>
                        </h4>
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
                          {!editingScript && ['script_review', 'script_only', 'pipeline_failed', 'video_failed'].includes(videoDetail.status) && (
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
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {editedScript.split(/\s+/).filter(Boolean).length} words · ~{Math.ceil(editedScript.split(/\s+/).filter(Boolean).length / 150)} min narration
                            </span>
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
                                {updateScriptMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
                        </div>
                      ) : (
                        <div className="bg-accent/30 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{videoDetail.narrationScript}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User's Original Script (for AI Enhance mode) */}
                  {videoDetail.userScript && videoDetail.scriptMode === 'ai_enhance' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm text-muted-foreground">
                          Your Original Script
                          <span className="text-xs font-normal ml-2">
                            ({videoDetail.userScript.split(/\s+/).length} words)
                          </span>
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(videoDetail.userScript || '')}
                          className="gap-1 h-7 text-xs"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Original
                        </Button>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 max-h-[200px] overflow-y-auto border border-slate-200">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-600">{videoDetail.userScript}</p>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {videoDetail.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-red-700 text-sm">Error</p>
                        <p className="text-sm text-red-600 mt-1">{videoDetail.error}</p>
                        {['video_failed', 'pipeline_failed'].includes(videoDetail.status) && videoDetail.narrationScript && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 gap-1.5"
                            onClick={() => updateScriptMut.mutate({
                              videoId: videoDetail.id,
                              script: videoDetail.narrationScript || '',
                              continueToVideo: true,
                            })}
                            disabled={updateScriptMut.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retry Video Generation
                          </Button>
                        )}
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
                      className={`cursor-pointer hover:bg-accent/30 transition-colors ${video.status === 'script_review' ? 'border-amber-300 bg-amber-50/30' : ''}`}
                      onClick={() => setSelectedVideoId(video.id)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{video.topic}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <StatusBadge status={video.status} />
                              <Badge variant="outline" className="text-xs">
                                {video.format === 'deep_dive' ? 'Deep Dive' : 'Lesson'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(video.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {video.status === 'script_review' && (
                            <Badge className="bg-amber-500 text-white gap-1 text-xs">
                              <Pencil className="w-3 h-3" />
                              Review
                            </Badge>
                          )}
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
