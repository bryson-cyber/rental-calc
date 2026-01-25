/**
 * VirtualizedTable - A virtualized table component for displaying large datasets
 * Uses @tanstack/react-virtual for efficient rendering of 1000+ rows
 */

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  MapPin,
} from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  revenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  latitude: number;
  longitude: number;
  airbnbUrl: string;
  thumbnailUrl?: string;
  propertyType?: string;
  distanceToMyProperty?: number;
}

interface ThresholdData {
  high: number;
  low: number;
  average: number;
  topCount: number;
  middleCount: number;
  bottomCount: number;
}

interface VirtualizedTableProps {
  listings: Listing[];
  thresholds: ThresholdData;
  customThreshold: number | null;
  hasProperty: boolean;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onRowClick?: (listing: Listing) => void;
  showCompSetMode?: boolean;
  excludedListingIds?: Set<string>;
  onExcludeListing?: (id: string) => void;
  className?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDistance = (miles: number) => {
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
};

const getMarkerColor = (revenue: number, thresholds: ThresholdData, customThreshold: number | null) => {
  if (customThreshold !== null) {
    return revenue >= customThreshold ? '#22c55e' : '#94a3b8';
  }
  if (revenue >= thresholds.high) return '#22c55e';
  if (revenue >= thresholds.low) return '#f59e0b';
  return '#ef4444';
};

export function VirtualizedTable({
  listings,
  thresholds,
  customThreshold,
  hasProperty,
  sortBy,
  onSortChange,
  onRowClick,
  showCompSetMode = false,
  excludedListingIds = new Set(),
  onExcludeListing,
  className = '',
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const ROW_HEIGHT = 72; // Height of each row in pixels
  
  const rowVirtualizer = useVirtualizer({
    count: listings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Render 10 extra rows above and below viewport
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Column headers
  type ColumnDef = {
    key: string;
    label: string;
    align: 'left' | 'center' | 'right';
    sortable: boolean;
    sortKey?: string;
  };
  
  const columns = useMemo(() => {
    const cols: ColumnDef[] = [
      { key: 'property', label: 'Property', align: 'left', sortable: false },
      { key: 'brba', label: 'BR/BA', align: 'center', sortable: false },
    ];
    
    if (hasProperty) {
      cols.push({ key: 'distance', label: 'Distance', align: 'right', sortable: true, sortKey: 'distance' });
    }
    
    cols.push(
      { key: 'revenue', label: 'Revenue', align: 'right', sortable: true, sortKey: 'revenue' },
      { key: 'occupancy', label: 'Occupancy', align: 'right', sortable: true, sortKey: 'occupancy' },
      { key: 'adr', label: 'ADR', align: 'right', sortable: false },
      { key: 'rating', label: 'Rating', align: 'center', sortable: false },
      { key: 'link', label: 'Link', align: 'center', sortable: false },
    );
    
    if (showCompSetMode) {
      cols.push({ key: 'exclude', label: '', align: 'center', sortable: false });
    }
    
    return cols;
  }, [hasProperty, showCompSetMode]);

  const handleSort = (sortKey: string) => {
    if (sortBy === `${sortKey}-desc`) {
      onSortChange(`${sortKey}-asc`);
    } else {
      onSortChange(`${sortKey}-desc`);
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${className}`}>
      {/* Fixed Header */}
      <div className="bg-slate-50 border-b border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 font-semibold text-slate-700 ${
                    col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                  } ${col.key === 'property' ? 'w-[300px]' : ''}`}
                >
                  {col.sortable && 'sortKey' in col ? (
                    <button
                      onClick={() => handleSort(col.sortKey!)}
                      className={`inline-flex items-center gap-1 hover:text-amber-600 ${
                        sortBy.startsWith(col.sortKey!) ? 'text-amber-600' : ''
                      }`}
                    >
                      {col.key === 'distance' && <MapPin className="w-3 h-3 text-blue-500" />}
                      {col.label}
                      {sortBy.startsWith(col.sortKey!) && (
                        sortBy.endsWith('-desc') ? 
                          <ChevronDown className="w-3 h-3" /> : 
                          <ChevronUp className="w-3 h-3" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: Math.min(600, listings.length * ROW_HEIGHT + 20) }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <tbody>
              {virtualRows.map((virtualRow) => {
                const listing = listings[virtualRow.index];
                const markerColor = getMarkerColor(listing.revenue, thresholds, customThreshold);
                const occupancyDisplay = listing.occupancy > 1 
                  ? Math.round(listing.occupancy) 
                  : Math.round(listing.occupancy * 100);
                const isExcluded = excludedListingIds.has(listing.id);
                
                return (
                  <tr
                    key={listing.id}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${ROW_HEIGHT}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                      isExcluded ? 'opacity-40 bg-red-50' : ''
                    }`}
                    onClick={() => onRowClick?.(listing)}
                  >
                    {/* Property */}
                    <td className="p-3 w-[300px]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: markerColor }}
                        />
                        {listing.thumbnailUrl ? (
                          <img
                            src={listing.thumbnailUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate text-sm">
                            {listing.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {listing.propertyType || 'Entire home'}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    {/* BR/BA */}
                    <td className="p-3 text-center text-slate-600">
                      {listing.bedrooms}/{listing.bathrooms}
                    </td>
                    
                    {/* Distance */}
                    {hasProperty && (
                      <td className="p-3 text-right">
                        {listing.distanceToMyProperty !== undefined ? (
                          <span className="text-blue-600 font-medium">
                            {formatDistance(listing.distanceToMyProperty)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    
                    {/* Revenue */}
                    <td className="p-3 text-right">
                      <span
                        className="font-semibold"
                        style={{ color: markerColor }}
                      >
                        {formatCurrency(listing.revenue)}
                      </span>
                    </td>
                    
                    {/* Occupancy */}
                    <td className="p-3 text-right">
                      <span className="text-amber-600 font-medium">
                        {occupancyDisplay}%
                      </span>
                    </td>
                    
                    {/* ADR */}
                    <td className="p-3 text-right text-slate-600">
                      {formatCurrency(listing.adr)}
                    </td>
                    
                    {/* Rating */}
                    <td className="p-3 text-center">
                      {listing.rating ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Star className="w-3 h-3 fill-current" />
                          {listing.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    
                    {/* Link */}
                    <td className="p-3 text-center">
                      <a
                        href={listing.airbnbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                    
                    {/* Exclude button */}
                    {showCompSetMode && (
                      <td className="p-3 text-center w-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onExcludeListing?.(listing.id);
                          }}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                          title="Exclude from comp set"
                        >
                          <span className="text-xs font-bold">×</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer with count */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-sm text-slate-500">
        Showing {listings.length.toLocaleString()} properties
        {listings.length > 100 && (
          <span className="ml-2 text-xs text-slate-400">
            (virtualized for performance)
          </span>
        )}
      </div>
    </div>
  );
}
