/**
 * Content Studio v2 — Fully Autonomous Script Generator
 *
 * One-click generates complete ready-to-film narration scripts.
 * The AI pulls real platform data, picks the best topic, and generates
 * a narrative script with real numbers woven in.
 *
 * Exports:
 *   - ContentStudioPage: Standalone page (unused now, kept for direct access)
 *   - ContentStudioTab: Embeddable component for the admin dashboard
 */

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ── Format metadata ─────────────────────────────────────────────────────────

const FORMAT_META: Record<string, { icon: string; color: string; label: string }> = {
  reel: { icon: '📱', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20', label: 'Reel' },
  short: { icon: '⚡', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'Short' },
  lesson: { icon: '📚', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'Lesson' },
  deep_dive: { icon: '🎓', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: 'Deep Dive' },
};

// ── Main Content Studio Component ───────────────────────────────────────────

function ContentStudioCore() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>('any');
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [expandedScript, setExpandedScript] = useState<number | null>(null);

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
      format: formatFilter !== 'any' ? (formatFilter as 'reel' | 'short' | 'lesson' | 'deep_dive') : undefined,
    },
    { staleTime: 30_000 },
  );

  const deleteScript = trpc.contentStudio.deleteScript.useMutation({
    onSuccess: () => {
      scriptsList.refetch();
      toast({ title: 'Script deleted' });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = (format?: string) => {
    autoGenerate.mutate(format && format !== 'any' ? { format: format as 'reel' | 'short' | 'lesson' | 'deep_dive' } : undefined);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  // ── Computed ────────────────────────────────────────────────────────────

  const latestScript = autoGenerate.data;

  return (
    <div className="space-y-6">
      {/* ── Hero: One-Click Generate ─────────────────────────────────── */}
      <Card className="border-[#C9A962]/30 bg-gradient-to-br from-[#0F172A] to-[#1e293b] text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNDOUE5NjIiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTJ2NEgyNFYwaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-[#C9A962]" />
                <span className="text-[#C9A962] font-medium text-sm uppercase tracking-wider">
                  Content Studio
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">
                One-Click Script Generator
              </h2>
              <p className="text-white/60 text-sm md:text-base max-w-lg">
                AI pulls your real platform data, picks the best topic angle, and generates a complete
                ready-to-film narration script in Coach Inayah's voice. Zero effort required.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Button
                size="lg"
                onClick={() => handleGenerate()}
                disabled={autoGenerate.isPending}
                className="bg-[#C9A962] hover:bg-[#b8963f] text-[#0F172A] font-semibold text-base px-8 py-6 shadow-lg shadow-[#C9A962]/20"
              >
                {autoGenerate.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Generate Script
                  </>
                )}
              </Button>

              <div className="flex gap-2">
                {Object.entries(FORMAT_META).map(([key, meta]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(key)}
                    disabled={autoGenerate.isPending}
                    className="border-white/20 text-white/70 hover:text-white hover:border-[#C9A962]/50 text-xs flex-1"
                  >
                    <span className="mr-1">{meta.icon}</span>
                    {meta.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {autoGenerate.isPending && (
            <div className="mt-6 flex items-center gap-3 text-white/60 text-sm bg-white/5 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#C9A962]" />
              <span>Pulling platform data... analyzing trends... crafting narrative...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Generated Script Result ──────────────────────────────────── */}
      {latestScript && (
        <Card className="border-[#C9A962]/30 bg-white shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={FORMAT_META[latestScript.format]?.color || 'bg-gray-100'}>
                    {FORMAT_META[latestScript.format]?.icon} {FORMAT_META[latestScript.format]?.label || latestScript.format}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    ~{latestScript.estimatedDurationSeconds}s
                  </Badge>
                </div>
                <CardTitle className="text-xl font-serif text-[#0F172A]">
                  {latestScript.title}
                </CardTitle>
                {latestScript.narrativeAngle && (
                  <p className="text-sm text-[#0F172A]/50 mt-1 italic">
                    Angle: {latestScript.narrativeAngle}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(latestScript.script, 'full-script')}
                className="shrink-0"
              >
                {copiedField === 'full-script' ? (
                  <><Check className="w-4 h-4 mr-1" /> Copied</>
                ) : (
                  <><Copy className="w-4 h-4 mr-1" /> Copy Script</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hook */}
            <div className="bg-[#C9A962]/5 border border-[#C9A962]/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C9A962]">
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
              <p className="text-[#0F172A] font-medium">{latestScript.hook}</p>
            </div>

            {/* Full Script */}
            <div className="bg-[#0F172A]/[0.02] border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]/50">
                  Full Narration Script
                </span>
              </div>
              <div className="text-[#0F172A]/80 whitespace-pre-wrap leading-relaxed font-sans text-sm">
                {latestScript.script}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
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
              <p className="text-emerald-800 font-medium">{latestScript.cta}</p>
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap gap-3 pt-2">
              {latestScript.targetAudience && (
                <div className="flex items-center gap-1 text-xs text-[#0F172A]/50">
                  <Users className="w-3 h-3" />
                  {latestScript.targetAudience}
                </div>
              )}
              {latestScript.keyDataPoints && latestScript.keyDataPoints.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-[#0F172A]/50">
                  <BarChart3 className="w-3 h-3" />
                  {latestScript.keyDataPoints.length} data points used
                </div>
              )}
              {latestScript.dataPreview && (
                <div className="flex items-center gap-1 text-xs text-[#0F172A]/50">
                  <Database className="w-3 h-3" />
                  {latestScript.dataPreview.propertiesUsed} properties, {latestScript.dataPreview.marketsUsed} markets
                </div>
              )}
            </div>

            {/* Data points used */}
            {latestScript.keyDataPoints && latestScript.keyDataPoints.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]/40 mb-2">
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
      <Card className="border-dashed">
        <CardContent className="p-4">
          <button
            onClick={() => setShowDataPreview(!showDataPreview)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-[#0F172A]/60 hover:text-[#0F172A] transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Data the AI will use</span>
            {showDataPreview ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showDataPreview && dataPreview.data && (
            <div className="mt-4 space-y-4">
              {/* Platform Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0F172A]/[0.03] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {dataPreview.data.platformStats.totalReports.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#0F172A]/50">Total Reports</p>
                </div>
                <div className="bg-[#0F172A]/[0.03] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {dataPreview.data.platformStats.totalLeads.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#0F172A]/50">Total Leads</p>
                </div>
                <div className="bg-[#0F172A]/[0.03] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {dataPreview.data.recentProperties.length}
                  </p>
                  <p className="text-xs text-[#0F172A]/50">Recent Properties</p>
                </div>
                <div className="bg-[#0F172A]/[0.03] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F172A]">
                    {dataPreview.data.marketSnapshots.length}
                  </p>
                  <p className="text-xs text-[#0F172A]/50">Markets</p>
                </div>
              </div>

              {/* Recent Properties */}
              {dataPreview.data.recentProperties.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]/40 mb-2">
                    Recent Property Data
                  </p>
                  <div className="space-y-1">
                    {dataPreview.data.recentProperties.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#0F172A]/60 bg-[#0F172A]/[0.02] rounded px-3 py-1.5">
                        <span className="font-medium">{p.city}, {p.state}</span>
                        <span>·</span>
                        <span>{p.bedrooms}BR</span>
                        <span>·</span>
                        <span>${Math.round(p.annualRevenue / 12).toLocaleString()}/mo</span>
                        <span>·</span>
                        <Badge variant="outline" className={`text-[10px] ${p.verdict === 'GO' ? 'border-emerald-500 text-emerald-600' : p.verdict === 'CAUTION' ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600'}`}>
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]/40 mb-2">
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]/40 mb-2">
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
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4" />
                  <span>No platform data yet. The AI will use its knowledge base and sample data to generate scripts. Run some property analyses first for real data.</span>
                </div>
              )}
            </div>
          )}

          {showDataPreview && dataPreview.isLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#0F172A]/50">
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
            <Film className="w-5 h-5 text-[#0F172A]/40" />
            <h3 className="text-lg font-semibold text-[#0F172A]">Script Library</h3>
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
                <SelectItem value="reel">📱 Reels</SelectItem>
                <SelectItem value="short">⚡ Shorts</SelectItem>
                <SelectItem value="lesson">📚 Lessons</SelectItem>
                <SelectItem value="deep_dive">🎓 Deep Dives</SelectItem>
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
          <div className="flex items-center justify-center py-12 text-[#0F172A]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading scripts...
          </div>
        )}

        {scriptsList.data && scriptsList.data.scripts.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-10 h-10 text-[#C9A962]/40 mb-3" />
              <p className="text-[#0F172A]/60 font-medium mb-1">No scripts yet</p>
              <p className="text-[#0F172A]/40 text-sm">
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
                <Card key={script.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${meta.color} text-[10px]`}>
                            {meta.icon} {meta.label}
                          </Badge>
                          <span className="text-[10px] text-[#0F172A]/40">
                            {new Date(script.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h4 className="font-semibold text-[#0F172A] text-sm truncate">
                          {script.title}
                        </h4>
                        <p className="text-xs text-[#0F172A]/50 mt-0.5 truncate">
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
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
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
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
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
                      <div className="mt-4 space-y-3 border-t pt-4">
                        <div className="bg-[#C9A962]/5 border border-[#C9A962]/20 rounded-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C9A962] mb-1">Hook</p>
                          <p className="text-sm text-[#0F172A]">{script.hook}</p>
                        </div>
                        <div className="bg-[#0F172A]/[0.02] rounded-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0F172A]/40 mb-1">Full Script</p>
                          <p className="text-sm text-[#0F172A]/80 whitespace-pre-wrap leading-relaxed">
                            {script.script}
                          </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">CTA</p>
                          <p className="text-sm text-emerald-800">{script.cta}</p>
                        </div>
                        {script.keyDataPoints && (script.keyDataPoints as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(script.keyDataPoints as string[]).map((dp, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{dp}</Badge>
                            ))}
                          </div>
                        )}
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
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ContentStudioCore />
      </div>
    </div>
  );
}
