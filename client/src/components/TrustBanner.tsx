import { Shield } from 'lucide-react';

/**
 * Persistent trust banner showing data source credibility
 * Displays at the bottom of the viewport, always visible
 * Light theme to match site's Apple-inspired aesthetic
 */
export function TrustBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <Shield className="w-4 h-4 text-[#C9A962]" />
        <span className="text-gray-500 text-sm font-sans">
          Powered by
        </span>
        <div className="flex items-center gap-3">
          <img 
            src="/images/airbnb-logo.png" 
            alt="Airbnb" 
            className="h-5 object-contain"
          />
          <span className="text-gray-400 text-sm">&</span>
          <img 
            src="/images/vrbo-logo.png" 
            alt="VRBO" 
            className="h-5 object-contain"
          />
        </div>
        <span className="text-gray-500 text-sm font-sans">
          performance data
        </span>
      </div>
    </div>
  );
}
