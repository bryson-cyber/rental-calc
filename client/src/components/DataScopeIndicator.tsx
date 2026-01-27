/**
 * DataScopeIndicator Component
 * 
 * Shows users when data is from city/metro level vs zip-specific level.
 * Helps users understand the scope of the data they're viewing.
 */

import { Info, MapPin } from 'lucide-react';

interface DataScopeIndicatorProps {
  /** The level of data being shown: 'zip', 'submarket', 'city', or 'metro' */
  level: 'zip' | 'submarket' | 'city' | 'metro';
  /** The name of the location (e.g., "Atlanta", "30301", "Buckhead") */
  locationName: string;
  /** Optional: The parent location name for context (e.g., "Atlanta metro" when showing zip data) */
  parentName?: string;
  /** Whether this is showing fallback data (city-level when zip was requested) */
  isFallback?: boolean;
  /** Optional className for styling */
  className?: string;
}

export function DataScopeIndicator({ 
  level, 
  locationName, 
  parentName,
  isFallback = false,
  className = ''
}: DataScopeIndicatorProps) {
  // Determine the display text based on level
  const getLevelLabel = () => {
    switch (level) {
      case 'zip':
        return 'Zip code data';
      case 'submarket':
        return 'Neighborhood data';
      case 'city':
        return 'City-wide data';
      case 'metro':
        return 'Metro area data';
      default:
        return 'Market data';
    }
  };

  const getMessage = () => {
    if (isFallback) {
      return `Showing ${parentName || 'metro area'} data (zip-specific data not available)`;
    }
    
    switch (level) {
      case 'zip':
        return `Data specific to ${locationName}`;
      case 'submarket':
        return `Data for ${locationName} neighborhood`;
      case 'city':
        return `Data for ${locationName} city`;
      case 'metro':
        return `Data for ${locationName} metro area`;
      default:
        return `Data for ${locationName}`;
    }
  };

  // Use different colors based on whether it's fallback or not
  const bgColor = isFallback 
    ? 'bg-amber-50 border-amber-200' 
    : 'bg-blue-50 border-blue-200';
  const textColor = isFallback 
    ? 'text-amber-700' 
    : 'text-blue-700';
  const iconColor = isFallback 
    ? 'text-amber-500' 
    : 'text-blue-500';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgColor} ${className}`}>
      {isFallback ? (
        <Info className={`w-4 h-4 ${iconColor}`} />
      ) : (
        <MapPin className={`w-4 h-4 ${iconColor}`} />
      )}
      <span className={`text-xs font-medium ${textColor}`}>
        {getMessage()}
      </span>
    </div>
  );
}

/**
 * Compact version for inline use in section headers
 */
export function DataScopeBadge({ 
  level, 
  isFallback = false,
  className = ''
}: Pick<DataScopeIndicatorProps, 'level' | 'isFallback' | 'className'>) {
  const getLevelLabel = () => {
    switch (level) {
      case 'zip':
        return 'Zip';
      case 'submarket':
        return 'Neighborhood';
      case 'city':
        return 'City';
      case 'metro':
        return 'Metro';
      default:
        return 'Market';
    }
  };

  const bgColor = isFallback 
    ? 'bg-amber-100 text-amber-700 border-amber-200' 
    : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${bgColor} ${className}`}>
      {isFallback && <Info className="w-3 h-3" />}
      {getLevelLabel()} data
    </span>
  );
}
