import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
  /** Scroll threshold to show the button (default: 400px) */
  threshold?: number;
  /** Additional CSS classes */
  className?: string;
  /** Bottom offset to account for bottom navigation (default: 80px) */
  bottomOffset?: number;
}

/**
 * Floating scroll-to-top button that appears when user scrolls down
 * Positioned above the mobile bottom navigation bar
 */
export function ScrollToTopButton({
  threshold = 400,
  className,
  bottomOffset = 80,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > threshold);
      
      // Track if actively scrolling for animation purposes
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        // Base styles
        "fixed z-40 flex items-center justify-center",
        "w-12 h-12 rounded-full",
        "bg-white border border-slate-200 shadow-lg",
        "text-slate-600 hover:text-amber-600 hover:border-amber-300",
        "transition-all duration-300 ease-out",
        // Touch target
        "min-w-[44px] min-h-[44px]",
        // Position - right side, above bottom nav on mobile
        "right-4",
        // Visibility animation
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
        // Subtle scale when scrolling
        isScrolling && isVisible && "scale-95",
        // Active state
        "active:scale-90",
        className
      )}
      style={{
        bottom: `${bottomOffset + 16}px`, // 16px gap above bottom nav
      }}
    >
      <ChevronUp className="w-6 h-6" />
    </button>
  );
}
