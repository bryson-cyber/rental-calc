/**
 * AboutPage — Public page optimized for "Coach Inayah" brand SEO
 *
 * This page exists primarily to rank for brand name searches and
 * help Google build a Knowledge Panel. It includes Person schema,
 * Organization schema, and brand-optimized content.
 */

import { SEOHead, organizationSchema, personSchema, createWebPageSchema } from '@/components/SEOHead';
import { ArrowLeft, Instagram, Youtube, Linkedin, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

const aboutPageSchema = createWebPageSchema({
  name: 'About Coach Inayah | Short-Term Rental Expert',
  description: 'Learn about Coach Inayah (Inayah McMillan), a short-term rental coach helping aspiring investors build profitable Airbnb and VRBO businesses through data-driven tools and expert guidance.',
  url: '/about',
});

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="About Coach Inayah"
        description="Coach Inayah (Inayah McMillan) helps aspiring investors build profitable short-term rental businesses. Free rental revenue calculator, market analysis tools, and the TurnKey coaching program."
        canonicalPath="/about"
        keywords={['Coach Inayah', 'Inayah McMillan', 'short-term rental coach', 'Airbnb coach', 'rental arbitrage expert', 'TurnKey program', 'Stayly']}
        structuredData={[aboutPageSchema, organizationSchema, personSchema]}
      />

      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Calculator</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">

        {/* Hero Section */}
        <section className="mb-16">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-6">
            About Coach Inayah
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-3xl">
            Coach Inayah (Inayah McMillan) helps aspiring investors build profitable short-term rental businesses. Through free data-driven tools, expert coaching, and the TurnKey program, she has guided hundreds of people toward financial freedom through real estate.
          </p>
        </section>

        {/* Mission Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-4">
            The Mission
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-4">
            Most people think you need a lot of money or perfect credit to get started in real estate. Coach Inayah built her business to prove that wrong. Through rental arbitrage and smart funding strategies, she shows everyday people how to start earning rental income without buying property.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed">
            The Coach Inayah Turnkey Tool is a free suite of property analysis tools that gives everyone access to the same market data that professional investors use. Search any city, analyze any property, and see exactly how much it could earn as a short-term rental — all for free.
          </p>
        </section>

        {/* What We Offer Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-6">
            What We Offer
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Free Rental Calculator</h3>
              <p className="text-gray-600">
                Analyze any property's rental income potential with real market data. Get revenue estimates, occupancy rates, comparable properties, and monthly forecasts.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Explorer</h3>
              <p className="text-gray-600">
                Browse thousands of short-term rental properties in any city. Filter by bedrooms, sort by revenue, and find the best opportunities in your market.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Property Comparison</h3>
              <p className="text-gray-600">
                Compare up to 25 properties side by side. See revenue, occupancy, and profitability metrics to make informed investment decisions.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">TurnKey Program</h3>
              <p className="text-gray-600">
                A comprehensive coaching program that walks you through every step — from business funding and property selection to launch and management.
              </p>
            </div>
          </div>
        </section>

        {/* Connect Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-6">
            Connect with Coach Inayah
          </h2>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://www.instagram.com/coachinayah/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <Instagram className="w-5 h-5" />
              <span className="font-medium">Instagram</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            <a
              href="https://www.youtube.com/@CoachInayah"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <Youtube className="w-5 h-5" />
              <span className="font-medium">YouTube</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            <a
              href="https://www.linkedin.com/in/inayah-mcmillan/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <Linkedin className="w-5 h-5" />
              <span className="font-medium">LinkedIn</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            <a
              href="https://www.tiktok.com/@coachinayah"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="font-medium">TikTok</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            <a
              href="https://stayly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="font-medium">Stayly</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </section>

        {/* Reviews Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-4">
            Reviews
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-4">
            Coach Inayah has a 4.6-star rating on Trustpilot from 71+ verified reviews. Clients consistently highlight the responsive support, practical guidance, and real results they achieve through the program.
          </p>
          <a
            href="https://www.trustpilot.com/review/coachinayah.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
          >
            Read reviews on Trustpilot
            <ExternalLink className="w-4 h-4" />
          </a>
        </section>

        {/* CTA Section */}
        <section className="bg-gray-900 text-white rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
            Ready to See What Your City Could Earn?
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Use the free rental revenue calculator to analyze any property in any city. No sign-up required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Try the Calculator
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Explore Properties
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          <p>Coach Inayah Turnkey Tool &mdash; Free rental analysis tools for aspiring investors.</p>
        </div>
      </footer>
    </div>
  );
}
