import { describe, it, expect } from 'vitest';

/**
 * Tests for the OG meta tag middleware.
 * Tests the pure functions (injectOgTags, createOgMetaHandler) directly.
 */

describe('OG Meta Tag Middleware', () => {
  // Sample HTML template matching client/index.html structure
  const sampleHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Free Airbnb Calculator - Rental Arbitrage Revenue Tool</title>
    <meta name="description" content="Discover how much your property could earn on Airbnb & VRBO with our free rental revenue calculator." />
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://coachinayahturnkeytool.com/" />
    <meta property="og:title" content="Free Airbnb Calculator - Rental Arbitrage Revenue Tool" />
    <meta property="og:description" content="Discover how much your property could earn." />
    <meta property="og:image" content="https://coachinayahturnkeytool.com/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Coach Inayah Turnkey Tool" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://coachinayahturnkeytool.com/" />
    <meta name="twitter:title" content="Free Airbnb Calculator - Rental Arbitrage Revenue Tool" />
    <meta name="twitter:description" content="Discover how much your property could earn." />
    <meta name="twitter:image" content="https://coachinayahturnkeytool.com/og-image.png" />
    <meta name="twitter:creator" content="@CoachInayah" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

  describe('injectOgTags', () => {
    it('should return HTML unchanged when no OG tags are set on res.locals', async () => {
      const { injectOgTags } = await import('./og-meta-middleware');
      const mockRes = { locals: {} } as any;
      const result = injectOgTags(sampleHtml, mockRes);
      expect(result).toBe(sampleHtml);
    });

    it('should replace OG tags when ogMetaTags is set on res.locals', async () => {
      const { injectOgTags } = await import('./og-meta-middleware');
      const mockRes = {
        locals: {
          ogMetaTags: '<meta property="og:title" content="Test Video Title" />',
          ogTitle: 'Test Video Title',
        },
      } as any;

      const result = injectOgTags(sampleHtml, mockRes);

      // Should contain the new OG title
      expect(result).toContain('og:title" content="Test Video Title"');
      // Should NOT contain the old default OG title
      expect(result).not.toContain('og:title" content="Free Airbnb Calculator');
      // Page title should be updated
      expect(result).toContain('<title>Test Video Title | Coach Inayah</title>');
      // Old page title should be gone
      expect(result).not.toContain('<title>Free Airbnb Calculator');
    });

    it('should update the meta description when ogTitle is set', async () => {
      const { injectOgTags } = await import('./og-meta-middleware');
      const mockRes = {
        locals: {
          ogMetaTags: '<meta property="og:title" content="My Video" />',
          ogTitle: 'My Video',
        },
      } as any;

      const result = injectOgTags(sampleHtml, mockRes);
      expect(result).toContain('My Video - Watch this video from Coach Inayah.');
    });
  });

  describe('createOgMetaHandler', () => {
    it('should export createOgMetaHandler as a function', async () => {
      const mod = await import('./og-meta-middleware');
      expect(typeof mod.createOgMetaHandler).toBe('function');
    });

    it('should return an Express middleware function', async () => {
      const { createOgMetaHandler } = await import('./og-meta-middleware');
      const handler = createOgMetaHandler();
      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(3);
    });

    it('should call next() for non-watch paths', async () => {
      const { createOgMetaHandler } = await import('./og-meta-middleware');
      const handler = createOgMetaHandler();

      let nextCalled = false;
      const mockReq = { path: '/dashboard' } as any;
      const mockRes = { locals: {} } as any;
      const mockNext = () => { nextCalled = true; };

      await handler(mockReq, mockRes, mockNext);
      expect(nextCalled).toBe(true);
      expect(mockRes.locals.ogMetaTags).toBeUndefined();
    });

    it('should call next() for /watch/ without a slug', async () => {
      const { createOgMetaHandler } = await import('./og-meta-middleware');
      const handler = createOgMetaHandler();

      let nextCalled = false;
      const mockReq = { path: '/watch/' } as any;
      const mockRes = { locals: {} } as any;
      const mockNext = () => { nextCalled = true; };

      await handler(mockReq, mockRes, mockNext);
      expect(nextCalled).toBe(true);
    });

    it('should call next() even for invalid slugs (graceful fallback)', async () => {
      const { createOgMetaHandler } = await import('./og-meta-middleware');
      const handler = createOgMetaHandler();

      let nextCalled = false;
      const mockReq = { path: '/watch/nonexistent-slug-12345' } as any;
      const mockRes = { locals: {} } as any;
      const mockNext = () => { nextCalled = true; };

      await handler(mockReq, mockRes, mockNext);
      expect(nextCalled).toBe(true);
    });
  });

  describe('HTML escaping in OG tags', () => {
    it('should escape special characters in injected content', async () => {
      const { injectOgTags } = await import('./og-meta-middleware');
      const mockRes = {
        locals: {
          ogMetaTags: '<meta property="og:title" content="Test &amp; &quot;Quotes&quot;" />',
          ogTitle: 'Test & "Quotes"',
        },
      } as any;

      const result = injectOgTags(sampleHtml, mockRes);
      expect(result).toContain('Test &amp; &quot;Quotes&quot;');
      expect(result).not.toContain('<title>Test & "Quotes"');
    });
  });

  describe('OG tag content structure', () => {
    it('should include video.other as og:type for video pages', async () => {
      const { injectOgTags } = await import('./og-meta-middleware');
      const videoOgTags = [
        '<meta property="og:type" content="video.other" />',
        '<meta property="og:title" content="Test" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:creator" content="@CoachInayah" />',
      ].join('\n    ');

      const mockRes = {
        locals: { ogMetaTags: videoOgTags, ogTitle: 'Test' },
      } as any;

      const result = injectOgTags(sampleHtml, mockRes);
      expect(result).toContain('og:type" content="video.other"');
      expect(result).toContain('twitter:card" content="summary_large_image"');
    });
  });
});
