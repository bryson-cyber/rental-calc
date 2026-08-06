/**
 * AboutPage — Comprehensive Coach Inayah brand page
 *
 * Primary SEO target: "Coach Inayah" brand searches
 * Secondary targets: "Inayah McMillan", "Coach Inayah reviews", "Coach Inayah Airbnb"
 *
 * This page is designed to outrank negative Reddit/BBB content by providing
 * rich, authoritative, schema-marked content that Google prefers to rank.
 *
 * Includes: Person schema, Organization schema, FAQ schema, Review schema,
 * Article schema, breadcrumbs, media mentions, testimonials, and internal links.
 */

import {
  SEOHead,
  organizationSchema,
  personSchema,
  createWebPageSchema,
  createFAQSchema,
  createBreadcrumbSchema,
} from '@/components/SEOHead';
import {
  ArrowLeft,
  Instagram,
  Youtube,
  Linkedin,
  ExternalLink,
  Star,
  Quote,
  Newspaper,
  Users,
  Home,
  TrendingUp,
  Award,
  MapPin,
  Building,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';

// ── Schema Data ──────────────────────────────────────────────────────────────

const SITE_URL = 'https://coachinayahturnkeytool.com';

const aboutPageSchema = createWebPageSchema({
  name: 'About Coach Inayah — Short-Term Rental Expert & Entrepreneur',
  description:
    'Learn about Coach Inayah (Inayah McMillan), a 23-year-old entrepreneur who built a portfolio of 50+ rental properties and helps professionals start profitable Airbnb businesses through rental arbitrage. Featured in Business Insider, AfroTech, and Daily Mail.',
  url: '/about',
  datePublished: '2024-01-01',
  dateModified: '2026-03-23',
});

const breadcrumbSchema = createBreadcrumbSchema([
  { name: 'Home', url: '/' },
  { name: 'About Coach Inayah', url: '/about' },
]);

const faqs = [
  {
    question: 'Who is Coach Inayah?',
    answer:
      'Coach Inayah (real name Inayah McMillan) is a short-term rental entrepreneur and coach based in Las Vegas, NV. She started hosting on Airbnb in May 2021 at age 19, built a portfolio of 50+ properties, and has generated over $1 million in Airbnb revenue. She now runs Stayly, a coaching platform that helps aspiring investors start profitable short-term rental businesses through rental arbitrage.',
  },
  {
    question: 'What is the Coach Inayah TurnKey program?',
    answer:
      "The TurnKey program is Coach Inayah's hands-on coaching program where her team helps you set up your first short-term rental property. It includes business funding guidance, property selection, listing optimization, and ongoing support. The program is designed for beginners who want expert help getting their first Airbnb unit live and profitable.",
  },
  {
    question: 'Is the Coach Inayah Turnkey Tool free?',
    answer:
      'Yes, the Coach Inayah Turnkey Tool at coachinayahturnkeytool.com is completely free. You can analyze any property in any city, get revenue estimates, compare markets, browse listings, and generate full property reports — all without paying anything or creating an account.',
  },
  {
    question: 'What is rental arbitrage?',
    answer:
      "Rental arbitrage is a business model where you rent a property from a landlord with permission to sublet it, then list it on platforms like Airbnb and VRBO as a short-term rental. You earn the difference between your monthly rent and your short-term rental income. It allows you to start an Airbnb business without buying property. Coach Inayah teaches this model through her courses and TurnKey program.",
  },
  {
    question: 'What are Coach Inayah reviews like?',
    answer:
      'Coach Inayah has a 4.6-star rating on Trustpilot from 71+ verified reviews. Clients frequently mention the responsive support team, practical step-by-step guidance, and real results including securing business funding and launching their first Airbnb properties. The program includes 44 live coaching calls per month covering Airbnb operations, credit building, and tax strategy.',
  },
  {
    question: 'How do I get started with Coach Inayah?',
    answer:
      'You can start for free by using the rental revenue calculator at coachinayahturnkeytool.com to analyze properties in your target market. To learn more about the coaching programs, visit stayly.com or follow @coachinayah on Instagram for free tips and content about short-term rental investing.',
  },
];

const faqSchema = createFAQSchema(faqs);

// Aggregate review schema for the coaching service
const reviewSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Coach Inayah',
  image: `${SITE_URL}/logo.png`,
  url: SITE_URL,
  telephone: '',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Las Vegas',
    addressRegion: 'NV',
    addressCountry: 'US',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.6',
    reviewCount: '71',
    bestRating: '5',
    worstRating: '1',
  },
  sameAs: [
    'https://www.instagram.com/coachinayah/',
    'https://www.tiktok.com/@inayahmcmillan',
    'https://www.youtube.com/@inayahmcmillan',
    'https://stayly.com',
    'https://www.trustpilot.com/review/coachinayah.com',
  ],
};

