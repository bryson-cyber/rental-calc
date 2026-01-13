import React from 'react';
import { ExternalLink } from 'lucide-react';

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
  revpar?: number; // Revenue Per Available Room
  distance?: number; // Distance in meters
  lastReviewDate?: string; // Last review date
  airbnbUrl?: string;
  superhost?: boolean;
  index?: number;
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
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };
  const [imageError, setImageError] = React.useState(false);
  
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <a
      href={airbnbUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white border border-[oklch(0.90_0_0)] rounded-xl overflow-hidden hover:shadow-lg hover:border-[oklch(0.80_0.15_70)] transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative w-full h-48 bg-[oklch(0.92_0_0)] overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[oklch(0.75_0.08_70)] to-[oklch(0.85_0.05_70)]">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center mx-auto mb-2 shadow-sm">
                <span className="text-[oklch(0.55_0.12_70)] font-bold text-xl">#{index + 1}</span>
              </div>
              <p className="text-xs text-white/90 font-medium">View on Airbnb</p>
            </div>
          </div>
        )}

        {/* Superhost Badge */}
        {superhost && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <span>⭐</span>
            <span>Superhost</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h4 className="text-[oklch(0.25_0_0)] font-semibold line-clamp-2 mb-2 group-hover:text-[oklch(0.35_0.15_70)] transition-colors">
          {title}
        </h4>

        {/* Property Details */}
        <p className="text-sm text-[oklch(0.50_0_0)] mb-3">
          {bedrooms} BR · {bathrooms} BA · {propertyType}
        </p>

        {/* Rating and Reviews */}
        {rating !== null && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[oklch(0.90_0_0)]">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500 font-bold text-sm">{rating.toFixed(2)}</span>
              <span className="text-yellow-400">★</span>
            </div>
            <span className="text-[oklch(0.50_0_0)] text-xs">({reviews} {reviews === 1 ? 'review' : 'reviews'})</span>
          </div>
        )}

        {/* Financial Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs text-[oklch(0.50_0_0)] mb-1">Annual Revenue</p>
            <p className="text-emerald-500 font-bold text-sm">{formatCurrency(annualRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0_0)] mb-1">Daily Rate</p>
            <p className="text-[oklch(0.25_0_0)] font-bold text-sm">{formatCurrency(adr)}</p>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0_0)] mb-1">Occupancy</p>
            <p className="text-[oklch(0.25_0_0)] font-bold text-sm">{Math.round(occupancy)}%</p>
          </div>
          <div>
            <p className="text-xs text-[oklch(0.50_0_0)] mb-1">RevPAR</p>
            <p className="text-[oklch(0.25_0_0)] font-bold text-sm">{formatCurrency(calculateRevPAR())}</p>
          </div>
        </div>
        
        {/* Distance and Last Review */}
        {(distance || lastReviewDate) && (
          <div className="text-xs text-[oklch(0.50_0_0)] space-y-1 pb-3 border-b border-[oklch(0.90_0_0)]">
            {distance && <p>{formatDistance(distance)}</p>}
            {lastReviewDate && <p>Last reviewed: {new Date(lastReviewDate).toLocaleDateString()}</p>}
          </div>
        )}

        {/* View on Airbnb Link */}
        {airbnbUrl && (
          <div className="mt-3 pt-3 border-t border-[oklch(0.90_0_0)] flex items-center justify-between">
            <span className="text-xs text-[oklch(0.50_0_0)]">View on Airbnb</span>
            <ExternalLink className="w-4 h-4 text-[oklch(0.50_0_0)] group-hover:text-[oklch(0.35_0.15_70)] transition-colors" />
          </div>
        )}
      </div>
    </a>
  );
};

export default PropertyCard;
