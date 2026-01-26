import React from 'react';
import { ExternalLink, Star, Home, Bed, Bath, TrendingUp, Calendar, MapPin, Bookmark, BookmarkCheck, DollarSign, Percent, Target } from 'lucide-react';

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
  rank?: number;
  isSaved?: boolean;
  onSave?: () => void;
  onAnalyze?: () => void;
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
  isSaved = false,
  onSave,
  onAnalyze,
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
    // RevPAR = ADR × Occupancy (as decimal)
    // This is the correct formula: Revenue Per Available Room = Daily Rate × Occupancy Rate
    return adr * (occupancy / 100);
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Tesla Dashboard Style Card
  return (
    <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      {/* Card Header with Rank and Rating */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
            #{rank || index + 1}
          </div>
          {/* Property Type */}
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <Home className="w-4 h-4" />
            <span className="capitalize">{propertyType}</span>
          </div>
        </div>
        
        {/* Rating & Superhost */}
        <div className="flex items-center gap-2">
          {superhost && (
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full text-xs font-medium border border-amber-500/20">
              <Star className="w-3 h-3 fill-amber-500" />
              Superhost
            </div>
          )}
          {rating !== null && (
            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-yellow-700 font-bold text-sm">{rating.toFixed(1)}</span>
              <span className="text-slate-400 text-xs">({reviews})</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Card Body */}
      <div className="p-4">
        {/* Title */}
        <h4 className="text-slate-900 font-semibold line-clamp-2 mb-3 text-base leading-snug">
          {title}
        </h4>
        
        {/* Property Details */}
        <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1.5">
            <Bed className="w-4 h-4" />
            {bedrooms} bed
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="w-4 h-4" />
            {bathrooms} bath
          </span>
          {distance && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {formatDistance(distance)}
            </span>
          )}
        </div>
        
        {/* Financial Stats Grid - Tesla Dashboard Style */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Annual Revenue */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-xs text-emerald-600 font-medium">Annual Revenue</span>
            </div>
            <p className="text-emerald-700 font-bold text-lg">{formatCurrency(annualRevenue)}</p>
          </div>
          
          {/* ADR */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                <DollarSign className="w-3 h-3 text-blue-600" />
              </div>
              <span className="text-xs text-blue-600 font-medium">Daily Rate</span>
            </div>
            <p className="text-blue-700 font-bold text-lg">{formatCurrency(adr)}</p>
          </div>
          
          {/* Occupancy */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
                <Calendar className="w-3 h-3 text-amber-600" />
              </div>
              <span className="text-xs text-amber-600 font-medium">Occupancy</span>
            </div>
            <p className="text-amber-700 font-bold text-lg">{Math.round(occupancy)}%</p>
          </div>
          
          {/* RevPAR */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                <Percent className="w-3 h-3 text-purple-600" />
              </div>
              <span className="text-xs text-purple-600 font-medium">RevPAR</span>
            </div>
            <p className="text-purple-700 font-bold text-lg">{formatCurrency(calculateRevPAR())}</p>
          </div>
        </div>
        
        {/* Last Review Date */}
        {lastReviewDate && (
          <p className="text-xs text-slate-400 mb-4">
            Last reviewed: {new Date(lastReviewDate).toLocaleDateString()}
          </p>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* View on Airbnb Button */}
          {airbnbUrl ? (
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Listing
            </a>
          ) : (
            <div className="flex-1 text-center text-xs text-slate-400 italic py-2.5">No Airbnb link</div>
          )}
          
          {/* Analyze Button */}
          {onAnalyze && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              <Target className="w-4 h-4" />
              Analyze
            </button>
          )}
          
          {/* Save Button */}
          {onSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                isSaved 
                  ? 'bg-amber-500/10 border-amber-500 text-amber-600' 
                  : 'border-slate-200 text-slate-500 hover:border-amber-500 hover:text-amber-600 hover:bg-amber-500/5'
              }`}
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
