/**
 * Market Advisor Page
 * 
 * Standalone page for comprehensive market analysis.
 * Users can search for any market, city, or zip code and get
 * AI-powered analysis with 5 years of historical data.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { 
  ArrowLeft,
  TrendingUp,
  Sparkles,
  MapPin,
  BarChart3,
  Clock,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StandaloneMarketAdvisor } from '@/components/StandaloneMarketAdvisor';

export default function MarketAdvisor() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Tools
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-white">Market Advisor</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 border-b border-slate-700/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">AI-Powered Market Intelligence</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Comprehensive Market Analysis
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Get detailed insights on any short-term rental market. Analyze 5 years of historical data, 
              revenue trends, seasonality patterns, and competitive landscape.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-8 border-b border-slate-700/30 bg-slate-800/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-white">5-Year History</div>
                <div className="text-xs text-slate-400">Historical trends</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-sm font-medium text-white">Market Scores</div>
                <div className="text-xs text-slate-400">6 key metrics</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Building2 className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-sm font-medium text-white">Top Performers</div>
                <div className="text-xs text-slate-400">Best listings</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <MapPin className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-sm font-medium text-white">Submarkets</div>
                <div className="text-xs text-slate-400">Neighborhood data</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <StandaloneMarketAdvisor />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-700/30">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-slate-500">
            <p>Data powered by AirDNA • Analysis by Gemini AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
