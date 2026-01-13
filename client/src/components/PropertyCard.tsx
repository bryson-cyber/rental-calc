import React from 'react';
import { ExternalLink, Star, Home, Bed, Bath, TrendingUp, Calendar, MapPin } from 'lucide-react';

interface PropertyCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  rating: number | null;
  reviews: number;
  annualRevenue: number;
  occupancy: number;
  adr: number;
  revpar?: number;
  distance?: number;
  lastReviewDate?: string;
  airbnbUrl?: string;
  superhost?: boolean;
  index?: number;
  rank?: number; // Market rank if available
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  id,
  title,
  imageUrl,
  bedrooms,
  bathrooms,
  propertyType,
  rating,
  reviews,
  annualRevenue,
  occupancy,
  adr,
  airbnbUrl,
  superhost,
  index = 0,
  revpar,
  distance,
  lastReviewDate,
  rank,
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateRevPAR = (): number => {
    if (revpar) return revpar;
    return annualRevenue / 365;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Horizontal card layout - cleaner design without image placeholder
  return (
    <div className="group bg-white border border-[oklch(0.90_0_0)] rounded-xl overflow-hidden hover:shadow-lg hover:border-[oklch(0.75_0.12_70)] transition-all duration-300">
      <div className="flex flex-col sm:flex-row">
        {/* Left Side - Property Info & CTA */}
        <div className="flex-shrink-0 p-4 sm:w-48 sm:border-r border-b sm:border-b-0 border-[oklch(0.92_0_0)] bg-[oklch(0.98_0.01_70)]">
          {/* Rank Badge */}
          {(rank || index !== undefined) && (
            <div className="inline-flex items-center gap-1 bg-[oklch(0.75_0.12_70)] text-white px-2 py-1 rounded-full text-xs font-bold mb-3">
              <span>#{rank || index + 1}</span>
            </div>
          )}
          
          {/* Property Type Icon */}
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-[oklch(0.50_0_0)]" />
            <span className="text-xs text-[oklch(0.50_0_0)] capitalize">{propertyType}</span>
          </div>
          
          {/* Beds & Baths */}
          <div className="flex items-center gap-3 text-sm text-[oklch(0.40_0_0)] mb-3">
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />
              {bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />
              {bathrooms}
            </span>
          </div>
          
          {/* Superhost Badge */}
          {superhost && (
            <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium mb-3">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              Superhost
            </div>
          )}
          
          {/* Distance */}
          {distance && (
            <div className="flex items-center gap-1 text-xs text-[oklch(0.50_0_0)] mb-3">
              <MapPin className="w-3 h-3" />
              {formatDistance(distance)} away
            </div>
          )}
          
          {/* View on Airbnb Button */}
          {airbnbUrl ? (
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[oklch(0.75_0.12_70)] hover:bg-[oklch(0.65_0.14_70)] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              View Listing
            </a>
          ) : (
            <div className="text-xs text-[oklch(0.60_0_0)] italic">No Airbnb link</div>
          )}
        </div>
        
        {/* Right Side - Stats */}
        <div className="flex-1 p-4">
          {/* Title */}
          <h4 className="text-[oklch(0.25_0_0)] font-semibold line-clamp-2 mb-3 text-sm leading-tight">
            {title}
          </h4>
          
          {/* Rating */}
          {rating !== null && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-yellow-700 font-bold text-sm">{rating.toFixed(1)}</span>
              </div>
              <span className="text-[oklch(0.50_0_0)] text-xs">({reviews} reviews)</span>
            </div>
          )}
          
          {/* Financial Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-xs text-emerald-600 mb-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Annual Revenue
              </p>
              <p className="text-emerald-700 font-bold text-base">{formatCurrency(annualRevenue)}</p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-blue-600 mb-0.5">Daily Rate (ADR)</p>
              <p className="text-blue-700 font-bold text-base">{formatCurrency(adr)}</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-2">
              <p className="text-xs text-purple-600 mb-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Occupancy
              </p>
              <p className="text-purple-700 font-bold text-base">{Math.round(occupancy)}%</p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-2">
              <p className="text-xs text-orange-600 mb-0.5">RevPAR</p>
              <p className="text-orange-700 font-bold text-base">{formatCurrency(calculateRevPAR())}</p>
            </div>
          </div>
          
          {/* Last Review Date */}
          {lastReviewDate && (
            <p className="text-xs text-[oklch(0.50_0_0)] mt-3">
              Last reviewed: {new Date(lastReviewDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
