/**
 * TourSpotlight Component
 * 
 * Creates a spotlight effect that highlights specific UI elements during the tour.
 * Uses a dark overlay with a "hole" cut out around the target element.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourStep {
  id: string;
  targetSelector?: string; // CSS selector for element to highlight
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void; // Action to perform when reaching this step
  showSampleData?: boolean;
  waitForElement?: boolean; // Wait for element to appear before showing
}

interface TourSpotlightProps {
  steps: TourStep[];
  currentStep: number;
  isOpen: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TourSpotlight({
  steps,
  currentStep,
  isOpen,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}: TourSpotlightProps) {
  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Find and highlight the target element
  useEffect(() => {
    if (!isOpen || !step) return;

    const findElement = () => {
      if (!step.targetSelector) {
        // No target - center the tooltip
        setSpotlightPosition(null);
        setTooltipPosition({
          top: window.innerHeight / 2 - 150,
          left: window.innerWidth / 2 - 200,
        });
        return true;
      }

      const element = document.querySelector(step.targetSelector);
      if (!element) {
        if (step.waitForElement) {
          return false; // Keep trying
        }
        // Element not found, center tooltip
        setSpotlightPosition(null);
        setTooltipPosition({
          top: window.innerHeight / 2 - 150,
          left: window.innerWidth / 2 - 200,
        });
        return true;
      }

      const rect = element.getBoundingClientRect();
      const padding = 8;

      setSpotlightPosition({
        top: rect.top - padding + window.scrollY,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate tooltip position based on step.position
      const tooltipWidth = 320;
      const tooltipHeight = 200;
      let top = 0;
      let left = 0;

      switch (step.position || 'bottom') {
        case 'top':
          top = rect.top - tooltipHeight - 20 + window.scrollY;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + 20 + window.scrollY;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
          left = rect.left - tooltipWidth - 20;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
          left = rect.right + 20;
          break;
        case 'center':
          top = window.innerHeight / 2 - tooltipHeight / 2;
          left = window.innerWidth / 2 - tooltipWidth / 2;
          break;
      }

      // Keep tooltip within viewport
      left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));
      top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20 + window.scrollY));

      setTooltipPosition({ top, left });

      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return true;
    };

    // Execute step action if defined
    if (step.action) {
      step.action();
    }

    // Try to find element immediately
    if (!findElement() && step.waitForElement) {
      // Retry with interval
      const interval = setInterval(() => {
        if (findElement()) {
          clearInterval(interval);
        }
      }, 200);

      return () => clearInterval(interval);
    }

    // Update position on resize/scroll
    const handleUpdate = () => findElement();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, step, currentStep]);

  if (!isOpen || !step) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Dark overlay with spotlight hole */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          style={{ height: document.documentElement.scrollHeight }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightPosition && (
                <rect
                  x={spotlightPosition.left}
                  y={spotlightPosition.top}
                  width={spotlightPosition.width}
                  height={spotlightPosition.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border glow */}
        {spotlightPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute rounded-lg border-2 border-amber-500 shadow-[0_0_20px_rgba(201,169,98,0.5)] pointer-events-none"
            style={{
              top: spotlightPosition.top,
              left: spotlightPosition.left,
              width: spotlightPosition.width,
              height: spotlightPosition.height,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bg-white rounded-xl shadow-2xl p-5 w-80 pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            zIndex: 10000,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">{step.description}</p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-amber-500'
                    : index < currentStep
                    ? 'bg-amber-300'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={isFirstStep}
              className="text-slate-600"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-slate-400"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip Tour
            </Button>

            <Button
              size="sm"
              onClick={isLastStep ? onComplete : onNext}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export type { TourStep };
