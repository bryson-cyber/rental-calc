/**
 * ExplorePage — Public standalone version of Step 2 "Find a Property"
 *
 * This renders the exact same OpportunityFinderStep component used
 * on the home page Research Toolkit (Step 2), with a TOS gate.
 * No extra CTAs, headers, or upsells.
 */

import { useState, Suspense, lazy } from 'react';
import { TermsAcceptanceModal, hasTosBeenAccepted } from '@/components/TermsAcceptanceModal';
import { Loader2 } from 'lucide-react';

const OpportunityFinderStep = lazy(() => import('@/components/OpportunityFinderStep'));

export default function ExplorePage() {
  const [showTos, setShowTos] = useState(!hasTosBeenAccepted());

  // TOS gate
  if (showTos) {
    return (
      <TermsAcceptanceModal
        isOpen={true}
        onAccept={() => setShowTos(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.005_75/0.3)]">
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
