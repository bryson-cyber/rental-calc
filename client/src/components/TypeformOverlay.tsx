import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface TypeformOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    tf: {
      createWidget: (formId: string, options: any) => any;
    };
  }
}

export function TypeformOverlay({ isOpen, onComplete, onClose }: TypeformOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Wait for Typeform script to load
    const initTypeform = () => {
      if (window.tf && containerRef.current) {
        setIsLoading(false);
        
        // Clear any existing content
        containerRef.current.innerHTML = '';
        
        // Create the Typeform widget
        window.tf.createWidget('01KCZZ7Y52BX70D9HAH8WJGH3F', {
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
      } else {
        // Retry if Typeform not loaded yet
        setTimeout(initTypeform, 100);
      }
    };

    initTypeform();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isOpen, onComplete]);

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
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FDF8F5]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-[#C9A962] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600">Loading form...</p>
              </div>
            </div>
          )}
          <div 
            ref={containerRef} 
            className="w-full h-full"
            style={{ minHeight: '500px' }}
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
