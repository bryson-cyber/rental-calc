/**
 * Design Lab - Premium Regulation Tracker Redesign
 * 
 * 5 design variations for the Regulation Tracker component,
 * inspired by Apple's design language with spacious layouts
 * and focus on the status verdict.
 */

import { useState } from 'react';
import { VariantA } from './variants/VariantA';
import { VariantB } from './variants/VariantB';
import { VariantC } from './variants/VariantC';
import { VariantD } from './variants/VariantD';
import { VariantE } from './variants/VariantE';
import { FeedbackOverlay } from './FeedbackOverlay';

const variants = [
  {
    id: 'A',
    name: 'Hero Status',
    rationale: 'Large status verdict as the hero element with gradient banner. Progressive disclosure through expandable details.',
    Component: VariantA
  },
  {
    id: 'B',
    name: 'Card Stack',
    rationale: 'Traffic light status indicator with stacked expandable cards. Clear visual hierarchy through card organization.',
    Component: VariantB
  },
  {
    id: 'C',
    name: 'Split Panel',
    rationale: 'Verdict prominently on left panel, scrollable details on right. Maximum impact for the yes/no answer.',
    Component: VariantC
  },
  {
    id: 'D',
    name: 'Minimal Typography',
    rationale: 'Ultra-clean with emphasis on large typography and whitespace. Status communicated through subtle color and bold text.',
    Component: VariantD
  },
  {
    id: 'E',
    name: 'Glass Morphism',
    rationale: 'Premium feel with subtle glass effects and depth. Layered cards with backdrop blur and tab navigation.',
    Component: VariantE
  }
];

export default function DesignLabPage() {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Design Lab: Regulation Tracker
          </h1>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Target</p>
              <p className="font-medium text-gray-900">RegulationTrackerStep.tsx</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Inspiration</p>
              <p className="font-medium text-gray-900">Apple - Spacious, Refined</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Focus</p>
              <p className="font-medium text-gray-900">Status Verdict as Hero</p>
            </div>
          </div>
          
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-sm text-amber-800">
              <strong>How to review:</strong> Compare the 5 variants below. Click the "Add Feedback" button (bottom-right) 
              to enter feedback mode, then click on any element to leave a comment. When done, submit your feedback 
              with your overall direction.
            </p>
          </div>
        </div>
      </div>

      {/* Variant Selector */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedVariant(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedVariant === null
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            View All
          </button>
          {variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariant(v.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedVariant === v.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {v.id}: {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* Variants Grid */}
      <div className="max-w-7xl mx-auto">
        {selectedVariant ? (
          // Single variant view
          <div className="space-y-4">
            {variants
              .filter((v) => v.id === selectedVariant)
              .map((variant) => (
                <div key={variant.id} data-variant={variant.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">
                      {variant.id}
                    </span>
                    <div>
                      <h2 className="font-semibold text-gray-900">{variant.name}</h2>
                      <p className="text-sm text-gray-500">{variant.rationale}</p>
                    </div>
                  </div>
                  <variant.Component />
                </div>
              ))}
          </div>
        ) : (
          // Grid view
          <div className="grid lg:grid-cols-2 gap-8">
            {variants.map((variant) => (
              <div key={variant.id} data-variant={variant.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">
                    {variant.id}
                  </span>
                  <div>
                    <h2 className="font-semibold text-gray-900">{variant.name}</h2>
                    <p className="text-sm text-gray-500">{variant.rationale}</p>
                  </div>
                </div>
                <div className="transform scale-[0.85] origin-top-left">
                  <variant.Component />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Overlay */}
      <FeedbackOverlay targetName="RegulationTrackerStep" />
    </div>
  );
}
