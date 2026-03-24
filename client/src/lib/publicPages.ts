/**
 * Utility to detect public-facing pages where admin/app-level overlays
 * (mode toggles, trust banners, language selectors) should be hidden.
 *
 * Public pages are those shared with clients/prospects — they should
 * show only the page content with its own branding, not app chrome.
 */

const PUBLIC_PATH_PREFIXES = [
  '/watch/',       // Video landing pages
  '/share/',       // Shared reports
  '/report/',      // Shared reports (legacy)
  '/view-report/', // Shared reports (legacy)
  '/regulation/',  // Shared regulation reports
  '/bug/',         // Bug report pages
  '/explore',      // Public lead validation page
  '/about',         // Public brand/SEO page
];

/**
 * Returns true if the current pathname is a public-facing page
 * where global overlays should be hidden.
 */
export function isPublicPage(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}
