import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  BookOpen, 
  Shield, 
  DollarSign, 
  Search, 
  Target, 
  Trophy, 
  Map, 
  Sparkles,
  GraduationCap,
  Play,
  SkipForward,
  CheckCircle2,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// Tool descriptions for the tour
const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Coach Inayah\'s Research Tools!',
    description: 'This quick tour will show you how to use each tool to analyze rental properties like a pro. You can skip anytime or restart later.',
    icon: GraduationCap,
    tip: 'Each tool answers a specific question in your investment journey.',
    tabId: null,
  },
  {
    id: 'ebook',
    title: 'Step 0: Read the Guide',
    description: 'Start here to learn the fundamentals of Airbnb arbitrage. This guide teaches you everything you need to know before using the analysis tools.',
    icon: BookOpen,
    tip: 'New to short-term rentals? This guide is your foundation.',
    tabId: 'ebook',
    question: 'How does this business actually work?'
  },
  {
    id: 'regulations',
    title: 'Step 1: Check Regulations',
    description: 'Before investing in any market, check if short-term rentals are legally allowed. This tool shows local STR regulations and restrictions.',
    icon: Shield,
    tip: 'Always check regulations first - some cities ban or heavily restrict STRs.',
    tabId: 'regulations',
    question: 'Can I legally operate here?'
  },
  {
    id: 'opportunity',
    title: 'Step 2: Find a Property',
    description: 'Browse available rentals on Zillow and instantly validate their STR profit potential. Search by city or zip code to find arbitrage opportunities.',
    icon: Search,
    tip: 'Look for properties with rent under $2,000/month for best profit margins.',
    tabId: 'opportunity',
    question: 'What properties are available to lease?'
  },
  {
    id: 'prove',
    title: 'Step 3: See Real Revenue',
    description: 'View actual Airbnb earnings data from any market. See what hosts are really making before you invest time researching properties.',
    icon: DollarSign,
    tip: 'Look for markets where average revenue is 2-3x the typical rent.',
    tabId: 'prove',
    question: 'How much do hosts actually make here?'
  },
  {
    id: 'find',
    title: 'Step 4: Explore Listings',
    description: 'Browse active rentals and see what\'s working in any area. Find successful properties to understand what success looks like.',
    icon: Search,
    tip: 'Study top performers to understand what amenities and styles work best.',
    tabId: 'find',
    question: 'What properties are succeeding here?'
  },
  {
    id: 'validate',
    title: 'Step 5: Validate the Deal',
    description: 'Found a property you like? Enter the exact address and rent to see projected revenue, profit margins, and comparisons to nearby properties.',
    icon: Target,
    tip: 'Aim for properties with 30%+ profit margin after all expenses.',
    tabId: 'validate',
    question: 'Is this property worth it?'
  },
  {
    id: 'compare',
    title: 'Step 6: Compare Favorites',
    description: 'Compare your saved properties side-by-side to find which one will make you the most money. See them ranked by profit potential.',
    icon: Trophy,
    tip: 'Save properties from the Map view, then compare them here.',
    tabId: 'compare',
    question: 'Which of my saved properties is the best deal?'
  },
  {
    id: 'map',
    title: 'Step 7: See the Map',
    description: 'Visualize competitors and compare your property location. See where successful Airbnbs are clustered in your target area.',
    icon: Map,
    tip: 'Properties near attractions and downtown areas often perform better.',
    tabId: 'map',
    question: 'How does my property compare to nearby competition?'
  },
  {
    id: 'advisor',
    title: 'Step 8-9: AI Advisors',
    description: 'Get personalized AI-powered insights for your specific property or market. Ask questions and get expert analysis based on real data.',
    icon: Sparkles,
    tip: 'The AI uses your actual analysis data to give personalized advice.',
    tabId: 'advisor',
    question: 'What should I do next?'
  },
  {
    id: 'complete',
    title: 'You\'re Ready to Start!',
    description: 'You now know how to use all the tools. Start with the Guide if you\'re new, or jump straight to validating a property you\'ve found.',
    icon: CheckCircle2,
    tip: 'Pro tip: Use the sample data buttons to practice with each tool first.',
    tabId: null,
  }
];

