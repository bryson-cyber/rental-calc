/**
 * Analysis Progress Component
 * 
 * Displays real-time progress during property analysis with
 * animated steps, progress bar, and estimated time remaining.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle, 
  Circle,
  Clock,
  Home,
  BarChart3,
  Users,
  ImageIcon,
  Calendar,
  History,
  Brain,
  FileText,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { 
  type ProgressState, 
  type ProgressStep,
  formatTimeRemaining 
} from '@/hooks/useAnalysisProgress';
import { useState, useEffect } from 'react';

interface AnalysisProgressProps {
  progress: ProgressState | null;
  address: string;
  monthlyRent: number;
}

// Map step IDs to icons
const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  property: Home,
  market: BarChart3,
  competitors: Users,
  images: ImageIcon,
  seasonality: Calendar,
  historical: History,
  ai_analysis: Brain,
  narrative: FileText,
  enhanced: Sparkles,
  finalize: CheckCheck,
};

// Get icon component for a step
function getStepIcon(stepId: string) {
  return stepIcons[stepId] || Circle;
}

// Get status icon
function StatusIcon({ status }: { status: ProgressStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'in-progress':
      return <Loader2 className="w-5 h-5 text-[#C9A962] animate-spin" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <Circle className="w-5 h-5 text-white/30" />;
  }
}

export default function AnalysisProgress({ progress, address, monthlyRent }: AnalysisProgressProps) {
  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Timer effect
  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Default steps for initial display (before SSE connects)
  const defaultSteps: ProgressStep[] = [
    { id: 'property', label: 'Analyzing property details', status: 'pending' },
    { id: 'market', label: 'Fetching market data', status: 'pending' },
    { id: 'competitors', label: 'Finding comparable properties', status: 'pending' },
    { id: 'seasonality', label: 'Analyzing seasonal trends', status: 'pending' },
    { id: 'historical', label: 'Processing historical data', status: 'pending' },
    { id: 'ai_analysis', label: 'Running AI analysis', status: 'pending' },
    { id: 'narrative', label: 'Generating narrative report', status: 'pending' },
    { id: 'enhanced', label: 'Creating enhanced insights', status: 'pending' },
    { id: 'finalize', label: 'Finalizing your report', status: 'pending' },
  ];

  const steps = progress?.steps || defaultSteps;
  const overallProgress = progress?.overallProgress || 0;
  const timeRemaining = formatTimeRemaining(progress?.estimatedTimeRemaining);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/hero-property.jpg)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/95 via-[#0F172A]/90 to-[#1e293b]/85" />
      </div>
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div 
          className="w-full max-w-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 bg-[#C9A962]/20 rounded-2xl mb-6 backdrop-blur-sm border border-[#C9A962]/30 relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="w-10 h-10 text-[#C9A962]" />
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-[#C9A962]/50"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            <h2 className="text-3xl font-serif font-semibold text-white mb-3">
              Building Your Analysis
            </h2>
            
            {/* Elapsed Time Counter */}
            <motion.div 
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4 border border-white/20"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Clock className="w-4 h-4 text-[#C9A962]" />
              <span className="text-white font-mono text-lg font-semibold">
                {formatElapsedTime(elapsedSeconds)}
              </span>
              <span className="text-white/50 text-sm">elapsed</span>
            </motion.div>
            
            <p className="text-white/60 font-sans text-sm mb-1">
              {address}
            </p>
            <p className="text-[#C9A962] font-sans text-sm">
              Monthly Rent: ${monthlyRent.toLocaleString()}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm font-sans">
                Overall Progress
              </span>
              <span className="text-[#C9A962] text-sm font-semibold font-sans">
                {overallProgress}%
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                className="h-full bg-gradient-to-r from-[#C9A962] to-[#d4b876] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            {timeRemaining && (
              <div className="flex items-center justify-end gap-1 mt-2">
                <Clock className="w-3 h-3 text-white/40" />
                <span className="text-white/40 text-xs font-sans">
                  {timeRemaining}
                </span>
              </div>
            )}
          </div>

          {/* Steps List */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {steps.map((step, idx) => {
                  const StepIcon = getStepIcon(step.id);
                  const isActive = step.status === 'in-progress';
                  const isCompleted = step.status === 'completed';
                  const isError = step.status === 'error';
                  
                  return (
                    <motion.div
                      key={step.id}
                      className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-[#C9A962]/10 border border-[#C9A962]/30' 
                          : isCompleted
                            ? 'bg-green-500/5'
                            : isError
                              ? 'bg-red-500/5'
                              : ''
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ 
                        opacity: step.status === 'pending' ? 0.5 : 1, 
                        x: 0 
                      }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      {/* Step Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isActive 
                          ? 'bg-[#C9A962]/20' 
                          : isCompleted
                            ? 'bg-green-500/20'
                            : isError
                              ? 'bg-red-500/20'
                              : 'bg-white/5'
                      }`}>
                        <StepIcon className={`w-5 h-5 ${
                          isActive 
                            ? 'text-[#C9A962]' 
                            : isCompleted
                              ? 'text-green-500'
                              : isError
                                ? 'text-red-400'
                                : 'text-white/30'
                        }`} />
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          isActive 
                            ? 'text-white' 
                            : isCompleted
                              ? 'text-white/80'
                              : isError
                                ? 'text-red-300'
                                : 'text-white/50'
                        }`}>
                          {step.label}
                        </p>
                        {step.detail && (
                          <p className={`text-xs mt-0.5 ${
                            isActive ? 'text-[#C9A962]' : 'text-white/40'
                          }`}>
                            {step.detail}
                          </p>
                        )}
                        {step.error && (
                          <p className="text-xs mt-0.5 text-red-400">
                            {step.error}
                          </p>
                        )}
                      </div>

                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        <StatusIcon status={step.status} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Message */}
          <p className="mt-6 text-center text-white/40 text-xs font-sans">
            This comprehensive analysis typically takes 1-2 minutes. Please don't refresh the page.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
