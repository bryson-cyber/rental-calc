/**
 * TourSpotlight Component
 * 
 * Creates a spotlight effect that highlights specific UI elements during the tour.
 * Uses a dark overlay with a "hole" cut out around the target element.
 * 
 * FIXED: Improved element detection with better retry logic and state management.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, SkipForward, Hand } from 'lucide-react';
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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isSearching, setIsSearching] = useState(false);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate tooltip position based on element rect and preferred position
  const calculateTooltipStyle = useCallback((rect: DOMRect | null, preferredPosition: string): React.CSSProperties => {
    const tooltipWidth = 340;
    const tooltipHeight = 220;
    const padding = 24;
    
    // Default centered position
    if (!rect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
      };
    }

    let style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10001,
    };

    switch (preferredPosition) {
      case 'top':
        // Position above the element
        if (rect.top > tooltipHeight + padding) {
          style.bottom = `${window.innerHeight - rect.top + padding}px`;
          style.left = `${Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20))}px`;
        } else {
          // Fallback to bottom if not enough space
          style.top = `${rect.bottom + padding}px`;
          style.left = `${Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20))}px`;
        }
        break;
      case 'bottom':
        // Position below the element
        if (window.innerHeight - rect.bottom > tooltipHeight + padding) {
          style.top = `${rect.bottom + padding}px`;
          style.left = `${Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20))}px`;
        } else {
          // Fallback to top if not enough space
          style.bottom = `${window.innerHeight - rect.top + padding}px`;
          style.left = `${Math.max(20, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20))}px`;
        }
        break;
      case 'left':
        style.top = `${Math.max(20, rect.top + rect.height / 2 - tooltipHeight / 2)}px`;
        style.right = `${window.innerWidth - rect.left + padding}px`;
        break;
      case 'right':
        style.top = `${Math.max(20, rect.top + rect.height / 2 - tooltipHeight / 2)}px`;
        style.left = `${rect.right + padding}px`;
        break;
      case 'center':
      default:
        style.top = '50%';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
        break;
    }

    return style;
  }, []);

  // Find element and update positions
  const updatePositions = useCallback(() => {
    if (!step) return false;

    // No target selector - center tooltip
    if (!step.targetSelector) {
      setSpotlightPosition(null);
      setTooltipStyle(calculateTooltipStyle(null, 'center'));
      return true;
    }

    const element = document.querySelector(step.targetSelector);
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    
    // Check if element is visible (has dimensions)
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    const padding = 12;

    // Set spotlight position (viewport-relative for fixed positioning)
    setSpotlightPosition({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate and set tooltip position
    setTooltipStyle(calculateTooltipStyle(rect, step.position || 'bottom'));

    return true;
  }, [step, calculateTooltipStyle]);

  // Clear any existing retry interval
  const clearRetryInterval = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  // Main effect: handle step changes
  useEffect(() => {
    if (!isOpen || !step) return;

    // Clear previous retry interval
    clearRetryInterval();
    retryCountRef.current = 0;

    // Reset state
    setSpotlightPosition(null);
    setIsSearching(!!step.targetSelector);

    // Execute step action if defined (e.g., navigate to tab)
    if (step.action) {
      step.action();
    }

    // Give time for React to render after action
    const initialDelay = step.action ? 600 : 100;

    const initialTimer = setTimeout(() => {
      // No target selector - just center the tooltip
      if (!step.targetSelector) {
        setTooltipStyle(calculateTooltipStyle(null, 'center'));
        setIsSearching(false);
        return;
      }

      // Try to find the element
      const element = document.querySelector(step.targetSelector);
      
      if (element) {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait for scroll, then update positions
        setTimeout(() => {
          updatePositions();
          setIsSearching(false);
        }, 400);
      } else {
        // Element not found - start retry loop
        retryIntervalRef.current = setInterval(() => {
          retryCountRef.current++;
          
          const el = document.querySelector(step.targetSelector!);
          if (el) {
            clearRetryInterval();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              updatePositions();
              setIsSearching(false);
            }, 400);
          } else if (retryCountRef.current > 30) {
            // Give up after 30 retries (7.5 seconds)
            clearRetryInterval();
            setSpotlightPosition(null);
            setTooltipStyle(calculateTooltipStyle(null, 'center'));
            setIsSearching(false);
          }
        }, 250);
      }
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      clearRetryInterval();
    };
  }, [isOpen, step, currentStep, updatePositions, calculateTooltipStyle, clearRetryInterval]);

  // Update position on resize/scroll
  useEffect(() => {
    if (!isOpen || !step?.targetSelector || isSearching) return;

    const handleUpdate = () => {
      updatePositions();
    };

    // Debounce scroll updates
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleUpdate, 50);
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isOpen, step, isSearching, updatePositions]);

  if (!isOpen || !step) return null;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
        {/* Dark overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/70"
          style={{ pointerEvents: 'auto' }}
          onClick={onSkip}
        />

        {/* Spotlight cutout - only show when element is found */}
        {spotlightPosition && (
          <>
            {/* Bright spotlight area - uses box-shadow trick for the "hole" effect */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="fixed bg-transparent rounded-xl"
              style={{
                top: spotlightPosition.top,
                left: spotlightPosition.left,
                width: spotlightPosition.width,
                height: spotlightPosition.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
                pointerEvents: 'none',
              }}
            />
            
            {/* Glowing border around spotlight */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="fixed rounded-xl pointer-events-none"
              style={{
                top: spotlightPosition.top - 3,
                left: spotlightPosition.left - 3,
                width: spotlightPosition.width + 6,
                height: spotlightPosition.height + 6,
                border: '3px solid rgb(251, 191, 36)',
                boxShadow: '0 0 30px 8px rgba(251, 191, 36, 0.4), inset 0 0 20px rgba(251, 191, 36, 0.1)',
              }}
            />

            {/* Pulsing hand pointer */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1.1, 1],
                y: [0, 0, -5, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              className="fixed pointer-events-none"
              style={{
                top: spotlightPosition.top + spotlightPosition.height + 8,
                left: spotlightPosition.left + spotlightPosition.width / 2 - 16,
              }}
            >
              <Hand className="w-8 h-8 text-amber-400 drop-shadow-lg" style={{ transform: 'rotate(-30deg)' }} />
            </motion.div>
          </>
        )}

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]"
          style={{
            ...tooltipStyle,
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">{step.description}</p>

          {/* Loading indicator when searching for element */}
          {isSearching && (
            <div className="flex items-center gap-2 text-amber-600 text-sm mb-4">
              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <span>Finding element...</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-5">
            <motion.div
              className="bg-amber-500 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={isFirstStep}
              className="text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-slate-400 hover:text-slate-600"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>

            <Button
              size="sm"
              onClick={isLastStep ? onComplete : onNext}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5"
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