interface OnboardingTourProps {
  onComplete: () => void;
  onNavigateToTab: (tabId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingTour({ onComplete, onNavigateToTab, isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  // Check if user has seen the tour before
  useEffect(() => {
    const seen = localStorage.getItem('onboarding-tour-completed');
    setHasSeenTour(seen === 'true');
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      // Navigate to the tool tab if applicable
      const nextStep = TOUR_STEPS[currentStep + 1];
      if (nextStep.tabId) {
        onNavigateToTab(nextStep.tabId);
      }
    } else {
      handleComplete();
    }
  }, [currentStep, onNavigateToTab]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      const prevStep = TOUR_STEPS[currentStep - 1];
      if (prevStep.tabId) {
        onNavigateToTab(prevStep.tabId);
      }
    }
  }, [currentStep, onNavigateToTab]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('onboarding-tour-completed', 'true');
    setHasSeenTour(true);
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('onboarding-tour-completed', 'true');
    setHasSeenTour(true);
    onClose();
  }, [onClose]);

  const handleJumpToStep = useCallback((index: number) => {
    setCurrentStep(index);
    const step = TOUR_STEPS[index];
    if (step.tabId) {
      onNavigateToTab(step.tabId);
    }
  }, [onNavigateToTab]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={handleSkip}
          />

          {/* Tour Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-[101] flex flex-col"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Progress Bar */}
              <div className="h-1 bg-gray-100">
                <motion.div
                  className="h-full bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-[oklch(0.65_0.14_75)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                  <span className="text-sm font-medium text-gray-600">
                    Training Tour
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {currentStep + 1} of {TOUR_STEPS.length}
                  </span>
                  <button
                    onClick={handleSkip}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close tour"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.14_75)] flex items-center justify-center shadow-lg">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-gray-900 text-center mb-3">
                    {step.title}
                  </h2>

                  {/* Question Badge */}
                  {'question' in step && step.question && (
                    <div className="flex justify-center mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[oklch(0.55_0.14_75)]/10 text-[oklch(0.45_0.14_75)] text-sm font-medium rounded-full">
                        <Lightbulb className="w-3.5 h-3.5" />
                        {step.question}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-gray-600 text-center leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* Tip Box */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-800 mb-1">Pro Tip</p>
                        <p className="text-sm text-amber-700">{step.tip}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Step Indicators */}
              <div className="px-6 py-3 border-t border-gray-100">
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {TOUR_STEPS.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleJumpToStep(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentStep
                          ? 'bg-[oklch(0.55_0.14_75)] w-6'
                          : index < currentStep
                          ? 'bg-[oklch(0.55_0.14_75)]/40'
                          : 'bg-gray-200'
                      }`}
                      aria-label={`Go to step ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="text-gray-500"
                  >
                    <SkipForward className="w-4 h-4 mr-1" />
                    Skip Tour
                  </Button>
                  
                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.50_0.14_75)] text-white gap-1"
                  >
                    {currentStep === TOUR_STEPS.length - 1 ? (
                      <>
                        <Play className="w-4 h-4" />
                        Start Using Tools
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [showTour, setShowTour] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('onboarding-tour-completed');
    if (!hasSeenTour) {
      setIsFirstVisit(true);
      // Auto-show tour for first-time visitors after a short delay
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem('onboarding-tour-completed');
    setIsFirstVisit(true);
    setShowTour(true);
  }, []);

  return {
    showTour,
    isFirstVisit,
    startTour,
    closeTour,
    resetTour,
  };
}

// Welcome Modal for first-time users
interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ isOpen, onStartTour, onSkip }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-[101]"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header Image/Gradient */}
              <div className="h-32 bg-gradient-to-br from-[oklch(0.55_0.14_75)] via-[oklch(0.50_0.14_75)] to-[oklch(0.45_0.12_60)] flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="p-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to Coach Inayah's Tools!
                </h2>
                <p className="text-gray-600 mb-6">
                  First time here? Take a quick 2-minute tour to learn how each tool helps you analyze rental properties and make confident investment decisions.
                </p>

                {/* Benefits */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: Target, label: 'Validate Deals' },
                    { icon: DollarSign, label: 'See Revenue' },
                    { icon: Sparkles, label: 'AI Insights' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-xl">
                      <Icon className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                      <span className="text-xs text-gray-600 font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={onStartTour}
                    className="w-full bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.50_0.14_75)] text-white"
                    size="lg"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Quick Tour (2 min)
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={onSkip}
                    className="w-full text-gray-500"
                  >
                    Skip for now - I'll explore on my own
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
