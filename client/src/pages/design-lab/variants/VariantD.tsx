/**
 * Variant D: Minimal Typography Focus
 * 
 * Ultra-clean Apple-style design with emphasis on typography.
 * Maximum whitespace, minimal UI chrome.
 * Status communicated through subtle color and large text.
 */

import { 
  CheckCircle2, 
  AlertTriangle, 
  Ban,
  ArrowRight,
  Bookmark
} from 'lucide-react';
import { mockRegulationResult } from '../data/fixtures';

const statusConfig = {
  allowed: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-600',
    icon: CheckCircle2,
    headline: 'Good to go.',
    subline: 'Short-term rentals are welcome here.'
  },
  allowed_with_requirements: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-600',
    icon: AlertTriangle,
    headline: 'Yes, with steps.',
    subline: 'A few requirements to complete first.'
  },
  banned: {
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    icon: Ban,
    headline: 'Not here.',
    subline: 'Short-term rentals are not permitted.'
  }
};

export function VariantD() {
  const result = mockRegulationResult;
  const status = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.allowed_with_requirements;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-[600px] bg-white p-12 flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-16">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.bgColor}`}></div>
          <span className="text-sm text-gray-500 font-medium">
            {result.city}, {result.state}
          </span>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bookmark className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Hero Typography */}
      <div className="flex-1 flex flex-col justify-center max-w-xl">
        {/* Large Headline */}
        <h1 className={`text-6xl md:text-7xl font-bold tracking-tight ${status.color} mb-6`}>
          {status.headline}
        </h1>
        
        {/* Subline */}
        <p className="text-2xl text-gray-500 font-light mb-12">
          {status.subline}
        </p>

        {/* Simple Summary */}
        <p className="text-lg text-gray-600 leading-relaxed mb-12 border-l-4 border-gray-200 pl-6">
          {result.simplifiedSummary}
        </p>

        {/* Key Numbers */}
        <div className="flex gap-12 mb-12">
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">License Fee</p>
            <p className="text-3xl font-semibold text-gray-900">{result.registrationFee}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Tax Rate</p>
            <p className="text-3xl font-semibold text-gray-900">{result.occupancyTax}</p>
          </div>
        </div>

        {/* Requirements Preview */}
        <div className="mb-12">
          <p className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            {result.keyRequirements.length} Requirements
          </p>
          <div className="space-y-3">
            {result.keyRequirements.slice(0, 3).map((req, i) => (
              <p key={i} className="text-gray-600 flex items-start gap-3">
                <span className="text-gray-300 font-mono">{String(i + 1).padStart(2, '0')}</span>
                {req}
              </p>
            ))}
            {result.keyRequirements.length > 3 && (
              <button className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mt-2 transition-colors">
                <span>+{result.keyRequirements.length - 3} more</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="flex items-center justify-between pt-8 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <StatusIcon className={`w-5 h-5 ${status.color}`} />
          <span className="text-sm text-gray-400">
            High confidence · Updated {new Date(result.lastUpdated).toLocaleDateString()}
          </span>
        </div>
        <div className="flex gap-2">
          {result.sources.slice(0, 2).map((source, i) => (
            <a 
              key={i}
              href={source.url}
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              {source.title.split(' ').slice(0, 3).join(' ')}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
