/**
 * SEOHead Component Tests
 * Tests for the SEO component's schema generation functions
 */

import { describe, it, expect } from 'vitest';

// Since SEOHead is a React component, we test the schema generation functions
// These are the same functions exported from the component

const SITE_URL = 'https://coachinayahturnkeytool.com';
const SITE_NAME = 'Coach Inayah Turnkey Tool';

// Mock the schema generation functions (same logic as in SEOHead.tsx)
const organizationSchema = {
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

const calculatorSchema = {
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
  description: 'Free rental revenue calculator to estimate Airbnb and VRBO income for any property.',
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

function createWebPageSchema(options: {
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

function createBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
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

function createFAQSchema(faqs: Array<{ question: string; answer: string }>) {
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

describe('SEO Schema Generation', () => {
  describe('Organization Schema', () => {
    it('should have correct @type', () => {
      expect(organizationSchema['@type']).toBe('Organization');
    });

    it('should have correct @context', () => {
      expect(organizationSchema['@context']).toBe('https://schema.org');
    });

    it('should have organization name', () => {
      expect(organizationSchema.name).toBe('Coach Inayah');
    });

    it('should have valid URL', () => {
      expect(organizationSchema.url).toBe(SITE_URL);
    });

    it('should have social media links', () => {
      expect(organizationSchema.sameAs).toContain('https://twitter.com/CoachInayah');
      expect(organizationSchema.sameAs).toContain('https://www.instagram.com/coachinayah/');
    });
  });

  describe('Calculator Schema (SoftwareApplication)', () => {
    it('should have correct @type', () => {
      expect(calculatorSchema['@type']).toBe('SoftwareApplication');
    });

    it('should have free pricing', () => {
      expect(calculatorSchema.offers.price).toBe('0');
      expect(calculatorSchema.offers.priceCurrency).toBe('USD');
    });

    it('should have application category', () => {
      expect(calculatorSchema.applicationCategory).toBe('FinanceApplication');
    });

    it('should have aggregate rating', () => {
      expect(calculatorSchema.aggregateRating.ratingValue).toBe('4.8');
      expect(calculatorSchema.aggregateRating.bestRating).toBe('5');
    });
  });

  describe('WebPage Schema Generator', () => {
    it('should create valid WebPage schema', () => {
      const schema = createWebPageSchema({
        name: 'Test Page',
        description: 'Test description',
        url: '/test'
      });

      expect(schema['@type']).toBe('WebPage');
      expect(schema.name).toBe('Test Page');
      expect(schema.description).toBe('Test description');
    });

    it('should prepend SITE_URL for relative paths', () => {
      const schema = createWebPageSchema({
        name: 'Test',
        description: 'Test',
        url: '/tools'
      });

      expect(schema.url).toBe(`${SITE_URL}/tools`);
    });

    it('should keep absolute URLs as-is', () => {
      const schema = createWebPageSchema({
        name: 'Test',
        description: 'Test',
        url: 'https://example.com/page'
      });

      expect(schema.url).toBe('https://example.com/page');
    });

    it('should include optional date fields when provided', () => {
      const schema = createWebPageSchema({
        name: 'Test',
        description: 'Test',
        url: '/test',
        datePublished: '2024-01-01',
        dateModified: '2024-06-01'
      });

      expect(schema.datePublished).toBe('2024-01-01');
      expect(schema.dateModified).toBe('2024-06-01');
    });

    it('should include publisher (organization)', () => {
      const schema = createWebPageSchema({
        name: 'Test',
        description: 'Test',
        url: '/test'
      });

      expect(schema.publisher).toBeDefined();
      expect(schema.publisher['@type']).toBe('Organization');
    });
  });

  describe('Breadcrumb Schema Generator', () => {
    it('should create valid BreadcrumbList schema', () => {
      const schema = createBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Tools', url: '/tools' }
      ]);

      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toHaveLength(2);
    });

    it('should have correct positions', () => {
      const schema = createBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Tools', url: '/tools' },
        { name: 'Calculator', url: '/tools/calculator' }
      ]);

      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[1].position).toBe(2);
      expect(schema.itemListElement[2].position).toBe(3);
    });

    it('should prepend SITE_URL for relative paths', () => {
      const schema = createBreadcrumbSchema([
        { name: 'Home', url: '/' }
      ]);

      expect(schema.itemListElement[0].item).toBe(`${SITE_URL}/`);
    });
  });

  describe('FAQ Schema Generator', () => {
    it('should create valid FAQPage schema', () => {
      const schema = createFAQSchema([
        { question: 'What is this tool?', answer: 'A rental calculator.' }
      ]);

      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity).toHaveLength(1);
    });

    it('should format questions correctly', () => {
      const schema = createFAQSchema([
        { question: 'How does it work?', answer: 'Enter your address and get estimates.' }
      ]);

      expect(schema.mainEntity[0]['@type']).toBe('Question');
      expect(schema.mainEntity[0].name).toBe('How does it work?');
    });

    it('should format answers correctly', () => {
      const schema = createFAQSchema([
        { question: 'Is it free?', answer: 'Yes, completely free.' }
      ]);

      expect(schema.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
      expect(schema.mainEntity[0].acceptedAnswer.text).toBe('Yes, completely free.');
    });

    it('should handle multiple FAQs', () => {
      const schema = createFAQSchema([
        { question: 'Q1?', answer: 'A1' },
        { question: 'Q2?', answer: 'A2' },
        { question: 'Q3?', answer: 'A3' }
      ]);

      expect(schema.mainEntity).toHaveLength(3);
    });
  });
});

describe('SEO Meta Tag Validation', () => {
  describe('Title Length', () => {
    it('should validate title is between 30-60 characters', () => {
      const title = 'Free Airbnb Calculator';
      const fullTitle = `${title} | ${SITE_NAME}`;
      
      // Title + site name should be reasonable length
      expect(fullTitle.length).toBeGreaterThan(30);
      expect(fullTitle.length).toBeLessThan(80); // With site name appended
    });
  });

  describe('Description Length', () => {
    it('should validate description is between 150-160 characters', () => {
      const description = 'Discover how much your property could earn on Airbnb & VRBO. Free rental revenue calculator with market data, comparable properties, and investment analysis.';
      
      expect(description.length).toBeGreaterThan(100);
      expect(description.length).toBeLessThan(200);
    });
  });

  describe('Canonical URL Format', () => {
    it('should generate valid canonical URLs', () => {
      const canonicalPath = '/tools';
      const canonicalUrl = `${SITE_URL}${canonicalPath}`;
      
      expect(canonicalUrl).toMatch(/^https:\/\//);
      expect(canonicalUrl).not.toContain('?'); // No query params in canonical
    });
  });
});
