/**
 * Market Advisor Page
 * 
 * Standalone page for comprehensive market analysis.
 * Users can search for any market, city, or zip code and get
 * AI-powered analysis with 5 years of historical data.
 * 
 * DESIGN: Coach Inayah Brand - Premium Property Investment Aesthetic
 * - Gold (#D4A84B) accents on light backgrounds
 * - Near-white backgrounds (oklch(0.99 0 0))
 * - Subtle shadows and refined borders
 */

import { Link } from 'wouter';
import { 
  ArrowLeft,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StandaloneMarketAdvisor } from '@/components/StandaloneMarketAdvisor';

export default function MarketAdvisor() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header - Light theme with gold accent */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Tools
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">Market Advisor</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <StandaloneMarketAdvisor />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by verified market data</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
