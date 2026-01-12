import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Home, BarChart3, MapPin, TrendingUp } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  steps: string[];
  example: string;
  color: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'one-home',
    title: 'One Home',
    icon: <Home className="w-6 h-6" />,
    description: 'Analyze a single property to see how much money it could make on Airbnb',
    steps: [
      'Enter the property address',
      'Enter the monthly rent you\'d pay',
      'Select number of bedrooms and bathrooms',
      'Click "Check This Home"',
      'See revenue, profit, and comparable properties'
    ],
    example: 'Example: A 2-bedroom home in Denver with $2,000/month rent could make $10,500/month',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'compare-many',
    title: 'Compare Many',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'Compare up to 25 properties side-by-side to find the best opportunity',
    steps: [
      'Add multiple property addresses (up to 25)',
      'Enter rent and bedroom/bathroom info for each',
      'Click "Compare Properties"',
      'See all properties ranked by profit',
      'Sort by Money Made, Profit, or Money vs Rent ratio'
    ],
    example: 'Example: Compare 5 properties in Austin to find which one makes the most profit',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'explore-area',
    title: 'Explore Area',
    icon: <MapPin className="w-6 h-6" />,
    description: 'See all Airbnb listings in an area and find what\'s working',
    steps: [
      'Enter a city or neighborhood',
      'Filter by number of bedrooms',
      'See all active Airbnb listings nearby',
      'Sort by "Most Money" or "Closest"',
      'Click any listing to view on Airbnb'
    ],
    example: 'Example: Explore Denver to see 50+ Airbnb listings and what they\'re earning',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'market-research',
    title: 'Market Research',
    icon: <TrendingUp className="w-6 h-6" />,
    description: 'Get instant market data and insights for any city',
    steps: [
      'Enter a city or market name',
      'Click "Get Market Data"',
      'See average revenue, occupancy rates, and trends',
      'Learn what property types perform best',
      'Understand seasonal patterns'
    ],
    example: 'Example: Research Miami to see average nightly rates and occupancy rates',
    color: 'from-orange-500 to-red-500'
  }
];

interface OnboardingTutorialProps {
  onDismiss: () => void;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onDismiss }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const tutorial = TUTORIAL_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setShowDetails(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setShowDetails(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('tutorialSeen', 'true');
    onDismiss();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Welcome to Your Free Tools
            </h1>
            <p className="text-lg text-slate-400">
              Learn how to analyze Airbnb opportunities in 5 minutes
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex gap-2 mb-3">
            {TUTORIAL_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStep(idx);
                  setShowDetails(false);
                }}
                className={`h-2 flex-1 rounded-full transition-all ${
                  idx === currentStep
                    ? `bg-gradient-to-r ${tutorial.color}`
                    : idx < currentStep
                    ? 'bg-slate-600'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-400">
            Tool {currentStep + 1} of {TUTORIAL_STEPS.length}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-8">
          {/* Card Header */}
          <div
            className={`bg-gradient-to-r ${tutorial.color} p-8 text-white`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                {tutorial.icon}
              </div>
              <h2 className="text-3xl font-bold">{tutorial.title}</h2>
            </div>
            <p className="text-lg text-white/90">{tutorial.description}</p>
          </div>

          {/* Card Content */}
          <div className="p-8">
            {!showDetails ? (
              // Overview
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">
                    How it works:
                  </h3>
                  <ol className="space-y-3">
                    {tutorial.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-700 text-white font-semibold">
                            {idx + 1}
                          </div>
                        </div>
                        <p className="text-slate-300 pt-1">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Example Box */}
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-2">Real Example:</p>
                  <p className="text-white">{tutorial.example}</p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => setShowDetails(true)}
                  className={`w-full bg-gradient-to-r ${tutorial.color} text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2`}
                >
                  See it in action
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Interactive Demo
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">
                    Try it now:
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Ready to use this tool? Click "Get Started" below to begin analyzing properties.
                  </p>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                    <p className="text-slate-400 text-sm mb-2">Pro Tip:</p>
                    <p className="text-white">
                      {tutorial.id === 'one-home' &&
                        'Start with a property you know well to see how accurate the estimates are.'}
                      {tutorial.id === 'compare-many' &&
                        'Compare properties in the same area for apples-to-apples comparison.'}
                      {tutorial.id === 'explore-area' &&
                        'Look for patterns in what\'s working - high ratings, specific amenities, etc.'}
                      {tutorial.id === 'market-research' &&
                        'Research your target market before looking for specific properties.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDetails(false)}
                  className="w-full bg-slate-700 text-white font-semibold py-3 rounded-lg hover:bg-slate-600 transition-all"
                >
                  Back to overview
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ← Previous
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-slate-400 hover:text-white font-semibold transition-colors"
            >
              Skip tutorial
            </button>
            <button
              onClick={currentStep === TUTORIAL_STEPS.length - 1 ? handleSkip : handleNext}
              className={`px-6 py-3 bg-gradient-to-r ${tutorial.color} text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2`}
            >
              {currentStep === TUTORIAL_STEPS.length - 1 ? 'Start using tools' : 'Next'} →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>You can always come back to this tutorial later</p>
        </div>
      </div>
    </div>
  );
};
