import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  Beaker, 
  X, 
  Sparkles,
  AlertTriangle,
  Play,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  SAMPLE_PROPERTY,
  SAMPLE_MARKET,
  SAMPLE_REVENUE_RESULT,
  SAMPLE_MARKET_RESEARCH,
  SAMPLE_LISTINGS,
  SAMPLE_REGULATIONS,
} from '@/data/sampleData';

// Training Mode Context
interface TrainingModeContextType {
  isTrainingMode: boolean;
  activeTool: string | null;
  enterTrainingMode: (tool: string) => void;
  exitTrainingMode: () => void;
  getSampleData: (tool: string) => any;
}

const TrainingModeContext = createContext<TrainingModeContextType | null>(null);

export function useTrainingMode() {
  const context = useContext(TrainingModeContext);
  if (!context) {
    throw new Error('useTrainingMode must be used within TrainingModeProvider');
  }
  return context;
}

// Provider Component
interface TrainingModeProviderProps {
  children: ReactNode;
}

export function TrainingModeProvider({ children }: TrainingModeProviderProps) {
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const enterTrainingMode = useCallback((tool: string) => {
    setIsTrainingMode(true);
    setActiveTool(tool);
    toast.success('Training Mode Activated', {
      description: 'You\'re now using sample data. Results shown are for demonstration only.',
      icon: <Beaker className="w-4 h-4" />,
    });
  }, []);

  const exitTrainingMode = useCallback(() => {
    setIsTrainingMode(false);
    setActiveTool(null);
    toast.info('Training Mode Deactivated', {
      description: 'You\'re now using real data.',
    });
  }, []);

  const getSampleData = useCallback((tool: string) => {
    switch (tool) {
      case 'validate':
        return {
          property: SAMPLE_PROPERTY,
          result: SAMPLE_REVENUE_RESULT,
        };
      case 'prove':
        return {
          market: SAMPLE_MARKET,
          result: SAMPLE_MARKET_RESEARCH,
        };
      case 'find':
      case 'explore':
        return {
          listings: SAMPLE_LISTINGS,
        };
      case 'regulations':
        return {
          regulations: SAMPLE_REGULATIONS,
        };
      default:
        return null;
    }
  }, []);

  return (
    <TrainingModeContext.Provider
      value={{
        isTrainingMode,
        activeTool,
        enterTrainingMode,
        exitTrainingMode,
        getSampleData,
      }}
    >
      {children}
      {/* Training Mode Banner */}
      <AnimatePresence>
        {isTrainingMode && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[90] bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 shadow-lg"
          >
            <div className="container max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Beaker className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold">Training Mode Active</span>
                  <span className="hidden sm:inline text-white/80 ml-2">
                    — Using sample data for demonstration
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={exitTrainingMode}
                className="text-white hover:bg-white/20"
              >
                <X className="w-4 h-4 mr-1" />
                Exit Training
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TrainingModeContext.Provider>
  );
}

// Sample Data Button Component
interface SampleDataButtonProps {
  tool: string;
  onLoadSampleData: (data: any) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function SampleDataButton({ 
  tool, 
  onLoadSampleData, 
  className = '',
  variant = 'default'
}: SampleDataButtonProps) {
  const { isTrainingMode, enterTrainingMode, getSampleData } = useTrainingMode();

  const handleClick = () => {
    const sampleData = getSampleData(tool);
    if (sampleData) {
      enterTrainingMode(tool);
      onLoadSampleData(sampleData);
    }
  };

  if (isTrainingMode) {
    return null; // Don't show button when already in training mode
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition-colors ${className}`}
      >
        <Beaker className="w-3.5 h-3.5" />
        Try Sample Data
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={handleClick}
        className={`text-amber-600 hover:text-amber-700 underline underline-offset-2 text-sm font-medium ${className}`}
      >
        or try with sample data
      </button>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Beaker className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 mb-1">New to this tool?</h4>
          <p className="text-sm text-amber-700 mb-3">
            Try it with sample data first to see how it works before entering your own property.
          </p>
          <Button
            onClick={handleClick}
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Load Sample Data
          </Button>
        </div>
      </div>
    </div>
  );
}

// Training Mode Indicator (shows in results)
interface TrainingModeIndicatorProps {
  className?: string;
}

export function TrainingModeIndicator({ className = '' }: TrainingModeIndicatorProps) {
  const { isTrainingMode, exitTrainingMode } = useTrainingMode();

  if (!isTrainingMode) return null;

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-medium text-amber-800">
            Training Mode — This is sample data for demonstration
          </span>
        </div>
        <button
          onClick={exitTrainingMode}
          className="text-xs text-amber-600 hover:text-amber-800 underline"
        >
          Use Real Data
        </button>
      </div>
    </div>
  );
}

// Restart Tour Button (for help section)
interface RestartTourButtonProps {
  onRestartTour: () => void;
  className?: string;
}

export function RestartTourButton({ onRestartTour, className = '' }: RestartTourButtonProps) {
  return (
    <button
      onClick={onRestartTour}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors ${className}`}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Restart Tour
    </button>
  );
}
