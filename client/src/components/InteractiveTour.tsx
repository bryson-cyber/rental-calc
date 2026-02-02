/**
 * InteractiveTour Component
 * 
 * A hands-on guided tour that:
 * 1. Navigates to actual tools
 * 2. Highlights real UI elements
 * 3. Auto-fills sample data
 * 4. Shows what results look like
 * 
 * CORRECT TAB IDs (from LeadMagnet.tsx TabType):
 * - 'ebook' = Read the Guide (GUIDE)
 * - 'regulations' = Check Regulations (STEP 1)
 * - 'opportunity' = Find a Property (STEP 2)
 * - 'prove' = See Real Revenue (STEP 3) - has MarketAutocomplete
 * - 'find' = Explore Listings (STEP 4)
 * - 'validate' = Validate the Deal (STEP 5) - has address input, property details
 * - 'compare' = Compare Favorites (STEP 6)
 * - 'map' = See the Map (STEP 7)
 * - 'market' = Market Advisor (STEP 8)
 * - 'advisor' = AI Advisor (STEP 9)
 */

import { useState, useEffect, useCallback } from 'react';
import { TourSpotlight, type TourStep } from './TourSpotlight';
import { WelcomeModal } from './OnboardingTour';

// Sample data for the tour
export const TOUR_SAMPLE_DATA = {
  property: {
    address: '1847 Market St, Denver, CO 80202',
    bedrooms: '3',
    bathrooms: '2',
    monthlyRent: '2800',
  },
  market: {
    searchQuery: 'Denver, CO',
    marketId: 'airdna-163',
  },
};

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigateToTab: (tabId: string) => void;
  onFillSampleData?: (data: typeof TOUR_SAMPLE_DATA) => void;
  currentTab: string;
}

