/**
 * BackToPropertyButton Component
 * 
 * A navigation button that appears in tool tabs when the user has a property
 * set in the My Property card. Allows easy navigation back to the Opportunity
 * Finder to continue researching the property.
 * 
 * Features:
 * - Shows property address for context
 * - Navigates back to Opportunity Finder
 * - Works whenever a property is set (not just from tool navigation)
 */

import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/contexts/PropertyContext';

interface BackToPropertyButtonProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function BackToPropertyButton({ className = '', variant = 'default' }: BackToPropertyButtonProps) {
  const { myProperty } = useProperty();
  
  // Only show if we have a property with an address
  if (!myProperty?.address) {
    return null;
  }
  
  const handleBackToProperty = () => {
    // Store the property address to scroll to in Opportunity Finder
    localStorage.setItem('scrollToProperty', myProperty.address);
    // Navigate to Opportunity Finder
    window.location.href = '/?tab=opportunity';
  };
  
  // Truncate address for compact display
  const shortAddress = myProperty.address.length > 40 
    ? myProperty.address.substring(0, 40) + '...'
    : myProperty.address;
  
  if (variant === 'compact') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleBackToProperty}
        className={`gap-2 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300 ${className}`}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Property</span>
        <span className="sm:hidden">Back</span>
      </Button>
    );
  }
  
  return (
    <div className={`flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg flex-shrink-0">
        <Home className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Analyzing Property</p>
        <p className="text-sm text-amber-900 font-medium truncate" title={myProperty.address}>
          {shortAddress}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleBackToProperty}
        className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-100 hover:border-amber-400 flex-shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Finder</span>
        <span className="sm:hidden">Back</span>
      </Button>
    </div>
  );
}

export default BackToPropertyButton;
