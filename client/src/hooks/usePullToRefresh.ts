import { useState, useRef, useEffect, useCallback } from 'react';

interface PullToRefreshConfig {
  onRefresh: () => Promise<void>;
  pullThreshold?: number; // Distance to trigger refresh (default: 80px)
  maxPull?: number; // Maximum pull distance (default: 120px)
  disabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Custom hook for pull-to-refresh functionality
 * Returns state and a ref to attach to the scrollable container
 */
export function usePullToRefresh<T extends HTMLElement = HTMLDivElement>(config: PullToRefreshConfig) {
  const {
    onRefresh,
    pullThreshold = 80,
    maxPull = 120,
    disabled = false,
  } = config;

  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const elementRef = useRef<T>(null);
  const startYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || state.isRefreshing) return;
    
    const element = elementRef.current;
    if (!element) return;

    // Only start pull if at the top of the scroll container
    if (element.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, state.isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || state.isRefreshing) return;

    const element = elementRef.current;
    if (!element) return;

    // Only allow pull if still at top
    if (element.scrollTop > 0) {
      isPullingRef.current = false;
      setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Apply resistance to make it feel more natural
      const resistance = 0.5;
      const pullDistance = Math.min(diff * resistance, maxPull);
      
      setState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance,
      }));

      // Prevent default scrolling when pulling
      if (diff > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, state.isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled) return;

    isPullingRef.current = false;

    if (state.pullDistance >= pullThreshold && !state.isRefreshing) {
      // Trigger refresh
      setState(prev => ({ ...prev, isRefreshing: true, pullDistance: pullThreshold }));
      
      try {
        await onRefresh();
      } finally {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    } else {
      // Reset without refresh
      setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
    }
  }, [disabled, state.pullDistance, state.isRefreshing, pullThreshold, onRefresh]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref: elementRef,
    isPulling: state.isPulling,
    pullDistance: state.pullDistance,
    isRefreshing: state.isRefreshing,
    pullProgress: Math.min(state.pullDistance / pullThreshold, 1),
  };
}
