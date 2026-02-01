/**
 * Variant C: Split Panel Layout
 * 
 * Apple-inspired split view with verdict prominently on left,
 * scrollable details on right. Premium feel with subtle gradients.
 */

import { 
  CheckCircle2, 
  AlertTriangle, 
  Ban,
  FileCheck,
  DollarSign,
  MapPin,
  ExternalLink,
  Bookmark,
  Shield,
  Clock
} from 'lucide-react';
import { mockRegulationResult } from '../data/fixtures';

const statusConfig = {
  allowed: {
    gradient: 'from-emerald-500 to-emerald-600',
    lightBg: 'bg-emerald-50',
    icon: CheckCircle2,
    verdict: 'Yes',
    sublabel: 'You can operate'
  },
  allowed_with_requirements: {
    gradient: 'from-amber-500 to-amber-600',
    lightBg: 'bg-amber-50',
    icon: AlertTriangle,
    verdict: 'Yes',
    sublabel: 'With requirements'
  },
  banned: {
    gradient: 'from-red-500 to-red-600',
    lightBg: 'bg-red-50',
    icon: Ban,
    verdict: 'No',
    sublabel: 'Not permitted'
  }
};

export function VariantC() {
  const result = mockRegulationResult;
  const status = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.allowed_with_requirements;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-[600px] bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex">
      {/* Left Panel - Verdict */}
      <div className={`w-2/5 bg-gradient-to-br ${status.gradient} p-8 flex flex-col justify-between text-white`}>
        <div>
          {/* Location */}
          <div className="flex items-center gap-2 text-white/80 mb-8">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{result.city}, {result.state}</span>
          </div>
          
          {/* Main Verdict */}
          <div className="mb-8">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-2">Can I operate here?</p>
            <h1 className="text-7xl font-bold mb-2">{status.verdict}</h1>
            <p className="text-xl text-white/80">{status.sublabel}</p>
          </div>
          
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <StatusIcon className="w-8 h-8" />
          </div>
        </div>
        
        {/* Bottom Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Shield className="w-4 h-4" />
            <span>High confidence rating</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Clock className="w-4 h-4" />
            <span>Updated {new Date(result.lastUpdated).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="w-3/5 p-8 overflow-y-auto max-h-[600px]">
        {/* Summary */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Summary</h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            {result.simplifiedSummary}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`${status.lightBg} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Registration</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.registrationFee}</p>
          </div>
          <div className={`${status.lightBg} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Tax Rate</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.occupancyTax}</p>
          </div>
        </div>

        {/* Requirements */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Requirements</h2>
          <div className="space-y-3">
            {result.keyRequirements.map((req, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-gray-700 pt-1">{req}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sources */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Official Sources</h2>
          <div className="space-y-2">
            {result.sources.map((source, i) => (
              <a 
                key={i}
                href={source.url}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-gray-700">{source.title}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
            <Bookmark className="w-5 h-5" />
            Save Regulation
          </button>
        </div>
      </div>
    </div>
  );
}
