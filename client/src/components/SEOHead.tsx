/**
 * SEOHead Component
 * 
 * Manages page-level SEO elements including:
 * - Document title
 * - Meta description
 * - Canonical URL
 * - Open Graph tags
 * - Twitter Card tags
 * - JSON-LD structured data
 */

import { useEffect } from 'react';

// Base URL for the site
const SITE_URL = 'https://coachinayahturnkeytool.com';
const SITE_NAME = 'Coach Inayah Turnkey Tool';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SEOHeadProps {
  /** Page title (will be appended with site name) */
  title: string;
  /** Meta description (recommended 150-160 characters) */
  description: string;
  /** Canonical URL path (e.g., '/tools' or '/share/abc123') */
  canonicalPath?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Page type for Open Graph */
  ogType?: 'website' | 'article' | 'product';
  /** JSON-LD structured data object(s) */
  structuredData?: object | object[];
  /** Whether to append site name to title */
  appendSiteName?: boolean;
  /** Keywords for meta keywords tag */
  keywords?: string[];
  /** Author name */
  author?: string;
  /** Prevent indexing (for private pages) */
  noIndex?: boolean;
}

/**
 * SEOHead - Sets document head elements for SEO
 * 
 * Usage:
 * ```tsx
 * <SEOHead
 *   title="Free Airbnb Calculator"
 *   description="Discover how much your property could earn on Airbnb & VRBO."
 *   canonicalPath="/"
 *   structuredData={calculatorSchema}
 * />
 * ```
 */
export function SEOHead({
  title,
  description,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  structuredData,
  appendSiteName = true,
  keywords,
  author = 'Coach Inayah',
  noIndex = false,
}: SEOHeadProps) {
  
  useEffect(() => {
    // Set document title
    const fullTitle = appendSiteName ? `${title} | ${SITE_NAME}` : title;
    document.title = fullTitle;
    
    // Helper to set or update meta tag
    const setMetaTag = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };
    
    // Helper to set or update link tag
    const setLinkTag = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };
    
    // Set meta description
    setMetaTag('description', description);
    
    // Set keywords if provided
    if (keywords && keywords.length > 0) {
      setMetaTag('keywords', keywords.join(', '));
    }
    
    // Set author
    setMetaTag('author', author);
    
    // Set robots meta if noIndex
    if (noIndex) {
      setMetaTag('robots', 'noindex, nofollow');
    } else {
      setMetaTag('robots', 'index, follow');
    }
    
    // Set canonical URL
    if (canonicalPath) {
      const canonicalUrl = canonicalPath.startsWith('http') 
        ? canonicalPath 
        : `${SITE_URL}${canonicalPath}`;
      setLinkTag('canonical', canonicalUrl);
    }
    
    // Set Open Graph tags
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', ogType, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:site_name', SITE_NAME, true);
    if (canonicalPath) {
      const canonicalUrl = canonicalPath.startsWith('http') 
        ? canonicalPath 
        : `${SITE_URL}${canonicalPath}`;
      setMetaTag('og:url', canonicalUrl, true);
    }
    
    // Set Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);
    
    // Set JSON-LD structured data
    if (structuredData) {
      // Remove existing JSON-LD scripts added by this component
      document.querySelectorAll('script[data-seo-head="true"]').forEach(el => el.remove());
      
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];
      dataArray.forEach((data, index) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-head', 'true');
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      });
    }
    
    // Cleanup function
    return () => {
      // Remove JSON-LD scripts on unmount
      document.querySelectorAll('script[data-seo-head="true"]').forEach(el => el.remove());
    };
  }, [title, description, canonicalPath, ogImage, ogType, structuredData, appendSiteName, keywords, author, noIndex]);
  
  // This component doesn't render anything visible
  return null;
}

// Pre-defined structured data schemas

/**
 * Organization schema for Coach Inayah
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Coach Inayah',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: 'Helping investors make informed rental property decisions with data-driven tools and expert guidance.',
  sameAs: [
    'https://twitter.com/CoachInayah',
    'https://www.instagram.com/coachinayah/',
    'https://www.youtube.com/@CoachInayah'
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    url: `${SITE_URL}/contact`
  }
};

/**
 * SoftwareApplication schema for the rental calculator
 */
export const calculatorSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Free Airbnb Calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  description: 'Free rental revenue calculator to estimate Airbnb and VRBO income for any property. Analyze markets, compare properties, and make informed investment decisions.',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '57',
    bestRating: '5'
  },
  author: {
    '@type': 'Organization',
    name: 'Coach Inayah'
  }
};

/**
 * WebPage schema generator
 */
export function createWebPageSchema(options: {
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: options.name,
    description: options.description,
    url: options.url.startsWith('http') ? options.url : `${SITE_URL}${options.url}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL
    },
    publisher: organizationSchema,
    ...(options.datePublished && { datePublished: options.datePublished }),
    ...(options.dateModified && { dateModified: options.dateModified })
  };
}

/**
 * BreadcrumbList schema generator
 */
export function createBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`
    }))
  };
}

/**
 * FAQPage schema generator
 */
export function createFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

export default SEOHead;
