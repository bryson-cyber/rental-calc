/**
 * Variant E: Premium Glass Morphism
 * 
 * Apple-inspired with subtle glass effects and depth.
 * Layered cards with backdrop blur for premium feel.
 * Status shown as an elegant floating badge.
 */

import { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Ban,
  FileText,
  DollarSign,
  Building2,
  ExternalLink,
  Bookmark,
  Shield,
  Sparkles
} from 'lucide-react';
import { mockRegulationResult } from '../data/fixtures';

const statusConfig = {
  allowed: {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    icon: CheckCircle2,
    label: 'Allowed',
    description: 'You can operate here'
  },
  allowed_with_requirements: {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    icon: AlertTriangle,
    label: 'Allowed',
    description: 'With requirements'
  },
  banned: {
    gradient: 'from-red-400 to-rose-500',
    glow: 'shadow-red-500/25',
    icon: Ban,
    label: 'Not Allowed',
    description: 'Prohibited in this area'
  }
};

export function VariantE() {
  const [activeTab, setActiveTab] = useState<'summary' | 'requirements' | 'sources'>('summary');
  const result = mockRegulationResult;
  const status = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.allowed_with_requirements;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-[600px] bg-gradient-to-br from-slate-50 via-white to-slate-100 p-8 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-100/50 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-100/50 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <Building2 className="w-4 h-4" />
              <span>{result.governingJurisdiction || result.city}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              {result.city}, {result.state}
            </h1>
          </div>
          
          {/* Status Badge - Floating */}
          <div className={`bg-gradient-to-r ${status.gradient} p-1 rounded-2xl shadow-lg ${status.glow}`}>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-3">
              <StatusIcon className="w-6 h-6 text-gray-700" />
              <div>
                <p className="font-bold text-gray-900">{status.label}</p>
                <p className="text-xs text-gray-500">{status.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Glass Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl p-8 mb-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100/80 rounded-xl w-fit">
            {(['summary', 'requirements', 'sources'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[250px]">
            {activeTab === 'summary' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Quick Answer</h3>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {result.simplifiedSummary}
                    </p>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100">
                    <DollarSign className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{result.registrationFee}</p>
                    <p className="text-sm text-gray-500">Registration</p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100">
                    <DollarSign className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{result.occupancyTax}</p>
                    <p className="text-sm text-gray-500">Tax Rate</p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100">
                    <Shield className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-2xl font-bold text-gray-900 capitalize">{result.confidence}</p>
                    <p className="text-sm text-gray-500">Confidence</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'requirements' && (
              <div className="animate-in fade-in duration-300 space-y-3">
                {result.keyRequirements.map((req, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-xl border border-gray-100/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 pt-1">{req}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'sources' && (
              <div className="animate-in fade-in duration-300 space-y-3">
                {result.sources.map((source, i) => (
                  <a 
                    key={i}
                    href={source.url}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-xl border border-gray-100/50 hover:border-gray-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{source.title}</p>
                        <p className="text-sm text-gray-500 capitalize">{source.type} source</p>
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Updated {new Date(result.lastUpdated).toLocaleDateString()}
          </p>
          <button className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg">
            <Bookmark className="w-5 h-5" />
            Save Regulation
          </button>
        </div>
      </div>
    </div>
  );
}
