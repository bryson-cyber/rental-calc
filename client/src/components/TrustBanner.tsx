import { Shield } from 'lucide-react';

/**
 * Persistent trust banner showing data source credibility
 * Displays at the bottom of the viewport, always visible
 */
export function TrustBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A] border-t border-[#C9A962]/20 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <Shield className="w-4 h-4 text-[#C9A962]" />
        <span className="text-white/70 text-sm font-sans">
          Powered by
        </span>
        <div className="flex items-center gap-3">
          <img 
            src="/images/airbnb-logo.png" 
            alt="Airbnb" 
            className="h-5 object-contain opacity-90"
          />
          <span className="text-white/50 text-sm">&</span>
          <img 
            src="/images/vrbo-logo.png" 
            alt="VRBO" 
            className="h-5 object-contain opacity-90"
          />
        </div>
        <span className="text-white/70 text-sm font-sans">
          performance data
        </span>
      </div>
    </div>
  );
}
