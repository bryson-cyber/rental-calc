/**
 * Variant A: Hero Status Focus
 * 
 * Apple-inspired design with the status verdict as the hero element.
 * Large, bold typography with generous whitespace.
 * Status takes center stage with a full-width gradient banner.
 */

import { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Ban,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bookmark,
  Shield
} from 'lucide-react';
import { mockRegulationResult } from '../data/fixtures';

const statusStyles = {
  allowed: {
    gradient: 'from-emerald-50 via-emerald-100/50 to-transparent',
    iconBg: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    icon: CheckCircle2,
    verdict: 'You Can Operate Here'
  },
  allowed_with_requirements: {
    gradient: 'from-amber-50 via-amber-100/50 to-transparent',
    iconBg: 'bg-amber-500',
    textColor: 'text-amber-700',
    icon: AlertTriangle,
    verdict: 'Allowed with Requirements'
  },
  banned: {
    gradient: 'from-red-50 via-red-100/50 to-transparent',
    iconBg: 'bg-red-500',
    textColor: 'text-red-700',
    icon: Ban,
    verdict: 'Not Permitted'
  }
};

export function VariantA() {
  const [showDetails, setShowDetails] = useState(false);
  const result = mockRegulationResult;
  const status = statusStyles[result.status as keyof typeof statusStyles] || statusStyles.allowed_with_requirements;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-[600px] bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
      {/* Hero Status Banner */}
      <div className={`bg-gradient-to-b ${status.gradient} px-8 pt-16 pb-20 text-center relative`}>
        {/* Floating Icon */}
        <div className={`${status.iconBg} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg`}>
          <StatusIcon className="w-10 h-10 text-white" />
        </div>
        
        {/* Large Verdict */}
        <h1 className={`text-4xl md:text-5xl font-semibold tracking-tight ${status.textColor} mb-4`}>
          {status.verdict}
        </h1>
        
        {/* Location */}
        <p className="text-2xl text-gray-600 font-light">
          {result.city}, {result.state}
        </p>
        
        {/* Confidence Badge */}
        <div className="absolute top-6 right-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur text-xs font-medium text-gray-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            High Confidence
          </span>
        </div>
      </div>

      {/* Summary Card - Overlapping */}
      <div className="px-8 -mt-10 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <p className="text-xl text-gray-700 leading-relaxed text-center">
            {result.simplifiedSummary}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-8 py-8 flex justify-center gap-4">
        <button className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors">
          <Bookmark className="w-5 h-5" />
          Save Regulation
        </button>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-full font-medium hover:bg-gray-200 transition-colors"
        >
          {showDetails ? 'Hide' : 'View'} Details
          {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expandable Details */}
      {showDetails && (
        <div className="px-8 pb-8 space-y-6 animate-in slide-in-from-top-4 duration-300">
          {/* Requirements */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Requirements</h3>
            <ul className="space-y-3">
              {result.keyRequirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Facts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Registration Fee</p>
              <p className="text-2xl font-semibold text-gray-900">{result.registrationFee}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Occupancy Tax</p>
              <p className="text-2xl font-semibold text-gray-900">{result.occupancyTax}</p>
            </div>
          </div>

          {/* Sources */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3">Official Sources</p>
            <div className="flex flex-wrap gap-2">
              {result.sources.map((source, i) => (
                <a 
                  key={i}
                  href={source.url}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {source.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
