import React, { useState } from 'react';
import { Bookmark, X, ExternalLink, Trash2, DollarSign, Percent, Bed, Bath, MapPin, FileDown, CheckCircle, Loader2, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedMarket, SavedProperty } from '@/hooks/useSavedItems';
import { exportSavedItemsToPdf } from '@/utils/exportPdf';

interface SavedItemsPanelProps {
  savedMarkets: SavedMarket[];
  savedProperties: SavedProperty[];
  onRemoveMarket: (id: string) => void;
  onRemoveProperty: (id: string) => void;
  onSelectMarket?: (market: SavedMarket) => void;
  onSelectProperty?: (property: SavedProperty) => void;
  onUseProperty?: (property: SavedProperty) => void;
  onUpdateMarketNote?: (id: string, notes: string) => void;
  onUpdatePropertyNote?: (id: string, notes: string) => void;
  onClearAll: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

export const SavedItemsPanel: React.FC<SavedItemsPanelProps> = ({
  savedMarkets,
  savedProperties,
  onRemoveMarket,
  onRemoveProperty,
  onSelectMarket,
  onSelectProperty,
  onUseProperty,
  onUpdateMarketNote,
  onUpdatePropertyNote,
  onClearAll,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [expandedMarketNotes, setExpandedMarketNotes] = useState<Set<string>>(new Set());
  const [expandedPropertyNotes, setExpandedPropertyNotes] = useState<Set<string>>(new Set());
  const totalItems = savedMarkets.length + savedProperties.length;

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportSavedItemsToPdf(savedMarkets, savedProperties);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleMarketNotes = (id: string) => {
    setExpandedMarketNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const togglePropertyNotes = (id: string) => {
    setExpandedPropertyNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (totalItems === 0) {
    return (
      <div className="text-center py-8 text-[oklch(0.50_0_0)]">
        <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No saved items yet</p>
        <p className="text-sm mt-1">Save markets and properties to compare later</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[oklch(0.78_0.12_75)]" />
          <span className="font-semibold text-[oklch(0.15_0_0)]">
            {totalItems} Saved Item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExporting}
            className="border-[oklch(0.78_0.12_75)] text-[oklch(0.78_0.12_75)] hover:bg-[oklch(0.78_0.12_75)]/10"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-1" />
                Export PDF
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Saved Markets */}
      {savedMarkets.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[oklch(0.45_0_0)] mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Saved Markets ({savedMarkets.length})
          </h4>
          <div className="space-y-2">
            {savedMarkets.map((market) => (
              <div
                key={market.id}
                className="p-3 bg-white border border-[oklch(0.90_0_0)] rounded-lg hover:border-[oklch(0.78_0.12_75)]/50 transition-colors"
              >
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => onSelectMarket?.(market)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[oklch(0.15_0_0)] truncate">
                      {market.name}
                    </p>
                    <p className="text-sm text-[oklch(0.50_0_0)]">{market.state}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-600">
                        {formatCurrency(market.avgRevenue)}/yr
                      </p>
                      <p className="text-xs text-[oklch(0.50_0_0)]">
                        {Math.round(market.avgOccupancy)}% occ
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMarketNotes(market.id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        market.notes || expandedMarketNotes.has(market.id)
                          ? 'text-[oklch(0.78_0.12_75)] bg-[oklch(0.78_0.12_75)]/10'
                          : 'text-[oklch(0.50_0_0)] hover:text-[oklch(0.78_0.12_75)] hover:bg-[oklch(0.78_0.12_75)]/10'
                      }`}
                      title={market.notes ? 'Edit note' : 'Add note'}
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMarket(market.id);
                      }}
                      className="p-1.5 text-[oklch(0.50_0_0)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Notes Section */}
                {expandedMarketNotes.has(market.id) && onUpdateMarketNote && (
                  <div className="mt-3 pt-3 border-t border-[oklch(0.92_0_0)]">
                    <label className="text-xs font-medium text-[oklch(0.45_0_0)] mb-1 block">
                      Your Notes
                    </label>
                    <textarea
                      value={market.notes || ''}
                      onChange={(e) => onUpdateMarketNote(market.id, e.target.value)}
                      placeholder="Add your thoughts about this market..."
                      className="w-full p-2 text-sm border border-[oklch(0.90_0_0)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[oklch(0.78_0.12_75)]/30 focus:border-[oklch(0.78_0.12_75)]"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                
                {/* Show note preview if collapsed but has notes */}
                {!expandedMarketNotes.has(market.id) && market.notes && (
                  <div 
                    className="mt-2 pt-2 border-t border-[oklch(0.92_0_0)] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMarketNotes(market.id);
                    }}
                  >
                    <p className="text-xs text-[oklch(0.50_0_0)] italic truncate">
                      📝 {market.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Properties */}
      {savedProperties.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[oklch(0.45_0_0)] mb-3 flex items-center gap-2">
            <Bed className="w-4 h-4" />
            Saved Properties ({savedProperties.length})
          </h4>
          <div className="space-y-2">
            {savedProperties.map((property) => (
              <div
                key={property.id}
                className="p-3 bg-white border border-[oklch(0.90_0_0)] rounded-lg hover:border-[oklch(0.78_0.12_75)]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[oklch(0.15_0_0)] truncate">
                      {property.title}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-[oklch(0.50_0_0)]">
                      <span className="flex items-center gap-1">
                        <Bed className="w-3 h-3" />
                        {property.bedrooms}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3 h-3" />
                        {property.bathrooms}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-600">
                        {formatCurrency(property.revenue)}/yr
                      </p>
                      <p className="text-xs text-[oklch(0.50_0_0)]">
                        {formatCurrency(property.adr)}/night
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePropertyNotes(property.id);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          property.notes || expandedPropertyNotes.has(property.id)
                            ? 'text-[oklch(0.78_0.12_75)] bg-[oklch(0.78_0.12_75)]/10'
                            : 'text-[oklch(0.50_0_0)] hover:text-[oklch(0.78_0.12_75)] hover:bg-[oklch(0.78_0.12_75)]/10'
                        }`}
                        title={property.notes ? 'Edit note' : 'Add note'}
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      {property.airbnbUrl && (
                        <a
                          href={property.airbnbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-[oklch(0.50_0_0)] hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View on Airbnb"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveProperty(property.id);
                        }}
                        className="p-1.5 text-[oklch(0.50_0_0)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Notes Section */}
                {expandedPropertyNotes.has(property.id) && onUpdatePropertyNote && (
                  <div className="mt-3 pt-3 border-t border-[oklch(0.92_0_0)]">
                    <label className="text-xs font-medium text-[oklch(0.45_0_0)] mb-1 block">
                      Your Notes
                    </label>
                    <textarea
                      value={property.notes || ''}
                      onChange={(e) => onUpdatePropertyNote(property.id, e.target.value)}
                      placeholder="Add your thoughts about this property..."
                      className="w-full p-2 text-sm border border-[oklch(0.90_0_0)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[oklch(0.78_0.12_75)]/30 focus:border-[oklch(0.78_0.12_75)]"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                
                {/* Show note preview if collapsed but has notes */}
                {!expandedPropertyNotes.has(property.id) && property.notes && (
                  <div 
                    className="mt-2 pt-2 border-t border-[oklch(0.92_0_0)] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePropertyNotes(property.id);
                    }}
                  >
                    <p className="text-xs text-[oklch(0.50_0_0)] italic truncate">
                      📝 {property.notes}
                    </p>
                  </div>
                )}
                
                {/* Use Property Button */}
                {onUseProperty && (
                  <div className="mt-3 pt-3 border-t border-[oklch(0.92_0_0)]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUseProperty(property)}
                      className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Use in Step 3 (Validate Deal)
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