export function InteractiveTour({
  isOpen,
  onClose,
  onComplete,
  onNavigateToTab,
  onFillSampleData,
  currentTab,
}: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [tourStarted, setTourStarted] = useState(false);

  // Define tour steps with actual UI element selectors
  // Using correct tab IDs from LeadMagnet.tsx
  const tourSteps: TourStep[] = [
    // Step 0: Welcome
    {
      id: 'welcome',
      title: 'Welcome to Coach Inayah\'s Tools!',
      description: 'I\'ll walk you through each tool so you can see exactly how to analyze rental properties like a pro. Let\'s start!',
      position: 'center',
    },
    // Step 1: Guide intro - use 'ebook' tab
    {
      id: 'guide-intro',
      title: 'Start with the Guide',
      description: 'New to rental arbitrage? Start here! The guide teaches you the fundamentals before diving into the analysis tools.',
      position: 'center',
      action: () => onNavigateToTab('ebook'),
    },
    // Step 2: Navigate to "find" tab (Explore Listings - STEP 4)
    {
      id: 'find-intro',
      title: 'See What\'s Working',
      description: 'This tool shows you real Airbnb properties that are actually making money. Let\'s search a market!',
      position: 'center',
      action: () => onNavigateToTab('find'),
    },
    // Step 3: Highlight the search input in "find" tab
    {
      id: 'find-search',
      targetSelector: '[data-tour="opportunity-search"]',
      title: 'Search Any Market',
      description: 'Type a city, zip code, or neighborhood to see successful Airbnb properties. Try "Denver, CO" or any market you\'re interested in.',
      position: 'bottom',
      waitForElement: true,
    },
    // Step 4: Navigate to "validate" tab (Validate the Deal - STEP 5)
    {
      id: 'validate-intro',
      title: 'Validate a Property',
      description: 'Found a property you like? The Validator shows you exactly how much it could earn. Let me demonstrate.',
      position: 'center',
      action: () => onNavigateToTab('validate'),
    },
    // Step 5: Highlight address input
    {
      id: 'validate-address',
      targetSelector: '[data-tour="address-input"]',
      title: 'Enter the Property Address',
      description: 'Paste any address, Zillow link, or Redfin link here. I\'ll fill in a sample property in Denver to show you.',
      position: 'bottom',
      waitForElement: true,
      showSampleData: true,
    },
    // Step 6: Highlight property details
    {
      id: 'validate-details',
      targetSelector: '[data-tour="property-details"]',
      title: 'Add Property Details',
      description: 'Enter the bedrooms, bathrooms, and your expected rent. This helps calculate accurate projections.',
      position: 'bottom',
      waitForElement: true,
    },
    // Step 7: Highlight analyze button
    {
      id: 'validate-button',
      targetSelector: '[data-tour="analyze-button"]',
      title: 'Run the Analysis',
      description: 'Click "Analyze Property" to see projected revenue, occupancy rates, and profit margins. The AI will tell you if it\'s a good deal!',
      position: 'top',
      waitForElement: true,
    },
    // Step 8: Navigate to "compare" tab
    {
      id: 'compare-intro',
      title: 'Compare Properties',
      description: 'Comparing multiple properties? The Compare tool lets you see them side-by-side to find the best deal.',
      position: 'center',
      action: () => onNavigateToTab('compare'),
    },
    // Step 9: Highlight compare section
    {
      id: 'compare-add',
      targetSelector: '[data-tour="compare-add"]',
      title: 'Add Properties to Compare',
      description: 'Add 2-5 properties to compare their revenue potential, occupancy, and profit margins side by side.',
      position: 'bottom',
      waitForElement: true,
    },
    // Step 10: Navigate to "map" tab
    {
      id: 'map-intro',
      title: 'Explore the Map',
      description: 'The Map View shows you all active rentals in an area. See what\'s actually performing well nearby.',
      position: 'center',
      action: () => onNavigateToTab('map'),
    },
    // Step 11: Highlight map container
    {
      id: 'map-explore',
      targetSelector: '[data-tour="map-container"]',
      title: 'Explore Listings',
      description: 'Click on any marker to see that property\'s revenue, occupancy, and reviews. Great for finding comps!',
      position: 'top',
      waitForElement: true,
    },
    // Step 12: Navigate to "advisor" tab (AI Advisor)
    {
      id: 'advisor-intro',
      title: 'Ask the AI Advisor',
      description: 'Have questions? The AI Advisor can analyze your data and give personalized recommendations.',
      position: 'center',
      action: () => onNavigateToTab('advisor'),
    },
    // Step 13: Highlight advisor input
    {
      id: 'advisor-chat',
      targetSelector: '[data-tour="advisor-input"]',
      title: 'Ask Anything',
      description: 'Ask questions like "Is this property profitable?" or "What\'s the best bedroom count for this market?" The AI uses real data to answer.',
      position: 'top',
      waitForElement: true,
    },
    // Step 14: Completion
    {
      id: 'complete',
      title: 'You\'re Ready to Go! 🎉',
      description: 'You now know how to use all the tools. Start by validating a property you\'re interested in, or explore markets to find opportunities. Good luck!',
      position: 'center',
      action: () => onNavigateToTab('validate'),
    },
  ];

  // Handle starting the tour
  const handleStartTour = useCallback(() => {
    setShowWelcome(false);
    setTourStarted(true);
    setCurrentStep(0);
  }, []);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, tourSteps.length]);

  // Handle previous step
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Handle skip/close
  const handleSkip = useCallback(() => {
    setTourStarted(false);
    setShowWelcome(false);
    onClose();
  }, [onClose]);

  // Handle complete
  const handleComplete = useCallback(() => {
    setTourStarted(false);
    onComplete();
  }, [onComplete]);

  // Fill sample data when reaching the validate step
  useEffect(() => {
    const step = tourSteps[currentStep];
    if (step?.showSampleData && onFillSampleData) {
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        onFillSampleData(TOUR_SAMPLE_DATA);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, onFillSampleData]);

  // Reset state when tour opens
  useEffect(() => {
    if (isOpen) {
      setShowWelcome(true);
      setTourStarted(false);
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Show welcome modal first
  if (showWelcome && !tourStarted) {
    return (
      <WelcomeModal
        isOpen={true}
        onStartTour={handleStartTour}
        onSkip={handleSkip}
      />
    );
  }

  // Show spotlight tour
  return (
    <TourSpotlight
      steps={tourSteps}
      currentStep={currentStep}
      isOpen={tourStarted}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={handleSkip}
      onComplete={handleComplete}
    />
  );
}

// Hook to manage tour state
export function useInteractiveTour() {
  const [showTour, setShowTour] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('coach-inayah-interactive-tour-complete');
    if (!hasCompletedTour) {
      setIsFirstVisit(true);
    }
  }, []);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem('coach-inayah-interactive-tour-complete', 'true');
    setShowTour(false);
    setIsFirstVisit(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem('coach-inayah-interactive-tour-complete');
    setIsFirstVisit(true);
  }, []);

  return {
    showTour,
    isFirstVisit,
    startTour,
    closeTour,
    completeTour,
    resetTour,
  };
}
