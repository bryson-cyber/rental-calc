/**
 * SharedRegulationDisplay — Read-only version of RegulationTrackerStep's result UI.
 * Renders the exact same glass morphism design with status badge, tabs, stats, etc.
 * Used by ShareableReportViewer for 'market' and 'regulation' report types.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  FileText,
  DollarSign,
  Home,
  Calendar,
  MapPin,
  ExternalLink,
  Ban,
  PauseCircle,
  FileCheck,
  Scale,
  Building2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { ReportDisclaimer } from '@/components/ReportDisclaimer';

// Exact same statusConfig from RegulationTrackerStep
const statusConfig: Record<string, {
  gradient: string;
  glow: string;
  bgGlow: string;
  icon: any;
  label: string;
  description: string;
}> = {
  allowed: {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    bgGlow: 'from-emerald-100/50',
    icon: CheckCircle2,
    label: 'Allowed',
    description: 'You can operate here'
  },
  'allowed_with_permit': {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    bgGlow: 'from-emerald-100/50',
    icon: FileCheck,
    label: 'Allowed',
    description: 'Permit required'
  },
  'allowed_with_requirements': {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    bgGlow: 'from-amber-100/50',
    icon: Scale,
    label: 'Allowed',
    description: 'With requirements'
  },
  restricted: {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    bgGlow: 'from-amber-100/50',
    icon: AlertTriangle,
    label: 'Restricted',
    description: 'Some limitations apply'
  },
  limited: {
    gradient: 'from-orange-400 to-red-400',
    glow: 'shadow-orange-500/25',
    bgGlow: 'from-orange-100/50',
    icon: AlertTriangle,
    label: 'Limited',
    description: 'Limited circumstances'
  },
  banned: {
    gradient: 'from-red-400 to-rose-500',
    glow: 'shadow-red-500/25',
    bgGlow: 'from-red-100/50',
    icon: Ban,
    label: 'Not Allowed',
    description: 'Prohibited in this area'
  },
  paused: {
    gradient: 'from-blue-400 to-indigo-500',
    glow: 'shadow-blue-500/25',
    bgGlow: 'from-blue-100/50',
    icon: PauseCircle,
    label: 'Paused',
    description: 'Under review'
  },
  pending: {
    gradient: 'from-yellow-400 to-amber-500',
    glow: 'shadow-yellow-500/25',
    bgGlow: 'from-yellow-100/50',
    icon: Clock,
    label: 'Pending',
    description: 'Being considered'
  },
  unknown: {
    gradient: 'from-gray-400 to-gray-500',
    glow: 'shadow-gray-500/25',
    bgGlow: 'from-gray-100/50',
    icon: HelpCircle,
    label: 'Unknown',
    description: 'Status unclear'
  }
};

interface RegulationData {
  city: string;
  state: string;
  status: string;
  yesNoSummary?: string;
  summary?: string;
  simplifiedSummary?: string;
  keyRequirements?: string[];
  permitRequired?: boolean;
  primaryResidenceOnly?: boolean;
  maxNightsPerYear?: number;
  registrationFee?: string;
  occupancyTax?: string;
  zoningRestrictions?: string;
  sources?: Array<{
    title: string;
    url: string;
    type: 'official' | 'news' | 'third_party';
  }>;
  lastUpdated?: string;
  confidence?: 'high' | 'medium' | 'low';
  warnings?: string[];
  ordinanceNumber?: string;
  governingJurisdiction?: string;
}

interface SharedRegulationDisplayProps {
  data: RegulationData;
}

export function SharedRegulationDisplay({ data }: SharedRegulationDisplayProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'requirements' | 'sources'>('summary');

  const statusCfg = statusConfig[data.status] || statusConfig.restricted;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="relative min-h-[600px]">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-amber-100/30 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-100/30 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
      </div>

      <div className="relative z-10 space-y-8">
        {/* Premium Header */}
        <div className="text-center pt-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl mb-6"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Regulation Tracker
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto font-light">
            Short-term rental regulations for {data.city}, {data.state}
          </p>
        </div>

        {/* Results - Premium Glass Design */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Status Hero Card */}
          <div className={`relative bg-gradient-to-br ${statusCfg.bgGlow} to-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl overflow-hidden`}>
            {/* Decorative gradient orb */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${statusCfg.gradient} opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`}></div>

            <div className="relative p-8 md:p-10">
              {/* Header with Status Badge */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Building2 className="w-4 h-4" />
                    <span>{data.governingJurisdiction || data.city}</span>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                    {data.city}, {data.state}
                  </h3>
                  {data.lastUpdated && (
                    <p className="text-sm text-gray-400 mt-2">
                      Updated {new Date(data.lastUpdated).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Floating Status Badge */}
                <div className={`bg-gradient-to-r ${statusCfg.gradient} p-1 rounded-2xl shadow-lg ${statusCfg.glow}`}>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl px-6 py-4 flex items-center gap-3">
                    <StatusIcon className="w-7 h-7 text-gray-700" />
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{statusCfg.label}</p>
                      <p className="text-sm text-gray-500">{statusCfg.description}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yes/No Summary Banner */}
              <div className="bg-white/80 backdrop-blur rounded-2xl p-6 mb-8 border border-gray-100">
                <p className="text-xl text-gray-700 leading-relaxed font-medium">
                  {data.yesNoSummary || statusCfg.description}
                </p>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-2 mb-6 p-1.5 bg-gray-100/80 rounded-2xl w-fit">
                {(['summary', 'requirements', 'sources'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'summary' && 'Summary'}
                    {tab === 'requirements' && `Requirements (${(data.keyRequirements || []).length})`}
                    {tab === 'sources' && `Sources (${(data.sources || []).length})`}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                <AnimatePresence mode="wait">
                  {activeTab === 'summary' && (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Quick Answer */}
                      {data.simplifiedSummary && (
                        <div className="flex items-start gap-4 mb-8">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Sparkles className="w-7 h-7 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2 text-lg">Quick Answer</h4>
                            <p className="text-lg text-gray-600 leading-relaxed">
                              {data.simplifiedSummary}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                          <div>
                            <p className="text-lg sm:text-xl font-bold text-gray-900">{data.permitRequired ? 'Yes' : 'No'}</p>
                            <p className="text-xs sm:text-sm text-gray-500">Permit Required</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                          <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                          <div>
                            <p className="text-lg sm:text-xl font-bold text-gray-900">{data.primaryResidenceOnly ? 'Yes' : 'No'}</p>
                            <p className="text-xs sm:text-sm text-gray-500">Primary Only</p>
                          </div>
                        </div>

                        {data.registrationFee && (
                          <div
                            className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between cursor-help"
                            title={data.registrationFee}
                          >
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <div className="overflow-hidden">
                              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                {(() => {
                                  const fee = data.registrationFee!;
                                  if (fee.toLowerCase().includes('not specified') || fee.toLowerCase().includes('not available')) {
                                    return 'N/A';
                                  }
                                  const dollarMatch = fee.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/);
                                  if (dollarMatch) {
                                    return dollarMatch[0].replace(/\s+/g, '');
                                  }
                                  return fee.length > 10 ? fee.substring(0, 10) + '…' : fee;
                                })()}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500">Registration</p>
                            </div>
                          </div>
                        )}

                        {data.occupancyTax && (
                          <div
                            className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between cursor-help"
                            title={data.occupancyTax}
                          >
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <div className="overflow-hidden">
                              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                {(() => {
                                  const tax = data.occupancyTax!;
                                  const percentMatch = tax.match(/[\d.]+%/);
                                  if (percentMatch) {
                                    return percentMatch[0];
                                  }
                                  if (tax.toLowerCase().includes('not specified') || tax.toLowerCase().includes('not available')) {
                                    return 'N/A';
                                  }
                                  return tax.length > 10 ? tax.substring(0, 10) + '…' : tax;
                                })()}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500">Tax Rate</p>
                            </div>
                          </div>
                        )}

                        {data.maxNightsPerYear && (
                          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <div>
                              <p className="text-lg sm:text-xl font-bold text-gray-900">{data.maxNightsPerYear}</p>
                              <p className="text-xs sm:text-sm text-gray-500">Max Nights/Year</p>
                            </div>
                          </div>
                        )}

                        {data.confidence && (
                          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm h-[100px] sm:h-[110px] flex flex-col justify-between">
                            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <div>
                              <p className="text-lg sm:text-xl font-bold text-gray-900 capitalize">{data.confidence}</p>
                              <p className="text-xs sm:text-sm text-gray-500">Confidence</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Zoning Info */}
                      {data.zoningRestrictions && (
                        <div className="mt-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 border border-blue-100">
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                              <p className="font-medium text-gray-900 mb-1">Zoning Restrictions</p>
                              <p className="text-gray-600">{data.zoningRestrictions}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Full Details */}
                      {data.summary && (
                        <div className="mt-6 p-5 bg-gray-50 rounded-2xl">
                          <h4 className="font-medium text-gray-900 mb-3">Full Details</h4>
                          <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                            {data.summary}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'requirements' && (
                    <motion.div
                      key="requirements"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {(!Array.isArray(data.keyRequirements) || data.keyRequirements.length === 0) ? (
                        <div className="text-center py-12">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                          <p className="text-lg text-gray-600">No specific requirements found</p>
                          <p className="text-sm text-gray-400 mt-1">This area may have minimal regulations</p>
                        </div>
                      ) : (
                        (Array.isArray(data.keyRequirements) ? data.keyRequirements : []).map((req, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-4 p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors"
                          >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${statusCfg.gradient} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
                              {i + 1}
                            </div>
                            <p className="text-gray-700 pt-2 leading-relaxed">{req}</p>
                          </motion.div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'sources' && (
                    <motion.div
                      key="sources"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {(!data.sources || data.sources.length === 0) ? (
                        <div className="text-center py-12">
                          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                          <p className="text-lg text-gray-600">No official sources found</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Search for "{data.city} short term rental regulations" to find official sources
                          </p>
                        </div>
                      ) : (
                        (Array.isArray(data.sources) ? data.sources : []).map((source, i) => (
                          <motion.a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                source.type === 'official'
                                  ? 'bg-emerald-100'
                                  : source.type === 'news'
                                    ? 'bg-blue-100'
                                    : 'bg-gray-100'
                              }`}>
                                {source.type === 'official' ? (
                                  <Building2 className="w-6 h-6 text-emerald-600" />
                                ) : (
                                  <FileText className="w-6 h-6 text-gray-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 group-hover:text-gray-700">{source.title}</p>
                                <p className={`text-sm capitalize ${
                                  source.type === 'official' ? 'text-emerald-600 font-medium' : 'text-gray-500'
                                }`}>
                                  {source.type === 'official' ? '✓ Official Government Source' : `${source.type} source`}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                          </motion.a>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 mt-8 border-t border-gray-100">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  {data.confidence && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                      data.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                      data.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {data.confidence} confidence
                    </span>
                  )}
                  {data.ordinanceNumber && (
                    <span className="text-gray-400">Ordinance: {data.ordinanceNumber}</span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {Array.isArray(data.warnings) && data.warnings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 bg-amber-50 rounded-2xl p-5 border border-amber-200"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <h4 className="font-medium text-amber-800">Important Warnings</h4>
                  </div>
                  <ul className="space-y-2 ml-8">
                    {(Array.isArray(data.warnings) ? data.warnings : []).map((warning, index) => (
                      <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="text-amber-400 mt-1">•</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      <ReportDisclaimer />
    </div>
  );
}
