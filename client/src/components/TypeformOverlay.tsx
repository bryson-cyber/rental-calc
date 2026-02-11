import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, RefreshCw } from 'lucide-react';

interface TypeformOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    tf?: {
      createWidget?: (formId: string, options: Record<string, unknown>) => unknown;
    };
  }
}

// Helper to check if Typeform is ready
const isTypeformReady = (): boolean => {
  return !!(window.tf && typeof window.tf.createWidget === 'function');
};

export function TypeformOverlay({ isOpen, onComplete, onClose }: TypeformOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const widgetRef = useRef<any>(null);
  const maxRetries = 50; // 5 seconds max wait (50 * 100ms)

  const loadTypeformScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already ready
      if (isTypeformReady()) {
        resolve();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="embed.typeform.com"]');
      
      // Remove existing broken script if any
      if (existingScript) {
        existingScript.remove();
      }

      // Create new script
      const script = document.createElement('script');
      script.src = 'https://embed.typeform.com/next/embed.js';
      script.async = true;
      
      script.onload = () => {
        // Give it a moment to initialize
        setTimeout(() => {
          if (isTypeformReady()) {
            resolve();
          } else {
            reject(new Error('Typeform SDK not initialized after script load'));
          }
        }, 500);
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Typeform script'));
      };
      
      document.body.appendChild(script);
    });
  };

  const initTypeform = async () => {
    if (!containerRef.current) return;
    
    setIsLoading(true);
    setHasError(false);
    
    try {
      // Ensure script is loaded
      await loadTypeformScript();
      
      // Wait for tf to be available with retries
      let attempts = 0;
      while (!isTypeformReady() && attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!isTypeformReady()) {
        throw new Error('Typeform SDK not available');
      }
      
      // Clear any existing content
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      // Create the Typeform widget
      widgetRef.current = window.tf!.createWidget!('01KCZZ7Y52BX70D9HAH8WJGH3F', {
        container: containerRef.current,
        opacity: 0,
        hideHeaders: true,
        hideFooter: true,
        onSubmit: () => {
          // Small delay to show thank you screen
          setTimeout(() => {
            onComplete();
          }, 2000);
        },
        onReady: () => {
          setIsLoading(false);
        }
      });
      
      // Fallback: if onReady doesn't fire within 3 seconds, assume it's ready
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
      
    } catch (error) {
      console.error('Typeform initialization error:', error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
      return;
    }

    initTypeform();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      widgetRef.current = null;
    };
  }, [isOpen, onComplete, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleSkip = () => {
    // Allow user to skip the form in case of persistent errors
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal container */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#C9A962] to-[#D4B87A] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Unlock Your Full Analysis
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Complete this quick form to access your personalized report
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
        
        {/* Typeform container */}
        <div className="relative" style={{ height: '500px' }}>
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FDF8F5]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[#C9A962] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600">Loading form...</p>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FDF8F5]">
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <AlertCircle className="w-12 h-12 text-amber-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Form Loading Issue
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    We're having trouble loading the form. This might be due to a slow connection or ad blocker.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-[#C9A962] text-white rounded-lg hover:bg-[#B89952] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div 
            ref={containerRef} 
            className="w-full h-full"
            style={{ minHeight: '500px', display: hasError ? 'none' : 'block' }}
          />
        </div>
        
        {/* Footer */}
        <div className="bg-[#FDF8F5] px-6 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Your information is secure and will never be shared. Powered by Coach Inayah.
          </p>
        </div>
      </div>
    </div>
  );
}
