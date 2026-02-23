/**
 * Admin View Report Page
 * Loads a full analysis report by ID and renders it using ChapterPropertyReport or FullPropertyReport
 */
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Loader2, AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lazy, Suspense, useMemo } from 'react';

const ChapterPropertyReport = lazy(() => import('@/components/ChapterPropertyReport'));
const FullPropertyReport = lazy(() => import('@/components/FullPropertyReport'));

export default function AdminViewReport() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  const reportId = useMemo(() => {
    const parsed = parseInt(id || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [id]);

  const { data: report, isLoading, error } = trpc.admin.getReportById.useQuery(
    { id: reportId },
    { enabled: isAuthenticated && user?.role === 'admin' && reportId > 0 }
  );

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }

  // Not admin
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-4">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground mb-4">You need admin privileges to view this page.</p>
          <Button variant="outline" onClick={() => setLocation('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Report Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'Could not load this report.'}
          </p>
          <Button variant="outline" onClick={() => setLocation('/admin/dashboard?tab=properties')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  // Parse the full analysis data
  const fullData = report.fullAnalysisData as any;
  if (!fullData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">No Report Data</h1>
          <p className="text-muted-foreground mb-4">
            This analysis report doesn't have full data attached.
          </p>
          <Button variant="outline" onClick={() => setLocation('/admin/dashboard?tab=properties')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  // Determine report format and render accordingly
  const reportFallback = (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Loading report view...</p>
      </div>
    </div>
  );

  const handleBack = () => {
    setLocation('/admin/dashboard?tab=properties');
  };

  // Check if this is a "full report" format (from advanced.ts LeadMagnet)
  if (fullData.property_estimate || fullData.profitability) {
    return (
      <Suspense fallback={reportFallback}>
        <FullPropertyReport
          data={fullData}
          onBack={handleBack}
          isSharedView={false}
        />
      </Suspense>
    );
  }

  // Check if this is a "chapter report" format (from rental.ts)
  if (fullData.property && fullData.revenue_estimate) {
    // Ensure lat/lng from DB is populated
    if (report.latitude && report.longitude && fullData.property) {
      if (!fullData.property.latitude) fullData.property.latitude = parseFloat(report.latitude);
      if (!fullData.property.longitude) fullData.property.longitude = parseFloat(report.longitude);
    }
    
    return (
      <Suspense fallback={reportFallback}>
        <ChapterPropertyReport
          data={fullData}
          onBack={handleBack}
          clientName={report.leadName || undefined}
        />
      </Suspense>
    );
  }

  // Fallback: try to render as chapter report with reconstructed data
  const reconstructedData = {
    property: {
      address: report.address || 'Unknown Address',
      city: report.city || '',
      state: report.state || '',
      zipCode: report.zipCode || '',
      bedrooms: report.bedrooms || 0,
      bathrooms: parseFloat(report.bathrooms || '1'),
      accommodates: (report.bedrooms || 1) * 2,
      monthlyRent: report.monthlyRent || undefined,
      latitude: report.latitude ? parseFloat(report.latitude) : undefined,
      longitude: report.longitude ? parseFloat(report.longitude) : undefined,
    },
    revenue_estimate: {
      annual: report.annualRevenueRealistic || 0,
      monthly: Math.round((report.annualRevenueRealistic || 0) / 12),
      nightly: report.averageDailyRate || 0,
      occupancy: report.occupancyRate ? parseFloat(report.occupancyRate) : 0,
      range: {
        low: report.annualRevenueConservative || 0,
        high: report.annualRevenueOptimistic || 0,
      }
    },
    monthly_forecast: [],
    comps: [],
    market_data: {
      name: report.marketName || `${report.city || 'Unknown'} Market`,
      metrics: {
        occupancy: report.occupancyRate ? parseFloat(report.occupancyRate) : 0,
        adr: report.averageDailyRate || 0,
        revenue: report.annualRevenueRealistic || 0,
        revpar: report.revpar || 0,
        active_listings: 0,
      },
      listing_count: 0,
    },
    bedroom_performance: [],
    ...fullData,
  };

  return (
    <Suspense fallback={reportFallback}>
      <ChapterPropertyReport
        data={reconstructedData}
        onBack={handleBack}
        clientName={report.leadName || undefined}
      />
    </Suspense>
  );
}
