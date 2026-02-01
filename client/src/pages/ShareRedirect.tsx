/**
 * ShareRedirect - Redirects share links to the actual tool page with pre-loaded data
 * 
 * Instead of showing a separate report viewer, this component:
 * 1. Fetches the shared report data
 * 2. Builds a URL with query parameters to pre-populate the tool
 * 3. Redirects to the actual tool page so users see the same experience
 */

import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';

// Map report types to their corresponding tab names and step numbers
const reportTypeToTab: Record<string, { tab: string; step: string }> = {
  revenue: { tab: 'prove', step: '3' },
  validator: { tab: 'validate', step: '5' },
  market: { tab: 'market', step: '8' },
  ai_advisor: { tab: 'advisor', step: '9' },
  listings: { tab: 'find', step: '4' },
  comparison: { tab: 'compare', step: '6' },
  map: { tab: 'map', step: '7' },
  regulation: { tab: 'regulations', step: '1' },
};

export default function ShareRedirect() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  
  // Fetch the shared report data
  const { data: report, isLoading, error: fetchError } = trpc.shareableReports.get.useQuery(
    { shareCode: shareCode || '' },
    { enabled: !!shareCode }
  );
  
  useEffect(() => {
    if (fetchError) {
      setError('Report not found or has expired');
      return;
    }
    
    if (!report || !report.success || !report.data) return;
    
    const reportData = report.data;
    
    // Build the redirect URL with query parameters
    const tabInfo = reportTypeToTab[reportData.reportType] || { tab: 'prove', step: '3' };
    
    // Build query params based on report data
    const params = new URLSearchParams();
    params.set('tab', tabInfo.tab);
    params.set('shared', 'true');
    params.set('shareCode', shareCode || '');
    
    // Add location/address params
    if (reportData.address) {
      params.set('address', reportData.address);
    }
    if (reportData.city) {
      params.set('city', reportData.city);
    }
    if (reportData.state) {
      params.set('state', reportData.state);
    }
    if (reportData.zipCode) {
      params.set('zip', reportData.zipCode);
    }
    
    // Add property details
    if (reportData.bedrooms) {
      params.set('bedrooms', reportData.bedrooms.toString());
    }
    if (reportData.bathrooms) {
      params.set('bathrooms', reportData.bathrooms.toString());
    }
    if (reportData.monthlyRent) {
      params.set('rent', reportData.monthlyRent.toString());
    }
    
    // Add coordinates if available
    if (reportData.latitude) {
      params.set('lat', reportData.latitude.toString());
    }
    if (reportData.longitude) {
      params.set('lng', reportData.longitude.toString());
    }
    
    // Build location string for market-based tools
    const location = reportData.city && reportData.state 
      ? `${reportData.city}, ${reportData.state}` 
      : reportData.marketName || '';
    if (location) {
      params.set('location', location);
    }
    
    // Auto-analyze flag to trigger the analysis on load
    params.set('autoAnalyze', 'true');
    
    // Redirect to the main page with query params
    const redirectUrl = `/?${params.toString()}`;
    console.log('[ShareRedirect] Redirecting to:', redirectUrl);
    
    // Use window.location for a full page navigation to ensure params are captured
    window.location.href = redirectUrl;
  }, [report, fetchError, shareCode, setLocation]);
  
  // Show loading state while fetching
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-[#FFF8F0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#C9A962] animate-spin mx-auto mb-4" />
          <p className="text-[#0F172A]/70 font-sans">Loading your report...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error || fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-[#FFF8F0] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h1 className="text-2xl font-serif font-semibold text-[#0F172A] mb-2">
            Report Not Found
          </h1>
          <p className="text-[#0F172A]/60 mb-6">
            {error || 'This report may have expired or the link is invalid.'}
          </p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#1e293b] transition-colors"
          >
            Go to Calculator
          </a>
        </div>
      </div>
    );
  }
  
  // Show redirecting state
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-[#FFF8F0] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#C9A962] animate-spin mx-auto mb-4" />
        <p className="text-[#0F172A]/70 font-sans">Redirecting to your report...</p>
      </div>
    </div>
  );
}
