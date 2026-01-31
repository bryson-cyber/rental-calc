/**
 * ModeSwitch - Global toggle between Rent (Arbitrage) and Purchase (Investor) modes
 * 
 * This switch changes the entire app experience:
 * - RENT mode: For rental arbitrage users who rent properties to sublet on Airbnb
 * - PURCHASE mode: For investors who buy properties for STR income
 * 
 * The mode affects:
 * - Property input fields (rent vs purchase price + financing)
 * - Calculators shown (break-even vs loan calculators)
 * - AI prompts and analysis focus
 * - Zillow/Redfin data display (rentals vs for-sale)
 */

import { useProperty, type GlobalMode } from '@/contexts/PropertyContext';
import { Home, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeSwitchProps {
  className?: string;
  compact?: boolean;
}

export function ModeSwitch({ className, compact = false }: ModeSwitchProps) {
  const { globalMode, setGlobalMode } = useProperty();

  const handleModeChange = (mode: GlobalMode) => {
    setGlobalMode(mode);
  };

  if (compact) {
    // Compact version for mobile or tight spaces
    return (
      <div className={cn("flex items-center gap-1 bg-gray-100 rounded-lg p-1", className)}>
        <button
          onClick={() => handleModeChange('rent')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            globalMode === 'rent'
              ? "bg-white text-[#C9A962] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Home className="w-4 h-4" />
          <span>Rent</span>
        </button>
        <button
          onClick={() => handleModeChange('purchase')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            globalMode === 'purchase'
              ? "bg-white text-[#C9A962] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Buy</span>
        </button>
      </div>
    );
  }

  // Full version with descriptions
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        I want to...
      </div>
      <div className="flex items-stretch gap-3">
        {/* Rent Mode */}
        <button
          onClick={() => handleModeChange('rent')}
          className={cn(
            "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
            globalMode === 'rent'
              ? "border-[#C9A962] bg-[#C9A962]/5"
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            globalMode === 'rent'
              ? "bg-[#C9A962]/20"
              : "bg-gray-100"
          )}>
            <Home className={cn(
              "w-6 h-6",
              globalMode === 'rent' ? "text-[#C9A962]" : "text-gray-500"
            )} />
          </div>
          <div className="text-center">
            <div className={cn(
              "font-semibold",
              globalMode === 'rent' ? "text-[#C9A962]" : "text-gray-700"
            )}>
              Rent a Property
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Rental Arbitrage
            </div>
          </div>
          {globalMode === 'rent' && (
            <div className="w-2 h-2 rounded-full bg-[#C9A962]" />
          )}
        </button>

        {/* Purchase Mode */}
        <button
          onClick={() => handleModeChange('purchase')}
          className={cn(
            "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
            globalMode === 'purchase'
              ? "border-[#C9A962] bg-[#C9A962]/5"
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            globalMode === 'purchase'
              ? "bg-[#C9A962]/20"
              : "bg-gray-100"
          )}>
            <Building2 className={cn(
              "w-6 h-6",
              globalMode === 'purchase' ? "text-[#C9A962]" : "text-gray-500"
            )} />
          </div>
          <div className="text-center">
            <div className={cn(
              "font-semibold",
              globalMode === 'purchase' ? "text-[#C9A962]" : "text-gray-700"
            )}>
              Buy a Property
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Investment Purchase
            </div>
          </div>
          {globalMode === 'purchase' && (
            <div className="w-2 h-2 rounded-full bg-[#C9A962]" />
          )}
        </button>
      </div>
      
      {/* Mode description */}
      <div className="text-xs text-gray-500 text-center mt-1">
        {globalMode === 'rent' ? (
          "Analyze properties you can rent and sublet on Airbnb"
        ) : (
          "Analyze properties you want to buy for short-term rental income"
        )}
      </div>
    </div>
  );
}

// Hook to get mode-specific labels and configurations
export function useModeConfig() {
  const { globalMode } = useProperty();
  
  const config = {
    rent: {
      title: "Rental Arbitrage",
      subtitle: "Rent & Sublet",
      propertyInputLabel: "Monthly Rent",
      propertyInputPlaceholder: "Enter monthly rent",
      propertyInputPrefix: "$",
      propertyInputSuffix: "/mo",
      calculatorType: "break-even" as const,
      zillowFilter: "rent" as const,
      primaryMetric: "Break-even Occupancy",
      primaryMetricDescription: "Minimum occupancy needed to cover rent",
      ctaText: "Calculate Profit",
      heroTitle: "Rental Arbitrage Calculator",
      heroSubtitle: "See if you can profit by renting this property and listing it on Airbnb",
    },
    purchase: {
      title: "Investment Purchase",
      subtitle: "Buy & Earn",
      propertyInputLabel: "Purchase Price",
      propertyInputPlaceholder: "Enter purchase price",
      propertyInputPrefix: "$",
      propertyInputSuffix: "",
      calculatorType: "loan" as const,
      zillowFilter: "sale" as const,
      primaryMetric: "Cash-on-Cash Return",
      primaryMetricDescription: "Annual return on your cash invested",
      ctaText: "Analyze Investment",
      heroTitle: "Investment Calculator",
      heroSubtitle: "See if this property is a good investment for short-term rental income",
    },
  };
  
  return {
    mode: globalMode,
    isRentMode: globalMode === 'rent',
    isPurchaseMode: globalMode === 'purchase',
    ...config[globalMode],
  };
}

export default ModeSwitch;
