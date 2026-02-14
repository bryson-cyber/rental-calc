/**
 * Content Studio Page
 *
 * Video narration script generator using Coach Inayah's persona.
 * Supports 4 formats: Reel, Short, Lesson, Deep Dive.
 * Uses Gemini API via the user's own API key.
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Video,
  Film,
  BookOpen,
  Microscope,
  Loader2,
  Copy,
  Check,
  Clock,
  Users,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Lightbulb,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

// ── Format metadata ──────────────────────────────────────────────────────────

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  reel: <Video className="w-5 h-5" />,
  short: <Film className="w-5 h-5" />,
  lesson: <BookOpen className="w-5 h-5" />,
  deep_dive: <Microscope className="w-5 h-5" />,
};

const FORMAT_COLORS: Record<string, string> = {
  reel: 'bg-pink-100 text-pink-700 border-pink-200',
  short: 'bg-blue-100 text-blue-700 border-blue-200',
  lesson: 'bg-amber-100 text-amber-700 border-amber-200',
  deep_dive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const FORMAT_LABELS: Record<string, string> = {
  reel: 'Instagram Reel / TikTok',
  short: 'YouTube Short',
  lesson: 'YouTube Lesson',
  deep_dive: 'YouTube Deep Dive',
};

const FORMAT_DURATIONS: Record<string, string> = {
  reel: '30-60 sec',
  short: '45-60 sec',
  lesson: '2-5 min',
  deep_dive: '5-10 min',
};

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  reel: 'Punchy, one-idea scripts that stop the scroll. Perfect for Instagram Reels and TikTok.',
  short: 'Energetic quick lessons with one data point. Ideal for YouTube Shorts.',
  lesson: 'Educational deep-teaching with 2-3 key points and real examples. Great for YouTube.',
  deep_dive: 'Comprehensive masterclass with full breakdowns and case studies.',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function ContentStudioPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [selectedFormat, setSelectedFormat] = useState<string>('reel');
  const [topic, setTopic] = useState('');
  const [marketData, setMarketData] = useState('');
  const [useMarketData, setUseMarketData] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<number | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFormat, setLibraryFormat] = useState<string | undefined>(undefined);

  // ── tRPC hooks ───────────────────────────────────────────────────────────
  const formatsQuery = trpc.contentStudio.getFormats.useQuery();
  const generateMutation = trpc.contentStudio.generateScript.useMutation({
    onSuccess: () => {
      toast.success('Script generated successfully!');
      scriptsQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to generate script');
    },
  });

  const scriptsQuery = trpc.contentStudio.listScripts.useQuery({
    format: libraryFormat as 'reel' | 'short' | 'lesson' | 'deep_dive' | undefined,
    search: librarySearch || undefined,
    limit: 50,
    offset: 0,
  });

  const deleteMutation = trpc.contentStudio.deleteScript.useMutation({
    onSuccess: () => {
      toast.success('Script deleted');
      scriptsQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete script');
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic for the script');
      return;
    }
    generateMutation.mutate({
      format: selectedFormat as 'reel' | 'short' | 'lesson' | 'deep_dive',
      topic: topic.trim(),
      marketData: useMarketData && marketData.trim() ? marketData.trim() : undefined,
    });
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleTopicSuggestion = (suggestion: string) => {
    setTopic(suggestion);
  };

  // ── Content pillars for suggestions ──────────────────────────────────────
  const pillars = formatsQuery.data?.pillars ?? {};

  // ── Generated result ─────────────────────────────────────────────────────
  const result = generateMutation.data;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <button className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Tools
              </button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#C9A962]/20 flex items-center justify-center border border-[#C9A962]/30">
              <Sparkles className="w-5 h-5 text-[#C9A962]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight">
              Content Studio
            </h1>
          </div>
          <p className="text-white/60 text-sm sm:text-base max-w-2xl">
            Generate video narration scripts using Coach Inayah's voice. Create
            scroll-stopping content for Instagram Reels, YouTube Shorts, lessons,
            and deep dives — all backed by real STR data.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'library')}>
          <TabsList className="mb-6">
            <TabsTrigger value="create" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Create Script
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Script Library
            </TabsTrigger>
          </TabsList>

          {/* ── CREATE TAB ─────────────────────────────────────────────── */}
          <TabsContent value="create">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: Format + Topic */}
              <div className="lg:col-span-1 space-y-6">
                {/* Format Selector */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Video Format</CardTitle>
                    <CardDescription>Choose the type of content to create</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {['reel', 'short', 'lesson', 'deep_dive'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormat(fmt)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                          selectedFormat === fmt
                            ? 'border-[#C9A962] bg-[#C9A962]/5 shadow-sm'
                            : 'border-transparent bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-md ${FORMAT_COLORS[fmt]}`}>
                            {FORMAT_ICONS[fmt]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-[#0F172A]">
                              {FORMAT_LABELS[fmt]}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {FORMAT_DURATIONS[fmt]}
                            </div>
                          </div>
                          {selectedFormat === fmt && (
                            <Check className="w-4 h-4 text-[#C9A962]" />
                          )}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Topic Input */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Topic</CardTitle>
                    <CardDescription>What should the script be about?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g., The #1 metric that tells you if an Airbnb market is worth it"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />

                    {/* Market Data Toggle */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useMarketData}
                          onChange={(e) => setUseMarketData(e.target.checked)}
                          className="rounded border-gray-300 text-[#C9A962] focus:ring-[#C9A962]"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5" />
                          Inject market data
                        </span>
                      </label>
                      {useMarketData && (
                        <Textarea
                          placeholder="Paste market data here (e.g., city stats, revenue numbers, occupancy rates). The AI will weave these real numbers into the script."
                          value={marketData}
                          onChange={(e) => setMarketData(e.target.value)}
                          className="min-h-[100px] resize-none text-xs"
                        />
                      )}
                    </div>

                    <Button
                      onClick={handleGenerate}
                      disabled={!topic.trim() || generateMutation.isPending}
                      className="w-full bg-[#C9A962] hover:bg-[#b8993f] text-white font-semibold"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Script...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Script
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Topic Suggestions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-[#C9A962]" />
                      Topic Ideas
                    </CardTitle>
                    <CardDescription>Click any topic to use it</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(pillars).map(([pillar, topics]) => (
                        <div key={pillar}>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {pillar}
                          </h4>
                          <div className="space-y-1">
                            {(topics as string[]).map((t) => (
                              <button
                                key={t}
                                onClick={() => handleTopicSuggestion(t)}
                                className="w-full text-left text-sm text-gray-700 hover:text-[#C9A962] hover:bg-[#C9A962]/5 rounded px-2 py-1.5 transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column: Generated Script Output */}
              <div className="lg:col-span-2">
                {generateMutation.isPending ? (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-[#C9A962]/10 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">Generating your script...</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Coach Inayah is crafting a {FORMAT_LABELS[selectedFormat]} script about your topic.
                          This usually takes 10-20 seconds.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : result ? (
                  <ScriptDisplay
                    result={result}
                    format={selectedFormat}
                    onCopy={handleCopy}
                    copiedField={copiedField}
                    onRegenerate={handleGenerate}
                    isRegenerating={generateMutation.isPending}
                  />
                ) : (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 max-w-md px-6">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">Ready to create</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Choose a format, enter a topic, and click Generate.
                          Your narration script will appear here — ready to record.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── LIBRARY TAB ────────────────────────────────────────────── */}
          <TabsContent value="library">
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search scripts by topic..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={!libraryFormat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLibraryFormat(undefined)}
                  >
                    All
                  </Button>
                  {['reel', 'short', 'lesson', 'deep_dive'].map((fmt) => (
                    <Button
                      key={fmt}
                      variant={libraryFormat === fmt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLibraryFormat(fmt)}
                      className="gap-1.5"
                    >
                      {FORMAT_ICONS[fmt]}
                      <span className="hidden sm:inline">{fmt === 'deep_dive' ? 'Deep Dive' : fmt.charAt(0).toUpperCase() + fmt.slice(1)}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Script count */}
              <div className="text-sm text-gray-500">
                {scriptsQuery.data?.total ?? 0} script{(scriptsQuery.data?.total ?? 0) !== 1 ? 's' : ''} saved
              </div>

              {/* Script list */}
              {scriptsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#C9A962]" />
                </div>
              ) : !scriptsQuery.data?.scripts.length ? (
                <Card className="py-12">
                  <div className="text-center space-y-3">
                    <BookOpen className="w-10 h-10 mx-auto text-gray-300" />
                    <p className="text-gray-500">No scripts yet. Create your first one!</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('create')}
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Create Script
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {scriptsQuery.data.scripts.map((script) => (
                    <Card key={script.id} className="overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                        onClick={() =>
                          setExpandedScript(expandedScript === script.id ? null : script.id)
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs ${FORMAT_COLORS[script.format]}`}
                              >
                                {FORMAT_LABELS[script.format] || script.format}
                              </Badge>
                              {script.estimatedDurationSeconds && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {script.estimatedDurationSeconds}s
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-[#0F172A] truncate">
                              {script.title}
                            </h3>
                            <p className="text-sm text-gray-500 truncate mt-0.5">
                              {script.topic}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {new Date(script.createdAt).toLocaleDateString()}
                            </span>
                            {expandedScript === script.id ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedScript === script.id && (
                        <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-gray-50/30">
                          {/* Hook */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Hook
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(script.hook, `hook-${script.id}`);
                                }}
                              >
                                {copiedField === `hook-${script.id}` ? (
                                  <Check className="w-3 h-3 mr-1" />
                                ) : (
                                  <Copy className="w-3 h-3 mr-1" />
                                )}
                                Copy
                              </Button>
                            </div>
                            <p className="text-sm font-medium text-[#0F172A] italic">
                              "{script.hook}"
                            </p>
                          </div>

                          {/* Full Script */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Full Script
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(script.script, `script-${script.id}`);
                                }}
                              >
                                {copiedField === `script-${script.id}` ? (
                                  <Check className="w-3 h-3 mr-1" />
                                ) : (
                                  <Copy className="w-3 h-3 mr-1" />
                                )}
                                Copy
                              </Button>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border">
                              {script.script}
                            </div>
                          </div>

                          {/* CTA */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Call to Action
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(script.cta, `cta-${script.id}`);
                                }}
                              >
                                {copiedField === `cta-${script.id}` ? (
                                  <Check className="w-3 h-3 mr-1" />
                                ) : (
                                  <Copy className="w-3 h-3 mr-1" />
                                )}
                                Copy
                              </Button>
                            </div>
                            <p className="text-sm text-[#C9A962] font-medium">
                              {script.cta}
                            </p>
                          </div>

                          {/* Metadata */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t">
                            {script.targetAudience && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Users className="w-3 h-3" />
                                {script.targetAudience}
                              </Badge>
                            )}
                            {(script.keyDataPoints as string[] | null)?.map((dp, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {dp}
                              </Badge>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this script?')) {
                                  deleteMutation.mutate({ id: script.id });
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Script Display Component ─────────────────────────────────────────────────

function ScriptDisplay({
  result,
  format,
  onCopy,
  copiedField,
  onRegenerate,
  isRegenerating,
}: {
  result: {
    title: string;
    hook: string;
    script: string;
    cta: string;
    estimatedDurationSeconds: number | null;
    keyDataPoints: string[] | null;
    targetAudience: string | null;
  };
  format: string;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Title Card */}
      <Card className="border-l-4 border-l-[#C9A962]">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-xs ${FORMAT_COLORS[format]}`}>
                  {FORMAT_LABELS[format]}
                </Badge>
                {result.estimatedDurationSeconds && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="w-3 h-3" />
                    ~{result.estimatedDurationSeconds}s
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-serif font-semibold text-[#0F172A]">
                {result.title}
              </h2>
              {result.targetAudience && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {result.targetAudience}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hook */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Hook (First 3 Seconds)
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(result.hook, 'result-hook')}
            >
              {copiedField === 'result-hook' ? (
                <Check className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium text-[#0F172A] italic leading-relaxed">
            "{result.hook}"
          </p>
        </CardContent>
      </Card>

      {/* Full Script */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Full Narration Script
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(result.script, 'result-script')}
            >
              {copiedField === 'result-script' ? (
                <Check className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copy Script
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-[#0F172A] text-white rounded-xl p-5 sm:p-6 font-sans text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {result.script}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="border-l-4 border-l-[#C9A962]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Call to Action
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(result.cta, 'result-cta')}
            >
              {copiedField === 'result-cta' ? (
                <Check className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-base font-medium text-[#C9A962]">{result.cta}</p>
        </CardContent>
      </Card>

      {/* Key Data Points */}
      {result.keyDataPoints && result.keyDataPoints.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Key Data Points Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.keyDataPoints.map((dp, i) => (
                <Badge key={i} variant="outline" className="text-sm py-1 px-3">
                  <BarChart3 className="w-3 h-3 mr-1.5 text-[#C9A962]" />
                  {dp}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Copy All */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={() =>
            onCopy(
              `TITLE: ${result.title}\n\nHOOK: ${result.hook}\n\nSCRIPT:\n${result.script}\n\nCTA: ${result.cta}`,
              'result-all',
            )
          }
        >
          {copiedField === 'result-all' ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          Copy Entire Script
        </Button>
      </div>
    </div>
  );
}
