/**
 * Open Graph Meta Tag Middleware
 *
 * Intercepts /watch/:slug requests and injects dynamic OG meta tags
 * into the HTML template so social media crawlers (which don't execute JS)
 * see the correct title, description, and image for each video.
 *
 * This middleware must be registered BEFORE the Vite/static catch-all handler.
 */

import type { Request, Response, NextFunction } from 'express';
import { getVideoBySlug } from './content-hub-pipeline';

const BASE_URL = 'https://coachinayahturnkeytool.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = 'Coach Inayah';

/**
 * Escape HTML special characters to prevent XSS in meta tag content.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build OG + Twitter Card meta tags for a video.
 */
function buildVideoMetaTags(video: {
  topic: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  narrationScript: string | null;
  slug: string | null;
}): string {
  const title = escapeHtml(video.topic);
  const url = `${BASE_URL}/watch/${video.slug || ''}`;

  // Build a description from the narration script (first ~160 chars)
  let description = 'Watch this short-term rental education video from Coach Inayah.';
  if (video.narrationScript) {
    const cleaned = video.narrationScript
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 0) {
      description = cleaned.length > 160
        ? cleaned.substring(0, 157) + '...'
        : cleaned;
    }
  }
  const safeDescription = escapeHtml(description);

  // Use thumbnail if available, otherwise branded fallback
  const imageUrl = video.thumbnailUrl || DEFAULT_OG_IMAGE;

  const tags: string[] = [
    // Open Graph
    `<meta property="og:type" content="video.other" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
  ];

  // Add video-specific OG tags if we have a video URL
  if (video.videoUrl) {
    tags.push(`<meta property="og:video" content="${escapeHtml(video.videoUrl)}" />`);
    tags.push(`<meta property="og:video:type" content="video/mp4" />`);
  }

  // Twitter Card
  tags.push(
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:url" content="${url}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${safeDescription}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    `<meta name="twitter:creator" content="@CoachInayah" />`,
  );

  return tags.join('\n    ');
}

/**
 * Express middleware that injects OG meta tags for /watch/:slug routes.
 *
 * It stores the video OG data on `res.locals` so the Vite/static HTML
 * handler can call `injectOgTags()` to replace the default meta tags
 * before sending the response.
 */
export function createOgMetaHandler() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only handle /watch/:slug paths
    const watchMatch = req.path.match(/^\/watch\/([^/]+)$/);
    if (!watchMatch) {
      return next();
    }

    const slug = watchMatch[1];

    try {
      const video = await getVideoBySlug(slug);

      // Store the OG tags on res.locals so the Vite handler can use them
      res.locals.ogMetaTags = buildVideoMetaTags(video);
      res.locals.ogTitle = video.topic;
    } catch {
      // Video not found or not complete — fall through with default OG tags
    }

    next();
  };
}

/**
 * Replace default OG/Twitter meta tags in the HTML template with video-specific ones.
 * Called from the Vite/static HTML serving logic.
 */
export function injectOgTags(html: string, res: Response): string {
  const ogMetaTags = res.locals.ogMetaTags as string | undefined;
  const ogTitle = res.locals.ogTitle as string | undefined;

  if (!ogMetaTags) return html;

  // Replace the existing OG block (between <!-- Open Graph --> and twitter:creator line)
  let result = html;

  const ogBlockRegex = /<!-- Open Graph \/ Facebook -->[\s\S]*?<meta name="twitter:creator"[^>]*\/>/;
  if (ogBlockRegex.test(result)) {
    result = result.replace(ogBlockRegex, `<!-- Open Graph / Video -->\n    ${ogMetaTags}`);
  }

  // Replace the page title
  if (ogTitle) {
    result = result.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(ogTitle)} | ${SITE_NAME}</title>`
    );
    // Also replace the meta description
    result = result.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(ogTitle)} - Watch this video from ${SITE_NAME}." />`
    );
  }

  return result;
}