// ── Media Mentions ───────────────────────────────────────────────────────────

const mediaMentions = [
  {
    outlet: 'Business Insider',
    title: "I'm a 20-Year-Old Airbnb Host Who Made $58,120 in a Single Month",
    url: 'https://www.businessinsider.com/airbnb-host-how-i-set-up-scaled-properties-inayah-mcmillan-2022-12',
    date: 'December 2022',
  },
  {
    outlet: 'Business Insider',
    title: "Gen Z's New Side Hustle: Getting Rich As Airbnb Super Hosts",
    url: 'https://www.businessinsider.com/gen-z-new-side-hustle-getting-rich-airbnb-super-hosts-2024-10',
    date: 'October 2024',
  },
  {
    outlet: 'AfroTech',
    title: '20-Year-Old Inayah McMillan Explains How She Earned Six Figures Through Airbnb',
    url: 'https://afrotech.com/20-year-old-earns-six-figures-per-month-airbnb',
    date: 'May 2023',
  },
  {
    outlet: 'Daily Mail',
    title: 'I Dropped Out of School and Made $3 Million at the Age of 20',
    url: 'https://www.dailymail.co.uk/lifestyle/article-12169299/I-dropped-school-3-million-six-months-20-zero-qualifications.html',
    date: 'June 2023',
  },
];

// ── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
  {
    text: 'The class was so informative and I love how Inayah gave us a few options on how to take action in starting up with Airbnb! There are options such as taking the course or joining the TurnKey program.',
    author: 'Verified Trustpilot Review',
    rating: 5,
  },
  {
    text: 'A comprehensive app and learning database. Was able to secure 21k in business funding with their help.',
    author: 'Verified Trustpilot Review',
    rating: 5,
  },
  {
    text: 'The TurnKey program is so beneficial! It saves you from making lots of mistakes and figuring stuff out because they do your first unit for you!',
    author: 'App Store Review',
    rating: 5,
  },
];

// ── Stats ────────────────────────────────────────────────────────────────────

