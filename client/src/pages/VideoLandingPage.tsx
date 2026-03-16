/**
 * VideoLandingPage — Public shareable landing page for Content Hub videos.
 *
 * Route: /watch/:slug
 * No authentication required. Shows the video, title, and a CTA.
 * Designed to be shared with clients, closers, and prospects.
 */

import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Loader2, Play, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VideoLandingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: video, isLoading, error } = trpc.contentHub.getVideoBySlug.useQuery(
    { slug: slug || '' },
    { enabled: !!slug, retry: false }
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#C9A962]" />
          <p className="text-white/60 font-sans text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  // Error / not found
  if (error || !video) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <Play className="w-8 h-8 text-white/30" />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-white mb-3">
            Video Not Available
          </h1>
          <p className="text-white/50 font-sans mb-8">
            This video may still be generating or the link may be incorrect.
          </p>
          <a href="/" className="inline-block">
            <Button variant="outline" className="border-[#C9A962]/30 text-[#C9A962] hover:bg-[#C9A962]/10">
              Go to Home
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const formattedDate = video.createdAt
    ? new Date(video.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header bar */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <span className="text-[#C9A962] font-serif font-bold text-sm">CI</span>
            </div>
            <span className="text-white/70 font-sans text-sm group-hover:text-white transition-colors">
              Coach Inayah
            </span>
          </a>
          <a href="/" className="hidden sm:inline-block">
            <Button
              variant="outline"
              size="sm"
              className="border-[#C9A962]/30 text-[#C9A962] hover:bg-[#C9A962]/10 font-sans text-xs"
            >
              Try the Revenue Calculator
            </Button>
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Video title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-semibold text-white leading-tight mb-3">
            {video.topic}
          </h1>
          {formattedDate && (
            <div className="flex items-center gap-2 text-white/40 text-sm font-sans">
              <Calendar className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        {/* Video player */}
        <div className="relative rounded-xl overflow-hidden bg-black/50 shadow-2xl shadow-black/50 mb-8">
          <div className="aspect-video">
            {video.videoUrl ? (
              <video
                src={video.videoUrl}
                controls
                autoPlay={false}
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
                poster={video.thumbnailUrl || undefined}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-white/40 font-sans">Video not available</p>
              </div>
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#C9A962]/10 to-[#C9A962]/5 border border-[#C9A962]/20 rounded-xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg md:text-xl font-serif font-semibold text-white mb-1">
                Want to see how much your property could earn?
              </h2>
              <p className="text-white/50 font-sans text-sm">
                Get a free rental revenue estimate powered by real market data.
              </p>
            </div>
            <a href="/" className="flex-shrink-0">
              <Button className="bg-[#C9A962] hover:bg-[#B8983F] text-[#0F172A] font-semibold font-sans px-6">
                <ExternalLink className="w-4 h-4 mr-2" />
                Get Free Estimate
              </Button>
            </a>
          </div>
        </div>

        {/* Script / transcript section */}
        {video.narrationScript && (
          <div className="border border-white/5 rounded-xl p-6 md:p-8">
            <h3 className="text-sm font-sans font-medium text-white/40 uppercase tracking-wider mb-4">
              Video Transcript
            </h3>
            <div className="text-white/70 font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {video.narrationScript}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <p className="text-white/30 font-sans text-xs">
            &copy; {new Date().getFullYear()} Coach Inayah &middot; I&B Coaching
          </p>
          <div className="flex items-center gap-4">
            <a href="/privacy-policy" className="text-white/30 hover:text-white/50 font-sans text-xs transition-colors">
              Privacy
            </a>
            <a href="/terms-of-service" className="text-white/30 hover:text-white/50 font-sans text-xs transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
