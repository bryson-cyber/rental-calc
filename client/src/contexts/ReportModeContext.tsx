import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export type ReportMode = 'pro' | 'guided';

interface ReportModeContextValue {
  mode: ReportMode;
  setMode: (mode: ReportMode) => void;
  isLoading: boolean;
  /** True when user has never chosen a mode (first-time user) */
  needsOnboarding: boolean;
  /** Call after user picks a mode in the onboarding modal */
  completeOnboarding: (mode: ReportMode, remember: boolean) => void;
}

const ReportModeContext = createContext<ReportModeContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'reportMode';

export function ReportModeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [mode, setModeState] = useState<ReportMode>(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return (stored === 'pro' || stored === 'guided') ? stored : 'guided';
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasCheckedServer, setHasCheckedServer] = useState(false);

  // Fetch server-side preference for logged-in users
  const modeQuery = trpc.reportMode.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const setModeMutation = trpc.reportMode.set.useMutation();

  // Sync server preference to local state
  useEffect(() => {
    if (modeQuery.data && !hasCheckedServer) {
      setHasCheckedServer(true);
      if (modeQuery.data.mode) {
        // User has a saved preference on server
        setModeState(modeQuery.data.mode);
        localStorage.setItem(LOCAL_STORAGE_KEY, modeQuery.data.mode);
        setNeedsOnboarding(false);
      } else if (isAuthenticated) {
        // Logged in but no preference saved — check localStorage
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored || stored === 'null') {
          setNeedsOnboarding(true);
        } else {
          setNeedsOnboarding(false);
        }
      }
    }
  }, [modeQuery.data, hasCheckedServer, isAuthenticated]);

  // For anonymous users, check localStorage on mount
  useEffect(() => {
    if (!isAuthenticated && !hasCheckedServer) {
      setHasCheckedServer(true);
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored || stored === 'null') {
        setNeedsOnboarding(true);
      }
    }
  }, [isAuthenticated, hasCheckedServer]);

  const setMode = (newMode: ReportMode) => {
    setModeState(newMode);
    localStorage.setItem(LOCAL_STORAGE_KEY, newMode);
    // Save to server if logged in
    if (isAuthenticated) {
      setModeMutation.mutate({ mode: newMode });
    }
  };

  const completeOnboarding = (selectedMode: ReportMode, remember: boolean) => {
    setModeState(selectedMode);
    setNeedsOnboarding(false);
    if (remember) {
      localStorage.setItem(LOCAL_STORAGE_KEY, selectedMode);
      if (isAuthenticated) {
        setModeMutation.mutate({ mode: selectedMode });
      }
    } else {
      // Don't persist — just use for this session
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  return (
    <ReportModeContext.Provider
      value={{
        mode,
        setMode,
        isLoading: modeQuery.isLoading,
        needsOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </ReportModeContext.Provider>
  );
}

export function useReportMode() {
  const context = useContext(ReportModeContext);
  if (!context) {
    throw new Error('useReportMode must be used within a ReportModeProvider');
  }
  return context;
}
