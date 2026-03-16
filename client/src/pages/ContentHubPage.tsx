/**
 * Content Hub — Full Pipeline Video Generation UI
 *
 * Redesigned with a "Content Filters" panel at the top (matching the Content Studio reference):
 *   - Presenter Persona cards
 *   - Format, Voice Style, Focus dropdowns
 *   - Length, Story Format, Music dropdowns
 *
 * Below filters: Input area (AI Suggest topics, Brain Dump, or direct topic entry)
 * Right/below: Script preview & video status
 *
 * Script Input Modes:
 *   1. My Script — paste your finished script, goes DIRECTLY to Golpo for video (no review step)
 *   2. AI Enhance — paste rough script, AI polishes (keeps your words), review → video
 *   3. Brain Dump — type rough ideas/bullets, AI builds a full script, review → video
 *   4. AI Generate — enter topic, AI writes from scratch, review → video
 *   5. AI Suggest — platform data suggests topics, pick one → AI Generate flow
 *
 * My Script mode skips review. All other modes pause at script_review before sending to Golpo.
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
  SlidersHorizontal,
  Mic,
  Music,
  User,
  Target,
  Video,
  MessageSquare,
  Search,
  Palette,
  PenTool,
  Volume2,
  Image,
  Monitor,
  Bookmark,
  BookmarkPlus,
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

// ── Persona Data ────────────────────────────────────────────────────────────

const PERSONAS = [
  { id: 'coach-inayah', name: 'Coach Inayah', desc: 'Warm, empowering business credit expert', color: 'bg-orange-500' },
  { id: 'financial-advisor', name: 'Financial Advisor', desc: 'Calm, authoritative, data-driven', color: 'bg-teal-500' },
  { id: 'street-smart', name: 'Street-Smart Mentor', desc: 'Real talk, no-BS energy', color: 'bg-green-500' },
  { id: 'data-analyst', name: 'Data Analyst', desc: 'Numbers-focused, precise', color: 'bg-amber-500' },
  { id: 'story-narrator', name: 'Story Narrator', desc: 'Brings client journeys to life', color: 'bg-rose-400' },
  { id: 'hype-man', name: 'Hype Man', desc: 'High-energy motivational speaker', color: 'bg-red-500' },
] as const;

// ── Input Mode Types ────────────────────────────────────────────────────────

type InputMode = 'suggest' | 'braindump' | 'my_script' | 'ai_enhance' | 'ai_generate';

const INPUT_MODES: { id: InputMode; icon: typeof Sparkles; label: string; desc: string }[] = [
  { id: 'suggest', icon: Lightbulb, label: 'AI Topic Suggestions', desc: 'Pick a topic to generate content' },
  { id: 'braindump', icon: Brain, label: 'Brain Dump', desc: 'Speak or type your idea — AI optimizes it into a content prompt' },
  { id: 'my_script', icon: FileText, label: 'My Script', desc: 'Paste your script — goes straight to video generation' },
  { id: 'ai_enhance', icon: Wand2, label: 'AI Enhance', desc: 'AI polishes your draft script' },
  { id: 'ai_generate', icon: Sparkles, label: 'AI Generate', desc: 'Enter a topic — AI writes from scratch' },
];

// ── Main Content Hub Component ──────────────────────────────────────────────

function ContentHubCore() {
  const { toast } = useToast();

  // ── Content Filters State ─────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(true);
  const [persona, setPersona] = useState('coach-inayah');
  const [videoFormat, setVideoFormat] = useState('all');
  const [voiceStyle, setVoiceStyle] = useState('solo-female-3');
  const [contentFocus, setContentFocus] = useState('teaching');
  const [contentLength, setContentLength] = useState('5-10');
  const [storyFormat, setStoryFormat] = useState('whiteboard');
  const [bgMusic, setBgMusic] = useState('engaging');

  // ── Golpo API v1 Options State ───────────────────────────────────────────
  const [visualStyle, setVisualStyle] = useState<'default' | 'sketch' | 'sketch-advanced' | 'canvas'>('default');
  const [canvasImageStyle, setCanvasImageStyle] = useState('whiteboard');
  const [canvasPenStyle, setCanvasPenStyle] = useState('stylus');
  const [ttsModel, setTtsModel] = useState<'accurate' | 'flash'>('accurate');
  const [whiteBg, setWhiteBg] = useState(true);
  const [outputVolume, setOutputVolume] = useState('1.0');
  const [bgVolume, setBgVolume] = useState('0.3');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPlacement, setLogoPlacement] = useState('tl');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Input Mode State ──────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('suggest');
  const [topic, setTopic] = useState('');
  const [userScript, setUserScript] = useState('');
  const [brainDump, setBrainDump] = useState('');
  const [scriptOnly, setScriptOnly] = useState(false);

  // ── Section State ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'create' | 'videos'>('create');

  // ── Video Detail State ────────────────────────────────────────────────────
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');

  // ── Bulk Selection State ──────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Count active filters ──────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (persona !== 'coach-inayah') count++;
    if (videoFormat !== 'all') count++;
    if (voiceStyle !== 'solo-female-3') count++;
    if (contentFocus !== 'teaching') count++;
    if (contentLength !== '5-10') count++;
    if (storyFormat !== 'whiteboard') count++;
    if (bgMusic !== 'engaging') count++;
    if (visualStyle !== 'default') count++;
    if (ttsModel !== 'accurate') count++;
    if (!whiteBg) count++;
    if (logoUrl) count++;
    return count;
  }, [persona, videoFormat, voiceStyle, contentFocus, contentLength, storyFormat, bgMusic, visualStyle, ttsModel, whiteBg, logoUrl]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const presetsQuery = trpc.contentHub.listPresets.useQuery();
  const utils = trpc.useUtils();

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

  // ── Mutations ─────────────────────────────────────────────────────────────
  const startPipeline = trpc.contentHub.startPipeline.useMutation({
    onSuccess: (data) => {
      const isOwnScript = inputMode === 'my_script';
      toast({ 
        title: isOwnScript ? 'Video generating!' : 'Pipeline started', 
        description: isOwnScript 
          ? `Your script is being sent to Golpo AI. Video #${data.videoId} will be ready in a few minutes.`
          : `Video #${data.videoId} is being processed.`, 
        variant: 'default' 
      });
      setSelectedVideoId(data.videoId);
      setActiveTab('videos');
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

  const bulkDeleteMut = trpc.contentHub.bulkDeleteVideos.useMutation({
    onSuccess: (data) => {
      toast({
        title: `${data.deleted} video${data.deleted !== 1 ? 's' : ''} deleted`,
        description: data.skipped > 0 ? `${data.skipped} skipped (active pipeline)` : undefined,
        variant: 'default',
      });
      setSelectedIds(new Set());
      setBulkMode(false);
      videosQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Bulk delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const checkGolpoMut = trpc.contentHub.checkGolpoStatus.useMutation({
    onSuccess: (data) => {
      if (data.videoUrl) {
        toast({ title: 'Video recovered!', description: 'The video was already complete on Golpo.', variant: 'default' });
      } else {
        toast({ title: `Status: ${data.status}`, description: data.message || 'Checked Golpo status.', variant: 'default' });
      }
      videoDetailQuery.refetch();
      videosQuery.refetch();
    },
    onError: (err) => {
      toast({ title: 'Check failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Preset Mutations ─────────────────────────────────────────────────────
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  const savePresetMut = trpc.contentHub.savePreset.useMutation({
    onSuccess: () => {
      toast({ title: 'Preset saved', variant: 'default' });
      setPresetName('');
      setShowPresetSave(false);
      utils.contentHub.listPresets.invalidate();
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const deletePresetMut = trpc.contentHub.deletePreset.useMutation({
    onSuccess: () => {
      toast({ title: 'Preset deleted', variant: 'default' });
      utils.contentHub.listPresets.invalidate();
    },
    onError: (err) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePresetMut.mutate({
      name: presetName.trim(),
      format: videoFormat === 'all' ? undefined : videoFormat,
      voiceStyle,
      contentFocus,
      contentLength,
      storyFormat,
      persona,
      bgMusic,
      videoType: (videoFormat === 'reel' || videoFormat === 'short' || videoFormat === 'tiktok') ? 'short' : 'long',
      ttsModel,
      whiteBg,
      outputVolume,
      bgVolume,
      visualStyle,
      canvasImageStyle: visualStyle === 'canvas' ? canvasImageStyle : undefined,
      canvasPenStyle: visualStyle === 'canvas' ? canvasPenStyle : undefined,
      logoUrl: logoUrl || undefined,
      logoPlacement: logoUrl ? logoPlacement : undefined,
    });
  };

  const handleLoadPreset = (preset: any) => {
    if (preset.voiceStyle) setVoiceStyle(preset.voiceStyle);
    if (preset.contentFocus) setContentFocus(preset.contentFocus);
    if (preset.contentLength) setContentLength(preset.contentLength);
    if (preset.storyFormat) setStoryFormat(preset.storyFormat);
    if (preset.persona) setPersona(preset.persona);
    if (preset.bgMusic) setBgMusic(preset.bgMusic);
    if (preset.format) setVideoFormat(preset.format);
    // Golpo API v1 options
    if (preset.videoType === 'short') setVideoFormat('reel');
    if (preset.ttsModel) setTtsModel(preset.ttsModel);
    if (preset.whiteBg !== null && preset.whiteBg !== undefined) setWhiteBg(preset.whiteBg === 1 || preset.whiteBg === true);
    if (preset.outputVolume) setOutputVolume(preset.outputVolume);
    if (preset.bgVolume) setBgVolume(preset.bgVolume);
    if (preset.visualStyle) setVisualStyle(preset.visualStyle as any);
    if (preset.canvasImageStyle) setCanvasImageStyle(preset.canvasImageStyle);
    if (preset.canvasPenStyle) setCanvasPenStyle(preset.canvasPenStyle);
    if (preset.logoUrl) setLogoUrl(preset.logoUrl);
    if (preset.logoPlacement) setLogoPlacement(preset.logoPlacement);
    toast({ title: `Preset "${preset.name}" loaded`, variant: 'default' });
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartPipeline = useCallback(() => {
    let scriptMode: 'own_script' | 'ai_enhance' | 'ai_generate' = 'ai_generate';
    let scriptText: string | undefined;
    let brainDumpText: string | undefined;

    if (inputMode === 'my_script') {
      if (!userScript.trim()) {
        toast({ title: 'Paste your script', description: 'The script field is required in My Script mode.', variant: 'destructive' });
        return;
      }
      scriptMode = 'own_script';
      scriptText = userScript.trim();
    } else if (inputMode === 'ai_enhance') {
      if (!userScript.trim()) {
        toast({ title: 'Paste your script', description: 'Paste the script you want AI to enhance.', variant: 'destructive' });
        return;
      }
      scriptMode = 'ai_enhance';
      scriptText = userScript.trim();
    } else if (inputMode === 'braindump') {
      if (!brainDump.trim()) {
        toast({ title: 'Enter your brain dump', description: 'Type your rough ideas so AI can build a script.', variant: 'destructive' });
        return;
      }
      scriptMode = 'ai_generate';
      brainDumpText = brainDump.trim();
    } else {
      scriptMode = 'ai_generate';
    }

    if (!topic.trim() && inputMode !== 'my_script') {
      toast({ title: 'Enter a topic', variant: 'destructive' });
      return;
    }

    // Map contentLength to format and timing
    const format = contentLength === '5-10' ? 'deep_dive' as const : 'lesson' as const;
    // Map contentLength to Golpo timing (in minutes)
    const timingMap: Record<string, string> = {
      '30s': '0.5',
      '1min': '1',
      '2-3': '3',
      '5-10': '8',
    };
    const timing = timingMap[contentLength] || undefined;

    // Map videoFormat to Golpo video_type
    const videoType = (videoFormat === 'reel' || videoFormat === 'short' || videoFormat === 'tiktok') ? 'short' as const : 'long' as const;

    startPipeline.mutate({
      topic: topic.trim() || 'Untitled Script',
      format,
      scriptOnly,
      scriptMode,
      userScript: scriptText,
      brainDump: brainDumpText,
      persona,
      voiceStyle,
      contentFocus,
      contentLength,
      storyFormat,
      bgMusic,
      timing,
      // Golpo API v1 options
      videoType,
      ttsModel,
      whiteBg,
      outputVolume,
      bgVolume,
      visualStyle,
      canvasImageStyle: visualStyle === 'canvas' ? canvasImageStyle : undefined,
      canvasPenStyle: visualStyle === 'canvas' ? canvasPenStyle : undefined,
      logoUrl: logoUrl || undefined,
      logoPlacement: logoUrl ? logoPlacement : undefined,
    });
  }, [inputMode, topic, userScript, brainDump, scriptOnly, persona, voiceStyle, contentFocus, contentLength, storyFormat, bgMusic, videoFormat, visualStyle, canvasImageStyle, canvasPenStyle, ttsModel, whiteBg, outputVolume, bgVolume, logoUrl, logoPlacement, startPipeline, toast]);

  const handleUseSuggestion = (suggestion: { topic: string; format: string }) => {
    setTopic(suggestion.topic);
    setInputMode('ai_generate');
    toast({ title: 'Topic loaded', description: 'Review and start the pipeline.', variant: 'default' });
  };

  const handleClearFilters = () => {
    setPersona('coach-inayah');
    setVideoFormat('all');
    setVoiceStyle('solo-female-3');
    setContentFocus('teaching');
    setContentLength('5-10');
    setStoryFormat('whiteboard');
    setBgMusic('engaging');
    // Reset Golpo API v1 options
    setVisualStyle('default');
    setCanvasImageStyle('whiteboard');
    setCanvasPenStyle('stylus');
    setTtsModel('accurate');
    setWhiteBg(true);
    setOutputVolume('1.0');
    setBgVolume('0.3');
    setLogoUrl('');
    setLogoPlacement('tl');
    setShowAdvanced(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  const toggleVideoSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVideos = () => {
    const allIds = (videosQuery.data?.videos || []).map((v: any) => v.id);
    setSelectedIds(new Set(allIds));
  };

  const deselectAllVideos = () => {
    setSelectedIds(new Set());
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
    if (inputMode === 'my_script' || inputMode === 'ai_enhance') {
      return userScript.trim().split(/\s+/).filter(Boolean).length;
    }
    if (inputMode === 'braindump') {
      return brainDump.trim().split(/\s+/).filter(Boolean).length;
    }
    return 0;
  }, [inputMode, userScript, brainDump]);

  const canSubmit = useMemo(() => {
    if (startPipeline.isPending) return false;
    if (inputMode === 'my_script') return userScript.trim().length > 50;
    if (inputMode === 'ai_enhance') return userScript.trim().length > 50 && topic.trim().length > 0;
    if (inputMode === 'braindump') return brainDump.trim().length > 20 && topic.trim().length > 0;
    if (inputMode === 'ai_generate') return topic.trim().length > 0;
    if (inputMode === 'suggest') return topic.trim().length > 0;
    return false;
  }, [inputMode, userScript, brainDump, topic, startPipeline.isPending]);

  const actionLabel = useMemo(() => {
    if (inputMode === 'my_script') return scriptOnly ? 'Save Script' : 'Generate Video';
    if (inputMode === 'ai_enhance') return 'Enhance Script';
    if (inputMode === 'braindump') return 'Build Script from Ideas';
    return scriptOnly ? 'Generate Script' : 'Generate Script + Video';
  }, [inputMode, scriptOnly]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-serif text-foreground">Content Studio</h2>
          <p className="text-sm text-muted-foreground mt-1">AI Video Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          {reviewVideos.length > 0 && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => {
                setSelectedVideoId(reviewVideos[0].id);
                setActiveTab('videos');
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
          {/* Tab-like navigation */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === 'create' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors border-l ${activeTab === 'videos' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            >
              Videos ({videosQuery.data?.total || 0})
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CREATE TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'create' && (
        <div className="space-y-5">
          {/* ── Content Filters Panel ──────────────────────────────────────── */}
          <div className="border rounded-xl bg-card">
            {/* Filter Header */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Content Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="bg-emerald-500 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearFilters(); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
                {showFilters ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Filter Content */}
            {showFilters && (
              <div className="px-5 pb-5 space-y-5 border-t">
                {/* Presets */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Bookmark className="w-3.5 h-3.5" />
                      Presets
                    </label>
                    <button
                      onClick={() => setShowPresetSave(!showPresetSave)}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Save Current
                    </button>
                  </div>

                  {/* Save Preset Form */}
                  {showPresetSave && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Preset name..."
                        className="flex-1 px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:ring-2 focus:ring-ring focus:border-ring outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      />
                      <Button
                        size="sm"
                        onClick={handleSavePreset}
                        disabled={!presetName.trim() || savePresetMut.isPending}
                        className="h-8 gap-1"
                      >
                        {savePresetMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </Button>
                    </div>
                  )}

                  {/* Preset List */}
                  {presetsQuery.data && presetsQuery.data.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {presetsQuery.data.map((preset: any) => (
                        <div key={preset.id} className="group relative">
                          <button
                            onClick={() => handleLoadPreset(preset)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/50 hover:bg-accent hover:border-accent transition-colors"
                          >
                            {preset.emoji || '⚡'} {preset.name}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deletePresetMut.mutate({ id: preset.id }); }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No presets saved yet. Configure your filters and save them for quick access.</p>
                  )}
                </div>

                {/* Presenter Persona */}
                <div className="pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    <User className="w-3.5 h-3.5" />
                    Presenter Persona
                  </label>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`flex-shrink-0 w-[160px] border rounded-xl p-3 text-left transition-all duration-200 ${
                          persona === p.id
                            ? 'border-[#C9A962] bg-[#C9A962]/5 ring-1 ring-[#C9A962]/30'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-accent/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className={`w-8 h-8 rounded-lg ${p.color} flex items-center justify-center`}>
                            <User className="w-4 h-4 text-white" />
                          </div>
                          {persona === p.id && (
                            <CheckCircle className="w-4 h-4 text-[#C9A962]" />
                          )}
                        </div>
                        <p className="text-sm font-medium leading-tight">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 1: Format, Voice Style, Focus */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Film className="w-3.5 h-3.5" />
                      Format
                    </label>
                    <Select value={videoFormat} onValueChange={setVideoFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Formats</SelectItem>
                        <SelectItem value="instagram-reel">Instagram Reel</SelectItem>
                        <SelectItem value="youtube-short">YouTube Short</SelectItem>
                        <SelectItem value="tiktok-reel">TikTok Reel</SelectItem>
                        <SelectItem value="youtube-lesson">YouTube Lesson</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Mic className="w-3.5 h-3.5" />
                      Voice Style
                    </label>
                    <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo-female-3">Female 1 (Coach Inayah)</SelectItem>
                        <SelectItem value="solo-female-4">Female 2</SelectItem>
                        <SelectItem value="solo-male-3">Male 1</SelectItem>
                        <SelectItem value="solo-male-4">Male 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Target className="w-3.5 h-3.5" />
                      Focus
                    </label>
                    <Select value={contentFocus} onValueChange={setContentFocus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teaching">Teaching / Coaching</SelectItem>
                        <SelectItem value="marketing">Marketing / Promo</SelectItem>
                        <SelectItem value="case-study">Case Study</SelectItem>
                        <SelectItem value="motivational">Motivational</SelectItem>
                        <SelectItem value="strategy">Strategy / Tips</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Length, Story Format, Music */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Timer className="w-3.5 h-3.5" />
                      Length
                    </label>
                    <Select value={contentLength} onValueChange={setContentLength}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="30s">30 seconds — Quick hook + one insight</SelectItem>
                        <SelectItem value="1min">1 minute — Hook + lesson + CTA</SelectItem>
                        <SelectItem value="2-3">2-3 minutes — Full lesson with examples</SelectItem>
                        <SelectItem value="5-10">5-10 minutes — Deep dive / full course</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      Story Format
                    </label>
                    <Select value={storyFormat} onValueChange={setStoryFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="step-by-step">Step-by-Step Tutorial</SelectItem>
                        <SelectItem value="before-after">Before / After</SelectItem>
                        <SelectItem value="myth-reality">Myth vs Reality</SelectItem>
                        <SelectItem value="whiteboard">Whiteboard Breakdown</SelectItem>
                        <SelectItem value="common-mistakes">Common Mistakes</SelectItem>
                        <SelectItem value="client-profile">Client Profile Breakdown</SelectItem>
                        <SelectItem value="qa-faq">Q&A / FAQ</SelectItem>
                        <SelectItem value="challenge-response">Challenge / Response</SelectItem>
                        <SelectItem value="top-x">Top X List</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Music className="w-3.5 h-3.5" />
                      Music
                    </label>
                    <Select value={bgMusic} onValueChange={setBgMusic}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engaging">Engaging — Subtle corporate pulse</SelectItem>
                        <SelectItem value="lofi">Lo-Fi — Calm, study vibes</SelectItem>
                        <SelectItem value="jazz">Jazz — Warm, neutral bed</SelectItem>
                        <SelectItem value="inspirational">Inspirational — Uplifting orchestral</SelectItem>
                        <SelectItem value="dramatic">Dramatic — Cinematic tension</SelectItem>
                        <SelectItem value="whimsical">Whimsical — Playful, upbeat</SelectItem>
                        <SelectItem value="hyper">Hyper — High-energy electronic</SelectItem>
                        <SelectItem value="none">No Music — Voice only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Visual Style, TTS Model, Background */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Palette className="w-3.5 h-3.5" />
                      Visual Style
                    </label>
                    <Select value={visualStyle} onValueChange={(v: any) => setVisualStyle(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Whiteboard</SelectItem>
                        <SelectItem value="sketch">Golpo Sketch</SelectItem>
                        <SelectItem value="sketch-advanced">Golpo Sketch (Advanced)</SelectItem>
                        <SelectItem value="canvas">Golpo Canvas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Zap className="w-3.5 h-3.5" />
                      TTS Quality
                    </label>
                    <Select value={ttsModel} onValueChange={(v: any) => setTtsModel(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accurate">Accurate — Best quality</SelectItem>
                        <SelectItem value="flash">Flash — Faster, lower cost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Monitor className="w-3.5 h-3.5" />
                      Background
                    </label>
                    <Select value={whiteBg ? 'white' : 'dark'} onValueChange={(v) => setWhiteBg(v === 'white')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="white">White Background</SelectItem>
                        <SelectItem value="dark">Dark Background</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Canvas sub-options (conditional) */}
                {visualStyle === 'canvas' && (
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50 border border-border">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        <Image className="w-3.5 h-3.5" />
                        Canvas Image Style
                      </label>
                      <Select value={canvasImageStyle} onValueChange={setCanvasImageStyle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whiteboard">Whiteboard</SelectItem>
                          <SelectItem value="neon">Neon</SelectItem>
                          <SelectItem value="modern_minimal">Modern Minimal</SelectItem>
                          <SelectItem value="playful">Playful</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="editorial">Editorial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        <PenTool className="w-3.5 h-3.5" />
                        Canvas Pen Style
                      </label>
                      <Select value={canvasPenStyle} onValueChange={setCanvasPenStyle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stylus">Stylus</SelectItem>
                          <SelectItem value="marker">Marker</SelectItem>
                          <SelectItem value="pen">Pen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Advanced Options Toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-3 rounded-lg bg-muted/30 border border-border">
                    {/* Volume Controls */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <Volume2 className="w-3.5 h-3.5" />
                          Output Volume
                        </label>
                        <Select value={outputVolume} onValueChange={setOutputVolume}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.5">50%</SelectItem>
                            <SelectItem value="0.7">70%</SelectItem>
                            <SelectItem value="0.8">80%</SelectItem>
                            <SelectItem value="0.9">90%</SelectItem>
                            <SelectItem value="1.0">100% (Default)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <Music className="w-3.5 h-3.5" />
                          Music Volume
                        </label>
                        <Select value={bgVolume} onValueChange={setBgVolume}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.1">10% — Very subtle</SelectItem>
                            <SelectItem value="0.2">20%</SelectItem>
                            <SelectItem value="0.3">30% (Default)</SelectItem>
                            <SelectItem value="0.5">50%</SelectItem>
                            <SelectItem value="0.7">70%</SelectItem>
                            <SelectItem value="1.0">100% — Full</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="grid grid-cols-[1fr_120px] gap-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <Image className="w-3.5 h-3.5" />
                          Logo URL
                        </label>
                        <input
                          type="url"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:ring-2 focus:ring-ring focus:border-ring outline-none"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Placement
                        </label>
                        <Select value={logoPlacement} onValueChange={setLogoPlacement} disabled={!logoUrl}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tl">Top Left</SelectItem>
                            <SelectItem value="tr">Top Right</SelectItem>
                            <SelectItem value="bl">Bottom Left</SelectItem>
                            <SelectItem value="br">Bottom Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Hint below filters ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Topics are generated based on your filter selections
            </p>
            {inputMode === 'suggest' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => suggestTopicsMut.mutate({ count: 5 })}
                disabled={suggestTopicsMut.isPending}
                className="gap-1.5 h-7 text-xs"
              >
                <RefreshCw className={`w-3 h-3 ${suggestTopicsMut.isPending ? 'animate-spin' : ''}`} />
                Refresh Topics
              </Button>
            )}
          </div>

          {/* ── Input Mode Cards (left column layout) ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
            {/* Left: Input Mode Selector + Input Area */}
            <div className="space-y-3">
              {INPUT_MODES.map((m) => {
                const Icon = m.icon;
                const isActive = inputMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setInputMode(m.id);
                      if (m.id === 'suggest' && !suggestTopicsMut.data) {
                        suggestTopicsMut.mutate({ count: 5 });
                      }
                    }}
                    className={`w-full text-left border rounded-xl p-4 transition-all duration-200 ${
                      isActive
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-accent/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary/10' : 'bg-accent'}`}>
                        <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>{m.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Active Input Content */}
            <div className="space-y-4">
              {/* ── AI SUGGEST ── */}
              {inputMode === 'suggest' && (
                <div className="space-y-3">
                  {suggestTopicsMut.isPending ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground border rounded-xl">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating topics with AI...
                    </div>
                  ) : suggestTopicsMut.data?.topics?.length ? (
                    <div className="space-y-2">
                      {suggestTopicsMut.data.topics.map((suggestion: any, i: number) => (
                        <div
                          key={i}
                          className="border rounded-xl p-4 hover:bg-accent/50 transition-colors cursor-pointer group"
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
                              <Play className="w-3 h-3" />
                              Use
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border rounded-xl">
                      <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click "Refresh Topics" to generate AI topic suggestions</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── BRAIN DUMP ── */}
              {inputMode === 'braindump' && (
                <div className="space-y-4">
                  <Input
                    placeholder="Topic title (e.g., How Airbnb arbitrage works)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="text-sm"
                  />
                  <div className="relative">
                    <Textarea
                      placeholder={`Dump your rough thoughts here...

Example:
- explaining to a client how Airbnb arbitrage works
- use the framing of making an extra $4K/month
- the math has to work out with real numbers
- mention startup costs, monthly rent vs Airbnb revenue
- end with CTA to the free calculator tool`}
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
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={scriptOnly} onCheckedChange={setScriptOnly} />
                      <span className="text-sm text-muted-foreground">Script only (no video)</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartPipeline}
                    disabled={!canSubmit}
                    className="w-full gap-2"
                  >
                    {startPipeline.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    Build Script from Ideas
                  </Button>
                </div>
              )}

              {/* ── MY SCRIPT ── */}
              {inputMode === 'my_script' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Direct to Video</p>
                      <p className="text-xs text-emerald-700">Your script goes straight to Golpo AI for video generation. No review step needed.</p>
                    </div>
                  </div>
                  <Input
                    placeholder="Title (e.g., How Airbnb Arbitrage Works)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="text-sm"
                  />
                  <div className="relative">
                    <Textarea
                      placeholder={`Paste your narration script here...\n\nExample:\nHey, let me break down exactly how Airbnb arbitrage works. You rent a property long-term — say for $1,500 a month. Then you furnish it, list it on Airbnb, and charge $150 a night. If you book just 20 nights a month, that's $3,000 coming in. Subtract your $1,500 rent, cleaning costs, and supplies — you're keeping $800 to $1,200 every single month from one property...`}
                      value={userScript}
                      onChange={(e) => setUserScript(e.target.value)}
                      rows={14}
                      className="text-sm"
                    />
                    {wordCount > 0 && (
                      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                        {wordCount} words · ~{Math.ceil(wordCount / 150)} min video
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={contentLength} onValueChange={setContentLength}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Video Length" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (from word count)</SelectItem>
                        <SelectItem value="30s">~30 seconds</SelectItem>
                        <SelectItem value="1min">~1 minute</SelectItem>
                        <SelectItem value="2-3">2-3 minutes</SelectItem>
                        <SelectItem value="5-10">5-10 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch checked={scriptOnly} onCheckedChange={setScriptOnly} />
                      <span className="text-sm text-muted-foreground">Script only (no video)</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartPipeline}
                    disabled={!canSubmit}
                    size="lg"
                    className="w-full gap-2 text-base"
                  >
                    {startPipeline.isPending ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Sending to Golpo AI...</>
                    ) : scriptOnly ? (
                      <><Save className="w-5 h-5" /> Save Script</>
                    ) : (
                      <><Video className="w-5 h-5" /> Generate Video</>
                    )}
                  </Button>
                </div>
              )}

              {/* ── AI ENHANCE ── */}
              {inputMode === 'ai_enhance' && (
                <div className="space-y-4">
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
                  <Button
                    onClick={handleStartPipeline}
                    disabled={!canSubmit}
                    className="w-full gap-2"
                  >
                    {startPipeline.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Enhance Script
                  </Button>
                </div>
              )}

              {/* ── AI GENERATE ── */}
              {inputMode === 'ai_generate' && (
                <div className="space-y-4">
                  <Input
                    placeholder="e.g., How to find your first Airbnb arbitrage deal in Denver for under $3,000"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={scriptOnly} onCheckedChange={setScriptOnly} />
                      <span className="text-sm text-muted-foreground">Script only (no video)</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartPipeline}
                    disabled={!canSubmit}
                    className="w-full gap-2"
                  >
                    {startPipeline.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {actionLabel}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIDEOS TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
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
                      {/* Check Golpo Status button for stuck videos */}
                      {['video_generating', 'video_failed'].includes(videoDetail.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkGolpoMut.mutate({ videoId: videoDetail.id })}
                          disabled={checkGolpoMut.isPending}
                          className="gap-1.5"
                        >
                          {checkGolpoMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          Check Status
                        </Button>
                      )}
                      {videoDetail.videoUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={videoDetail.videoUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Watch Video
                          </a>
                        </Button>
                      )}
                      {videoDetail.slug && videoDetail.status === 'video_complete' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-[#C9A962] border-[#C9A962]/30 hover:bg-[#C9A962]/10"
                          onClick={() => {
                            const url = `${window.location.origin}/watch/${videoDetail.slug}`;
                            navigator.clipboard.writeText(url);
                            toast.success('Share link copied!', { description: url });
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Share Link
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
                        <div className="flex gap-2 mt-2">
                          {['video_failed', 'pipeline_failed'].includes(videoDetail.status) && videoDetail.narrationScript && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
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
                          {['video_failed', 'video_generating'].includes(videoDetail.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => checkGolpoMut.mutate({ videoId: videoDetail.id })}
                              disabled={checkGolpoMut.isPending}
                            >
                              {checkGolpoMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                              Check Golpo Status
                            </Button>
                          )}
                        </div>
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
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    {videosQuery.data?.total || 0} video{(videosQuery.data?.total || 0) !== 1 ? 's' : ''}
                  </h3>
                  {bulkMode && selectedIds.size > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {selectedIds.size} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {bulkMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectedIds.size === (videosQuery.data?.videos || []).length ? deselectAllVideos : selectAllVideos}
                        className="gap-1.5 h-7 text-xs"
                      >
                        {selectedIds.size === (videosQuery.data?.videos || []).length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={selectedIds.size === 0 || bulkDeleteMut.isPending}
                        onClick={() => {
                          if (confirm(`Delete ${selectedIds.size} video${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
                            bulkDeleteMut.mutate({ ids: Array.from(selectedIds) });
                          }
                        }}
                        className="gap-1.5 h-7 text-xs"
                      >
                        {bulkDeleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete ({selectedIds.size})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBulkMode(true)}
                        className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Bulk Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => videosQuery.refetch()}
                        className="gap-1.5 h-7"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                      </Button>
                    </>
                  )}
                </div>
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
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {(videosQuery.data?.videos || []).map((video: any) => (
                    <Card
                      key={video.id}
                      className={`cursor-pointer hover:bg-accent/30 transition-colors ${video.status === 'script_review' ? 'border-amber-300 bg-amber-50/30' : ''} ${bulkMode && selectedIds.has(video.id) ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''}`}
                      onClick={() => bulkMode ? toggleVideoSelection(video.id) : setSelectedVideoId(video.id)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {bulkMode && (
                            <div className="flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(video.id)}
                                onChange={() => toggleVideoSelection(video.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-gray-300 text-destructive focus:ring-destructive cursor-pointer"
                              />
                            </div>
                          )}
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
                          {video.slug && video.status === 'video_complete' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/watch/${video.slug}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Share link copied!');
                              }}
                              className="gap-1 h-7 text-xs text-[#C9A962]"
                            >
                              <Copy className="w-3 h-3" />
                              Share
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
        </div>
      )}
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