const stats = [
  { label: 'Rental Properties', value: '50+', icon: Building },
  { label: 'Instagram Followers', value: '247K', icon: Users },
  { label: 'YouTube Subscribers', value: '228K', icon: Youtube },
  { label: 'Trustpilot Rating', value: '4.6★', icon: Star },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="About Coach Inayah"
        description="Coach Inayah (Inayah McMillan) is a short-term rental entrepreneur who built 50+ properties by age 23. Featured in Business Insider, AfroTech, and Daily Mail. Free rental calculator and coaching programs at Stayly."
        canonicalPath="/about"
        keywords={[
          'Coach Inayah',
          'Inayah McMillan',
          'Coach Inayah reviews',
          'Coach Inayah Airbnb',
          'Coach Inayah TurnKey',
          'Stayly',
          'short-term rental coach',
          'rental arbitrage coach',
          'Airbnb coaching program',
        ]}
        structuredData={[
          aboutPageSchema,
          breadcrumbSchema,
          organizationSchema,
          personSchema,
          faqSchema,
          reviewSchema,
        ]}
      />

      {/* Navigation */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Calculator</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#story" className="hover:text-gray-900 transition-colors">
              Story
            </a>
            <a href="#media" className="hover:text-gray-900 transition-colors">
              Press
            </a>
            <a href="#reviews" className="hover:text-gray-900 transition-colors">
              Reviews
            </a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero Section ──────────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-gray-50 to-white py-16 md:py-24">
          <div className="max-w-5xl mx-auto px-4">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-amber-700 uppercase tracking-wider mb-4">
                Short-Term Rental Expert
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 mb-6 leading-tight">
                Coach Inayah
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-8">
                Inayah McMillan started hosting on Airbnb at 19, built a portfolio of 50+
                properties, and now helps everyday people start profitable short-term rental
                businesses — no property ownership required.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Try the Free Calculator
                </Link>
                <a
                  href="https://stayly.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Learn About Coaching
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────────────── */}
        <section className="border-y border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Story Section ─────────────────────────────────────────── */}
        <section id="story" className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-8">The Story</h2>

            <div className="prose prose-lg prose-gray max-w-none">
              <p>
                In May 2021, Inayah McMillan listed her first property on Airbnb. She was 19 years
                old, had no real estate experience, and didn't own any property. She used rental
                arbitrage — renting a property from a landlord and subletting it as a short-term
                rental on Airbnb.
              </p>

              <p>
                Within 18 months, she had scaled to 11 active listings and earned $58,120 in a
                single month. By the end of 2022, she had generated over $300,000 in annual revenue.
                Business Insider, AfroTech, and the Daily Mail all covered her story.
              </p>

              <p>
                Today, Coach Inayah manages a portfolio of over 50 rental properties and runs{' '}
                <a
                  href="https://stayly.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-800 no-underline font-medium"
                >
                  Stayly
                </a>
                , a coaching platform with 44 live calls per month covering Airbnb operations,
                credit building, and tax strategy. Her YouTube channel has 228K subscribers, and her
                Instagram following is 247K.
              </p>

              <p>
                The{' '}
                <Link href="/" className="text-amber-700 hover:text-amber-800 no-underline font-medium">
                  Coach Inayah Turnkey Tool
                </Link>{' '}
                is a free suite of property analysis tools she built to give everyone access to the
                same market data that professional investors use. Search any city, analyze any
                property, and see exactly how much it could earn — all for free, no account required.
              </p>
            </div>

            {/* Timeline */}
            <div className="mt-12 space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">Timeline</h3>
              <div className="space-y-4">
                {[
                  { year: '2021', event: 'Listed first Airbnb property using rental arbitrage' },
                  {
                    year: '2022',
                    event: 'Scaled to 11 listings, earned $58K in a single month, $300K+ annual revenue',
                  },
                  {
                    year: '2022',
                    event: 'Featured in Business Insider as a top Gen Z Airbnb host',
                  },
                  {
                    year: '2023',
                    event: 'Launched Stayly coaching platform and TurnKey program',
                  },
                  {
                    year: '2023',
                    event: 'Featured in AfroTech, Daily Mail, and aNews',
                  },
                  {
                    year: '2024',
                    event: 'Portfolio expanded to 50+ properties, second Business Insider feature',
                  },
                  {
                    year: '2025',
                    event: 'Launched free Coach Inayah Turnkey Tool for property analysis',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-sm font-mono font-medium text-amber-700 w-12 flex-shrink-0 pt-0.5">
                      {item.year}
                    </span>
                    <span className="text-gray-600">{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Media Mentions ────────────────────────────────────────── */}
        <section id="media" className="py-16 md:py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <Newspaper className="w-6 h-6 text-gray-400" />
              <h2 className="text-3xl font-serif font-bold text-gray-900">As Seen In</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {mediaMentions.map((mention, i) => (
                <a
                  key={i}
                  href={mention.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-amber-700 mb-1">{mention.outlet}</p>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-800 transition-colors leading-snug">
                        {mention.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-2">{mention.date}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── What We Offer ─────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
              What Coach Inayah Offers
            </h2>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl">
              Free tools for everyone, plus coaching programs for those ready to take action.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                  <TrendingUp className="w-5 h-5 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Free Rental Revenue Calculator
                </h3>
                <p className="text-gray-600 mb-3">
                  Analyze any property's rental income potential with real market data. Get revenue
                  estimates, occupancy rates, comparable properties, and monthly forecasts.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Try it free <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                  <MapPin className="w-5 h-5 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Explorer</h3>
                <p className="text-gray-600 mb-3">
                  Browse thousands of short-term rental properties in any city. Filter by bedrooms,
                  sort by revenue, and find the best opportunities in your market.
                </p>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Explore properties <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                  <Award className="w-5 h-5 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">TurnKey Program</h3>
                <p className="text-gray-600 mb-3">
                  A hands-on coaching program where the team helps set up your first short-term
                  rental — from business funding and property selection to launch and management.
                </p>
                <a
                  href="https://stayly.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Learn more <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              <div className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Stayly Academy
                </h3>
                <p className="text-gray-600 mb-3">
                  Full Airbnb course, credit course, and tax course. 44 live coaching calls per
                  month. A community of investors learning and growing together.
                </p>
                <a
                  href="https://webapp.stayly.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Join Stayly <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Reviews / Testimonials ────────────────────────────────── */}
        <section id="reviews" className="py-16 md:py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              <h2 className="text-3xl font-serif font-bold text-gray-900">
                What Clients Say
              </h2>
            </div>
            <p className="text-gray-600 mb-10">
              4.6 out of 5 stars on Trustpilot from 71+ verified reviews.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-6 border border-gray-200"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 text-amber-500 fill-amber-500"
                      />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-gray-300 mb-2" />
                  <p className="text-gray-700 leading-relaxed mb-4">{t.text}</p>
                  <p className="text-sm text-gray-500 font-medium">{t.author}</p>
                </div>
              ))}
            </div>

            <a
              href="https://www.trustpilot.com/review/coachinayah.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
            >
              Read all reviews on Trustpilot
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* ── FAQ Section ───────────────────────────────────────────── */}
        <section id="faq" className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-10">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-base font-semibold text-gray-900 pr-4">
                      {faq.question}
                    </h3>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                        expandedFaq === i ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                  {expandedFaq === i && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Connect Section ───────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-8">
              Connect with Coach Inayah
            </h2>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Instagram',
                  handle: '@coachinayah',
                  followers: '247K followers',
                  url: 'https://www.instagram.com/coachinayah/',
                  icon: Instagram,
                },
                {
                  name: 'YouTube',
                  handle: '@inayahmcmillan',
                  followers: '228K subscribers',
                  url: 'https://www.youtube.com/@inayahmcmillan',
                  icon: Youtube,
                },
                {
                  name: 'TikTok',
                  handle: '@inayahmcmillan',
                  followers: '',
                  url: 'https://www.tiktok.com/@inayahmcmillan',
                  icon: ExternalLink,
                },
                {
                  name: 'LinkedIn',
                  handle: 'Inayah McMillan',
                  followers: '',
                  url: 'https://www.linkedin.com/in/inayah-mcmillan/',
                  icon: Linkedin,
                },
                {
                  name: 'Stayly',
                  handle: 'Coaching Platform',
                  followers: '',
                  url: 'https://stayly.com',
                  icon: ExternalLink,
                },
                {
                  name: 'Trustpilot',
                  handle: '4.6★ · 71+ reviews',
                  followers: '',
                  url: 'https://www.trustpilot.com/review/coachinayah.com',
                  icon: Star,
                },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-amber-50 transition-colors">
                    <social.icon className="w-5 h-5 text-gray-500 group-hover:text-amber-700 transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{social.name}</p>
                    <p className="text-sm text-gray-500">
                      {social.handle}
                      {social.followers && ` · ${social.followers}`}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ───────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              See What Your City Could Earn
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Use the free rental revenue calculator to analyze any property in any city. No sign-up
              required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                Try the Calculator
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Explore Properties
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>Coach Inayah Turnkey Tool — Free rental analysis tools for aspiring investors.</p>
            <div className="flex gap-6">
              <Link href="/terms-of-service" className="hover:text-gray-700 transition-colors">
                Terms
              </Link>
              <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="hover:text-gray-700 transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
