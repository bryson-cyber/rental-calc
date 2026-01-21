/**
 * Image Carousel Modal Component
 * 
 * A full-screen modal carousel for viewing multiple property images.
 * Features:
 * - Keyboard navigation (arrow keys, escape to close)
 * - Touch/swipe support on mobile
 * - Image counter
 * - Smooth transitions
 */

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  airbnbUrl?: string;
}

export function ImageCarousel({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  title,
  airbnbUrl,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Reset to initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
    }
  }, [isOpen, initialIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        setIsLoading(true);
        break;
      case 'ArrowRight':
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        setIsLoading(true);
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [isOpen, images.length, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next image
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      } else {
        // Swipe right - previous image
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      }
      setIsLoading(true);
    }
    
    setTouchStart(null);
  };

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    setIsLoading(true);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    setIsLoading(true);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="text-white font-medium text-lg truncate max-w-[300px] md:max-w-[500px]">
              {title}
            </h3>
          )}
          {airbnbUrl && (
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">View on Airbnb</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/80 text-sm font-medium">
            {currentIndex + 1} of {images.length}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close gallery"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main image container */}
      <div 
        className="relative w-full h-full flex items-center justify-center px-4 md:px-16"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous button */}
        {images.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 md:left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        {/* Image */}
        <div className="relative max-w-5xl max-h-[80vh] flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={images[currentIndex]}
            alt={`Property image ${currentIndex + 1}`}
            className={`max-w-full max-h-[80vh] object-contain rounded-lg transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </div>

        {/* Next button */}
        {images.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 md:right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex justify-center gap-2 overflow-x-auto pb-2 max-w-full">
            {images.slice(0, 10).map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                  setIsLoading(true);
                }}
                className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden transition-all ${
                  idx === currentIndex 
                    ? 'ring-2 ring-amber-400 opacity-100' 
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
            {images.length > 10 && (
              <div className="flex-shrink-0 w-16 h-12 rounded-md bg-white/10 flex items-center justify-center text-white/80 text-xs">
                +{images.length - 10}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 text-xs hidden md:block">
        Use ← → arrow keys to navigate • ESC to close
      </div>
    </div>
  );
}

export default ImageCarousel;
