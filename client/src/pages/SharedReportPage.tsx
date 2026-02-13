import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Loader2, AlertCircle, Lock, Eye, Clock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChapterPropertyReport from '@/components/ChapterPropertyReport';
import ChapterMarketReport from '@/components/ChapterMarketReport';
import { SharedMarketReport } from '@/components/SharedMarketReport';
import FullPropertyReport from '@/components/FullPropertyReport';

export default function SharedReportPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  const { data, isLoading, error, refetch } = trpc.sharedReports.get.useQuery(
    { shareId: shareId || '', password: password || undefined },
    { enabled: !!shareId, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#D4A84B] mx-auto mb-4" />
          <p className="text-[#1A1A1A]/70">Loading shared report...</p>
        </div>
      </div>
    );
  }

  // Handle errors from tRPC
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-sans font-bold text-[#1A1A1A] mb-2">
            Error Loading Report
          </h1>
          <p className="text-[#1A1A1A]/60 mb-6">{error.message}</p>
          <Button variant="outline" onClick={() => setLocation('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // Handle API response errors
  if (data && !data.success) {
    const errorMessage = data.error || 'Unknown error';
    
    // Check if password is required
    if ('requiresPassword' in data && data.requiresPassword) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#D4A84B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#D4A84B]" />
              </div>
              <h1 className="text-2xl font-sans font-bold text-[#1A1A1A] mb-2">
                Password Protected
              </h1>
              <p className="text-[#1A1A1A]/60">
                This report requires a password to view.
              </p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                className={passwordError ? 'border-red-500' : ''}
              />
              {passwordError && (
                <p className="text-red-500 text-sm">Incorrect password</p>
              )}
              <Button 
                className="w-full"
                onClick={() => {
                  setPasswordError(false);
                  refetch().then((result) => {
                    if (result.data && !result.data.success) {
                      setPasswordError(true);
                    }
                  });
                }}
              >
                View Report
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    // Check if expired or view limit reached
    if (errorMessage.includes('expired') || errorMessage.includes('view limit')) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {errorMessage.includes('expired') ? (
                <Clock className="w-8 h-8 text-red-500" />
              ) : (
                <Eye className="w-8 h-8 text-red-500" />
              )}
            </div>
            <h1 className="text-2xl font-sans font-bold text-[#1A1A1A] mb-2">
              {errorMessage.includes('expired') ? 'Link Expired' : 'View Limit Reached'}
            </h1>
            <p className="text-[#1A1A1A]/60 mb-6">
              {errorMessage.includes('expired') 
                ? 'This shared report link has expired and is no longer available.'
                : 'This shared report has reached its maximum number of views.'}
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              Go to Home
            </Button>
          </div>
        </div>
      );
    }
    
    // Generic error
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-sans font-bold text-[#1A1A1A] mb-2">
            Report Not Found
          </h1>
          <p className="text-[#1A1A1A]/60 mb-6">{errorMessage}</p>
          <Button variant="outline" onClick={() => setLocation('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // Check for successful response with data
  if (!data || !data.success || !('data' in data) || !data.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-[#1A1A1A]/70">No report data available</p>
        </div>
      </div>
    );
  }

  const reportInfo = data.data;

  // Parse the report data
  let reportData;
  try {
    reportData = typeof reportInfo.reportData === 'string' 
      ? JSON.parse(reportInfo.reportData) 
      : reportInfo.reportData;
  } catch (e) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-[#1A1A1A]/70">Failed to parse report data</p>
        </div>
      </div>
    );
  }

  // Render the appropriate report type
  if (reportInfo.reportType === 'full') {
    return (
      <FullPropertyReport
        data={reportData}
        onBack={() => setLocation('/')}
        shareId={shareId}
        isSharedView={true}
      />
    );
  }

  if (reportInfo.reportType === 'property') {
    return (
      <ChapterPropertyReport
        data={reportData}
        onBack={() => setLocation('/')}
        clientName="Shared Report"
      />
    );
  }

  // For market reports, check if it's Step 1 data or ChapterMarketReport data
  if (reportInfo.reportType === 'market') {
    // Check if this is Step 1 market data (has marketName, avgRevenue, etc.)
    if (reportData.marketName && reportData.avgRevenue !== undefined) {
      return (
        <SharedMarketReport
          data={reportData}
          onBack={() => setLocation('/')}
        />
      );
    }
    
    // Otherwise, it's a ChapterMarketReport format
    const isSubmarket = reportData.submarket && !reportData.market;
    return (
      <ChapterMarketReport
        data={reportData}
        reportType={isSubmarket ? 'submarket' : 'market'}
        onBack={() => setLocation('/')}
        clientName="Shared Report"
      />
    );
  }

  // Fallback for unknown report types
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] to-[#f5f3f0]">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-[#1A1A1A]/70">Unknown report type: {reportInfo.reportType}</p>
      </div>
    </div>
  );
}
