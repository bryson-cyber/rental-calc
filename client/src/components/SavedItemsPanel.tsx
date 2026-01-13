import React from 'react';
import { Bookmark, X, ExternalLink, Trash2, DollarSign, Percent, Bed, Bath, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedMarket, SavedProperty } from '@/hooks/useSavedItems';

interface SavedItemsPanelProps {
  savedMarkets: SavedMarket[];
  savedProperties: SavedProperty[];
  onRemoveMarket: (id: string) => void;
  onRemoveProperty: (id: string) => void;
  onSelectMarket?: (market: SavedMarket) => void;
  onSelectProperty?: (property: SavedProperty) => void;
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
  onClearAll,
}) => {
  const totalItems = savedMarkets.length + savedProperties.length;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[oklch(0.78_0.12_75)]" />
          <span className="font-semibold text-[oklch(0.15_0_0)]">
            {totalItems} Saved Item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
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
                className="flex items-center justify-between p-3 bg-white border border-[oklch(0.90_0_0)] rounded-lg hover:border-[oklch(0.78_0.12_75)]/50 transition-colors cursor-pointer"
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
                      onRemoveMarket(market.id);
                    }}
                    className="p-1.5 text-[oklch(0.50_0_0)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                className="flex items-center justify-between p-3 bg-white border border-[oklch(0.90_0_0)] rounded-lg hover:border-[oklch(0.78_0.12_75)]/50 transition-colors"
              >
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
                    {property.airbnbUrl && (
                      <a
                        href={property.airbnbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-[oklch(0.50_0_0)] hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
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
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
