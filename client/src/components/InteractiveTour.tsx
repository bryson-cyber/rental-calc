/**
 * InteractiveTour Component
 * 
 * A hands-on guided tour that:
 * 1. Navigates to actual tools
 * 2. Highlights real UI elements
 * 3. Auto-fills sample data
 * 4. Shows what results look like
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
  const tourSteps: TourStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Coach Inayah\'s Tools!',
      description: 'I\'ll walk you through each tool so you can see exactly how to analyze rental properties like a pro. Let\'s start with finding opportunities!',
      position: 'center',
    },
    {
      id: 'opportunity-intro',
      title: 'Step 1: Find Opportunities',
      description: 'The Opportunity Finder helps you discover properties in any market. Let me show you how it works.',
      position: 'center',
      action: () => onNavigateToTab('opportunity'),
    },
    {
      id: 'opportunity-search',
      targetSelector: '[data-tour="opportunity-search"]',
      title: 'Search Any Location',
      description: 'Type a city, zip code, or neighborhood to find rental opportunities. Try "Denver, CO" or any market you\'re interested in.',
      position: 'bottom',
      waitForElement: true,
    },
    {
      id: 'validate-intro',
      title: 'Step 2: Validate a Property',
      description: 'Found a property you like? The Validator shows you exactly how much it could earn. Let me demonstrate.',
      position: 'center',
      action: () => onNavigateToTab('validate'),
    },
    {
      id: 'validate-address',
      targetSelector: '[data-tour="address-input"]',
      title: 'Enter the Property Address',
      description: 'Paste any address, Zillow link, or Redfin link here. I\'ll show you with a sample property in Denver.',
      position: 'bottom',
      waitForElement: true,
      showSampleData: true,
    },
    {
      id: 'validate-details',
      targetSelector: '[data-tour="property-details"]',
      title: 'Add Property Details',
      description: 'Enter the bedrooms, bathrooms, and your expected rent. This helps calculate accurate projections.',
      position: 'bottom',
      waitForElement: true,
    },
    {
      id: 'validate-button',
      targetSelector: '[data-tour="analyze-button"]',
      title: 'Run the Analysis',
      description: 'Click "Analyze Property" to see projected revenue, occupancy rates, and profit margins. The AI will tell you if it\'s a good deal!',
      position: 'top',
      waitForElement: true,
    },
    {
      id: 'compare-intro',
      title: 'Step 3: Compare Properties',
      description: 'Comparing multiple properties? The Compare tool lets you see them side-by-side to find the best deal.',
      position: 'center',
      action: () => onNavigateToTab('compare'),
    },
    {
      id: 'compare-add',
      targetSelector: '[data-tour="compare-add"]',
      title: 'Add Properties to Compare',
      description: 'Add 2-5 properties to compare their revenue potential, occupancy, and profit margins side by side.',
      position: 'bottom',
      waitForElement: true,
    },
    {
      id: 'map-intro',
      title: 'Step 4: Explore the Map',
      description: 'The Map View shows you all active rentals in an area. See what\'s actually performing well nearby.',
      position: 'center',
      action: () => onNavigateToTab('map'),
    },
    {
      id: 'map-explore',
      targetSelector: '[data-tour="map-container"]',
      title: 'Explore Listings',
      description: 'Click on any marker to see that property\'s revenue, occupancy, and reviews. Great for finding comps!',
      position: 'top',
      waitForElement: true,
    },
    {
      id: 'advisor-intro',
      title: 'Step 5: Ask the AI Advisor',
      description: 'Have questions? The AI Advisor can analyze your data and give personalized recommendations.',
      position: 'center',
      action: () => onNavigateToTab('advisor'),
    },
    {
      id: 'advisor-chat',
      targetSelector: '[data-tour="advisor-input"]',
      title: 'Ask Anything',
      description: 'Ask questions like "Is this property profitable?" or "What\'s the best bedroom count for this market?" The AI uses real data to answer.',
      position: 'top',
      waitForElement: true,
    },
    {
      id: 'regulations-intro',
      title: 'Bonus: Check Regulations',
      description: 'Before you invest, always check local STR regulations. This tool shows permit requirements, restrictions, and recent changes.',
      position: 'center',
      action: () => onNavigateToTab('regulations'),
    },
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
