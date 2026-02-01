/**
 * Variant B: Card Stack Layout
 * 
 * Apple-inspired stacked cards with clear visual hierarchy.
 * Status shown as a prominent visual indicator with traffic light metaphor.
 * Information progressively revealed through elegant card sections.
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
  ChevronRight
} from 'lucide-react';
import { mockRegulationResult } from '../data/fixtures';

const statusConfig = {
  allowed: {
    color: '#10B981',
    label: 'Allowed',
    sublabel: 'Minimal restrictions',
    icon: CheckCircle2
  },
  allowed_with_requirements: {
    color: '#F59E0B',
    label: 'Allowed',
    sublabel: 'With requirements',
    icon: AlertTriangle
  },
  banned: {
    color: '#EF4444',
    label: 'Not Allowed',
    sublabel: 'Prohibited',
    icon: Ban
  }
};

export function VariantB() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const result = mockRegulationResult;
  const status = statusConfig[result.status as keyof typeof statusConfig] || statusConfig.allowed_with_requirements;
  const StatusIcon = status.icon;

  const cards = [
    {
      id: 'requirements',
      icon: FileText,
      title: 'Requirements',
      subtitle: `${result.keyRequirements.length} items to complete`,
      content: result.keyRequirements
    },
    {
      id: 'fees',
      icon: DollarSign,
      title: 'Fees & Taxes',
      subtitle: `${result.registrationFee} registration`,
      content: [
        `Registration: ${result.registrationFee}`,
        `Occupancy Tax: ${result.occupancyTax}`,
        result.zoningRestrictions ? `Zoning: ${result.zoningRestrictions}` : null
      ].filter(Boolean)
    },
    {
      id: 'sources',
      icon: Building2,
      title: 'Official Sources',
      subtitle: `${result.sources.length} verified sources`,
      content: result.sources
    }
  ];

  return (
    <div className="min-h-[600px] bg-gradient-to-b from-gray-50 to-white p-8">
      {/* Status Header */}
      <div className="text-center mb-12">
        {/* Traffic Light Status */}
        <div className="inline-flex flex-col items-center">
          <div 
            className="w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{ backgroundColor: status.color }}
          >
            <StatusIcon className="w-16 h-16 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {status.label}
          </h1>
          <p className="text-xl text-gray-500">
            {status.sublabel}
          </p>
        </div>
      </div>

      {/* Location Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">Location</p>
          <p className="text-2xl font-semibold text-gray-900">{result.city}, {result.state}</p>
          {result.governingJurisdiction && (
            <p className="text-sm text-gray-500 mt-1">Governed by {result.governingJurisdiction}</p>
          )}
        </div>
        <button className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <Bookmark className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <p className="text-lg text-gray-700 leading-relaxed">
          {result.simplifiedSummary}
        </p>
      </div>

      {/* Expandable Cards */}
      <div className="space-y-3">
        {cards.map((card) => {
          const CardIcon = card.icon;
          const isExpanded = expandedCard === card.id;
          
          return (
            <div 
              key={card.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                className="w-full p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <CardIcon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">{card.title}</p>
                  <p className="text-sm text-gray-500">{card.subtitle}</p>
                </div>
                <ChevronRight 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
              
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                  {card.id === 'sources' ? (
                    <div className="space-y-2">
                      {(card.content as typeof result.sources).map((source, i) => (
                        <a 
                          key={i}
                          href={source.url}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-gray-700">{source.title}</span>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(card.content as string[]).map((item, i) => (
                        <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-400">
          Last updated {new Date(result.lastUpdated).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
