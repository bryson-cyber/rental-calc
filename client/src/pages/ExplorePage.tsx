/**
 * ExplorePage — Public standalone version of Step 2 "Find a Property"
 *
 * This renders the exact same OpportunityFinderStep component used
 * on the home page Research Toolkit (Step 2), with a TOS gate.
 * No extra CTAs, headers, or upsells.
 */

import { useState, Suspense, lazy } from 'react';
import { TermsAcceptanceModal, useTosGate } from '@/components/TermsAcceptanceModal';
import { SEOHead, organizationSchema, createWebPageSchema } from '@/components/SEOHead';
import { Loader2 } from 'lucide-react';

const OpportunityFinderStep = lazy(() => import('@/components/OpportunityFinderStep'));

const explorePageSchema = createWebPageSchema({
  name: 'Explore Rental Properties | Coach Inayah',
  description: 'Search any city and browse real short-term rental properties. See revenue estimates, occupancy rates, and nightly rates for Airbnb and VRBO listings.',
  url: '/explore',
});

export default function ExplorePage() {
  // Server-aware gate: never re-asks a user whose acceptance is on record,
  // and never flashes while the check is in flight.
  const tos = useTosGate();

  // TOS gate
  if (tos.ready && !tos.accepted) {
    return (
      <>
        <SEOHead
          title="Explore Rental Properties"
          description="Search any city and browse real short-term rental properties. See revenue estimates, occupancy rates, and nightly rates for Airbnb and VRBO listings. Free tool by Coach Inayah."
          canonicalPath="/explore"
          keywords={['rental property search', 'Airbnb revenue estimator', 'short-term rental analysis', 'Coach Inayah', 'rental arbitrage tool', 'VRBO calculator']}
          structuredData={[explorePageSchema, organizationSchema]}
        />
        <TermsAcceptanceModal
          isOpen={true}
          onAccept={tos.accept}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.005_75/0.3)]">
      <SEOHead
        title="Explore Rental Properties"
        description="Search any city and browse real short-term rental properties. See revenue estimates, occupancy rates, and nightly rates for Airbnb and VRBO listings. Free tool by Coach Inayah."
        canonicalPath="/explore"
        keywords={['rental property search', 'Airbnb revenue estimator', 'short-term rental analysis', 'Coach Inayah', 'rental arbitrage tool', 'VRBO calculator']}
        structuredData={[explorePageSchema, organizationSchema]}
      />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)]" />
            </div>
          }
        >
          <OpportunityFinderStep isAdmin={false} />
        </Suspense>
      </div>
    </div>
  );
}
