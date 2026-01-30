/**
 * Opportunity Finder Page
 * 
 * Standalone page for browsing Zillow rental listings and validating them
 * for STR arbitrage potential.
 * 
 * Design: Coach Inayah brand system (gold accents, light theme)
 */

import { useState, useEffect } from 'react';
import { Link, useSearch } from 'wouter';
import { ArrowLeft, Search, Home, Sparkles } from 'lucide-react';
import OpportunityFinderStep from '@/components/OpportunityFinderStep';
import { SharePageButton } from '@/components/SharePageButton';

export default function OpportunityFinder() {
  const [currentLocation, setCurrentLocation] = useState<{ city?: string; state?: string } | null>(null);
  
  // Parse URL parameters for sharing
  const searchString = useSearch();
  const [initialLocation, setInitialLocation] = useState<string | undefined>();
  
  useEffect(() => {
    const params = new URLSearchParams(searchString || window.location.search);
    const city = params.get('city');
    const state = params.get('state');
    if (city && state) {
      setInitialLocation(`${city}, ${state}`);
    } else if (city) {
      setInitialLocation(city);
    }
  }, [searchString]);
  
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-[#1A1A1A]/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Calculator</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#D4A84B]/20 rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-[#D4A84B]" />
              </div>
              <h1 className="text-lg font-serif font-semibold text-[#1A1A1A]">
                Opportunity Finder
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <SharePageButton
                pagePath="/opportunity-finder"
                params={{
                  city: currentLocation?.city,
                  state: currentLocation?.state,
                }}
                shareDescription={currentLocation?.city ? `rental opportunities in ${currentLocation.city}, ${currentLocation.state}` : 'Opportunity Finder'}
                variant="outline"
                size="sm"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2d2d2d] text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#D4A84B]/20 text-[#D4A84B] px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Powered by Zillow + AirDNA Data
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Find Your Next <span className="text-[#D4A84B]">Rental Opportunity</span>
            </h2>
            <p className="text-white/70 text-lg">
              Browse available rentals in any market and instantly validate their STR potential. 
              No more switching between websites - everything you need in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <OpportunityFinderStep
            onSelectProperty={(property) => {
              // Navigate to analyze the selected property
              window.location.href = `/?address=${encodeURIComponent(property.address)}&bedrooms=${property.bedrooms}&bathrooms=${property.bathrooms}&rent=${property.monthlyRent}`;
            }}
            onLocationChange={(location) => setCurrentLocation(location)}
            initialLocation={initialLocation}
          />
        </div>
      </main>

      {/* Footer CTA */}
      <div className="bg-white border-t border-[#1A1A1A]/10 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl font-serif font-semibold text-[#1A1A1A] mb-2">
              Found a Property You Like?
            </h3>
            <p className="text-[#1A1A1A]/70 mb-4">
              Click "Validate" on any listing to run a full STR analysis and see the profit potential.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#D4A84B] hover:text-[#c49a3d] font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Or enter a specific address to analyze
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
