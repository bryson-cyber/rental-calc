/**
 * Job-Focused Lead Magnet Tool
 * 
 * Three core jobs this tool accomplishes:
 * 1. "Prove to myself I can make money" - Market validation & confidence building
 * 2. "Find the best market to invest in" - Market discovery
 * 3. "Find if this specific property is worth it" - Property validation
 * 
 * Flow:
 * - Ebook at top (belief-building entry point)
 * - Tools below in job sequence:
 *   1. Prove the Market (Market Research) - shows real revenue data
 *   2. Find Your Market (Explore Area) - identifies opportunities
 *   3. Validate the Deal (One Home) - checks specific property
 *   4. Find the Best Deal (Compare Many) - compares options
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { EbookViewer } from '@/components/EbookViewer';
import { HelpSection } from '@/components/HelpSection';
import { InlineEbook } from '@/components/InlineEbook';
import { AIAdvisorStep } from '@/components/AIAdvisorStep';
import { RegulationTrackerStep } from '@/components/RegulationTrackerStep';
import PropertyCard from '@/components/PropertyCard';
import { CompDataTable } from '@/components/CompDataTable';
import { HistoricalCharts } from '@/components/HistoricalCharts';
import { ShareReportButton } from '@/components/ShareReportButton';
import { ShareToolButton } from '@/components/ShareToolButton';
import { UniversalShareButton } from '@/components/UniversalShareButton';
import { BugReportButton } from '@/components/BugReportButton';
import { InfoTooltip, MetricLabel } from '@/components/InfoTooltip';

import { 
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bed,
  BedDouble,
  Bath,
  Star,
  Users,
  Home,
  ExternalLink,
  BarChart3,
  BookOpen,
  Target,
  Sparkles,
  ArrowUpRight,
  Clock,
  Percent,
  List,
  Grid3X3,
  Search,
  Plus,
  Trash2,
  SortAsc,
  SortDesc,
  Filter,
  X,
  Map,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Zap,
  Trophy,
  Shield,
  Bookmark,
  BookmarkCheck,
  Heart,
  HeartOff,
  Building,
  Calculator,
  Award,
  Share2
} from 'lucide-react';
import { MapView } from '@/components/Map';
import { MapViewContent } from '@/components/MapViewContent';
import { MapFirstLayoutV2 } from '@/components/MapFirstLayoutV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { SmartAddressInput, isZillowUrl, type PropertyDetails } from '@/components/SmartAddressInput';
import { MarketAutocomplete } from '@/components/MarketAutocomplete';
import { HierarchicalLocationSelector, type LocationSelection } from '@/components/HierarchicalLocationSelector';
import { toast } from 'sonner';
import { useSavedItems } from '@/hooks/useSavedItems';
import { SavedItemsPanel } from '@/components/SavedItemsPanel';
import { StartWithProperty } from '@/components/StartWithProperty';
import { useProperty } from '@/contexts/PropertyContext';
import { TeslaDashboard } from '@/components/TeslaDashboard';
import { StandaloneMarketAdvisor } from '@/components/StandaloneMarketAdvisor';
import OpportunityFinderStep from '@/components/OpportunityFinderStep';
import { NotificationBell } from '@/components/NotificationBell';
import { DataScopeIndicator, DataScopeBadge } from '@/components/DataScopeIndicator';
import { SaveLoginPrompt, useSaveWithPrompt } from '@/components/SaveLoginPrompt';
import { AuthButton } from '@/components/AuthButton';
import { CompareFavoritesSection } from '@/components/CompareFavoritesSection';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { BackToPropertyButton } from '@/components/BackToPropertyButton';
import { SEOHead, createWebPageSchema } from '@/components/SEOHead';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface CompMonthlyMetric {
  date: string;
  occupancy: number;
  adr: number;
  revenue: number;
  revenue_potential: number;
}

interface Comparable {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  revenue: number;
  adr: number;
  occupancy: number;
  rating: number;
  reviews: number;
  imageUrl?: string;
  images?: string[];  // All images for carousel
  airbnbUrl?: string;
  distanceMeters?: number;
  monthlyMetrics?: CompMonthlyMetric[];
}

interface HistoricalData {
  summary: {
    monthly_pct_change: number;
    yearly_pct_change: number;
    trend: 'up' | 'down' | 'stable';
  };
  months: Array<{
    date: string;
    revenue: number;
    occupancy: number;
    adr: number;
  }>;
}

interface AnalysisResult {
  revenue: {
    projected: number;
    low: number;
    high: number;
  };
  metrics: {
    adr: number;
    occupancy: number;
  };
  cashFlow: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
  };
  forecast: MonthlyForecast[];
  comparables: Comparable[];
  historicalData?: HistoricalData;
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  marketId?: string | number;  // For MarketInsightsPanel
}

interface BulkPropertyInput {
  id: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
}

interface BulkPropertyResult {
  id: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  revenue: number;
  profit: number;
  ratio: number;
  adr: number;
  occupancy: number;
  status: 'success' | 'error';
  error?: string;
  propertyType?: string;
  comparableCount?: number; // Number of similar properties used for estimate
}

interface MarketResearchResult {
  marketName: string;
  avgRevenue: number;
  avgAdr: number;
  avgOccupancy: number;
  totalListings: number;
  propertyTypes: Array<{
    type: string;
    count: number;
    avgRevenue: number;
    occupancy?: number;
  }>;
  seasonality: Array<{
    month: string;
    occupancy: number;
    adr: number;
  }>;
  // Submarkets for large cities
  submarkets?: Array<{
    name: string;
    listingCount: number;
    avgRevenue: number;
    avgOccupancy: number;
  }>;
  // Step 1 Super Experience fields
  marketScores?: {
    overall: number;
    investability: number;
    rentalDemand: number;
    revenueGrowth: number;
    seasonality: number;
    regulation: number;
  };
  bookingPatterns?: {
    avgLeadTime: number;
    lastMinutePercent: number;
    advanceBookingPercent: number;
    avgLengthOfStay: number;
    weekendPercent: number;
    weekPlusPercent: number;
  };
  revenuePercentiles?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  competitionData?: {
    professionallyManagedPct: number;
    superhostPct: number;
    entireHomePct: number;
    privateRoomPct: number;
    sharedRoomPct: number;
    singleHostPct: number;
    multiHostPct: number;
  };
  // Data scope tracking
  searchLevel?: 'zip' | 'submarket' | 'city' | 'metro';
  searchedLocation?: string;
  dataLevel?: 'zip' | 'submarket' | 'city' | 'metro';
  dataLocationName?: string;
}

interface AreaListing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  distance_meters: number;
  airbnb_url?: string;
  image_url?: string;
  superhost?: boolean;
  latitude?: number;
  longitude?: number;
  days_available?: number;
  days_reserved?: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMonth = (dateStr: string): string => {
  // Handle short month names like "Jan", "Feb"
  if (dateStr && dateStr.length <= 3) {
    return dateStr;
  }
  // Handle YYYY-MM format like "2026-01"
  if (dateStr && dateStr.includes('-') && dateStr.length === 7) {
    const [year, monthNum] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(monthNum, 10) - 1;
    return monthNames[monthIndex] || dateStr;
  }
  // Try parsing as date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  return dateStr || 'N/A';
};

const getMonthAbbr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' }).substring(0, 3);
};

// ============================================
// MAIN COMPONENT
// ============================================
type TabType = 'ebook' | 'regulations' | 'prove' | 'find' | 'validate' | 'compare' | 'map' | 'advisor' | 'market' | 'opportunity' | 'explore';

export default function LeadMagnet() {
  // Auth state for login requirement
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  // Property context for property-centric workflow
  const { myProperty, hasProperty, bedroomFilter, setMyProperty, globalMode } = useProperty();
  
  // Tab state - now in job sequence
  const [activeTab, setActiveTab] = useState<TabType>('ebook');
  
  // Swipe gesture state for mobile navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const toolContentRef = useRef<HTMLDivElement>(null);
  const TAB_ORDER: TabType[] = ['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'];
  
  // Swipe handlers for mobile navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const minSwipeDistance = 50;
    
    // Only trigger if horizontal swipe is dominant (not scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      
      if (deltaX < 0 && currentIndex < TAB_ORDER.length - 1) {
        // Swipe left -> next step
        setActiveTab(TAB_ORDER[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right -> previous step
        setActiveTab(TAB_ORDER[currentIndex - 1]);
      }
    }
    
    touchStartRef.current = null;
  }, [activeTab]);
  
  // Get URL search params - use window.location.search directly to capture before wouter clears them
  const searchString = useSearch();
  const initialSearchRef = useRef(typeof window !== 'undefined' ? window.location.search : '');
  
  // Track if we should auto-trigger analysis from URL params
  const autoTriggerRef = useRef<{ tab: string; address: string } | null>(null);
  
  // Handle URL parameters for tab navigation and data passing
  useEffect(() => {
    // Check localStorage for Research Tools button data first (from property cards)
    const storedToolData = localStorage.getItem('autoToolData');
    if (storedToolData) {
      try {
        const data = JSON.parse(storedToolData);
        // Only use if recent (within last 5 minutes)
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          console.log('[AutoToolData] Found stored tool data:', data);
          // Clear it immediately so it doesn't trigger again
          localStorage.removeItem('autoToolData');
          
          // Set form data based on what's available
          if (data.address) setAddress(data.address);
          if (data.location) setExploreAddress(data.location);
          if (data.bedrooms) {
            setBedrooms(String(data.bedrooms));
            // Also set explore bedroom filter for explore/find tabs
            setExploreBedroomFilter(data.bedrooms);
            exploreBedroomFilterRef.current = data.bedrooms;
          }
          if (data.bathrooms) setBathrooms(String(data.bathrooms));
          if (data.rent) setMonthlyRent(String(data.rent));
          
          // Map tab names to internal tab types
          const tabMapping: Record<string, TabType> = {
            'explore': 'explore',
            'map': 'map',
            'prove': 'prove',
            'ai': 'advisor',
            'market-advisor': 'market',
            'validate': 'validate',
          };
          
          const targetTab = tabMapping[data.tab] || data.tab;
          setActiveTab(targetTab as TabType);
          
          // Set myProperty for all tabs so BackToPropertyButton shows
          if (data.address) {
            const hasValidCoords = data.lat && data.lng && !isNaN(data.lat) && !isNaN(data.lng);
            const cityState = data.location?.split(',').map((s: string) => s.trim()) || [];
            const city = cityState[0] || undefined;
            const state = cityState[1] || undefined;
            
            setMyProperty({
              address: data.address,
              bedrooms: data.bedrooms || 2,
              bathrooms: data.bathrooms || 1,
              monthlyRent: data.rent,
              zipCode: data.zipCode,
              ...(hasValidCoords ? { latitude: data.lat, longitude: data.lng } : {}),
              ...(city ? { city } : {}),
              ...(state ? { state } : {}),
            });
          }
          
          // For prove tab, set the initial zip code for auto-search
          if (data.tab === 'prove' && data.zipCode) {
            setProveInitialZipCode(data.zipCode);
          }
          
          // For market-advisor tab, set myProperty with zipCode for auto-population
          if (data.tab === 'market-advisor' && data.zipCode) {
            setMyProperty({
              ...myProperty,
              zipCode: data.zipCode,
              address: data.address || myProperty?.address || '',
              bedrooms: data.bedrooms || myProperty?.bedrooms || 2,
              bathrooms: data.bathrooms || myProperty?.bathrooms || 1,
            });
          }
          
          // Mark for auto-trigger
          autoTriggerRef.current = { tab: targetTab, address: data.address || data.location };
          
          // Scroll to tools section
          setTimeout(() => {
            document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return; // Skip other processing
        } else {
          // Expired, remove it
          localStorage.removeItem('autoToolData');
        }
      } catch (e) {
        console.error('[AutoToolData] Failed to parse stored data:', e);
        localStorage.removeItem('autoToolData');
      }
    }
    
    // Check localStorage for auto-analyze property data (from Full Analysis button)
    const storedAutoAnalyze = localStorage.getItem('autoAnalyzeProperty');
    if (storedAutoAnalyze) {
      try {
        const data = JSON.parse(storedAutoAnalyze);
        // Only use if recent (within last 5 minutes)
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          console.log('[AutoAnalyze] Found stored property data:', data);
          // Clear it immediately so it doesn't trigger again
          localStorage.removeItem('autoAnalyzeProperty');
          // Set form data
          if (data.address) setAddress(data.address);
          if (data.bedrooms) setBedrooms(String(data.bedrooms));
          if (data.bathrooms) setBathrooms(String(data.bathrooms));
          if (data.rent) setMonthlyRent(String(data.rent));
          // Set tab to validate
          setActiveTab('validate');
          // Mark for auto-trigger
          autoTriggerRef.current = { tab: 'validate', address: data.address };
          // Scroll to tools section
          setTimeout(() => {
            document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return; // Skip URL param processing
        } else {
          // Expired, remove it
          localStorage.removeItem('autoAnalyzeProperty');
        }
      } catch (e) {
        console.error('[AutoAnalyze] Failed to parse stored data:', e);
        localStorage.removeItem('autoAnalyzeProperty');
      }
    }
    
    // Use initialSearchRef if searchString is empty (wouter may have cleared it)
    const effectiveSearch = searchString || initialSearchRef.current;
    const params = new URLSearchParams(effectiveSearch);
    console.log('[URLParams] effectiveSearch:', effectiveSearch, 'searchString:', searchString, 'initialSearchRef:', initialSearchRef.current);
    const tab = params.get('tab');
    const step = params.get('step'); // Support ?step=3 format for HubSpot emails
    const urlAddress = params.get('address');
    const location = params.get('location');
    const urlBedrooms = params.get('bedrooms');
    const urlBathrooms = params.get('bathrooms');
    const rent = params.get('rent');
    const autoAnalyze = params.get('autoAnalyze');
    const lat = params.get('lat');
    const lng = params.get('lng');
    
    // HubSpot personalization params - city/state/zip for auto-populating tools
    const urlCity = params.get('city');
    const urlState = params.get('state');
    const urlZip = params.get('zip');
    
    // Map URL tab param to internal tab names
    const tabMapping: Record<string, TabType> = {
      'compare': 'compare',
      'competition': 'compare',
      'map': 'map',
      'market': 'market',
      'validate': 'validate',
      'prove': 'prove',
      'find': 'find',
      'advisor': 'advisor',
      'opportunity': 'opportunity',
      'ebook': 'ebook',
      'regulations': 'regulations',
    };
    
    // Map step numbers to internal tab names (for HubSpot email deep links)
    // Step 1: Check Regulations, Step 2: Find a Property, Step 3: See Real Revenue, etc.
    const stepMapping: Record<string, TabType> = {
      '1': 'regulations',    // Check Regulations
      '2': 'opportunity',    // Find a Property
      '3': 'prove',          // See Real Revenue
      '4': 'find',           // Explore Listings
      '5': 'validate',       // Validate the Deal
      '6': 'compare',        // Compare Favorites
      '7': 'map',            // See the Map
      '8': 'market',         // Market Advisor
      '9': 'advisor',        // AI Advisor
    };
    
    // Determine target tab from either ?tab= or ?step= parameter
    const targetTab = (tab && tabMapping[tab]) ? tabMapping[tab] : (step && stepMapping[step]) ? stepMapping[step] : null;
    
    console.log('[URLParams] tab:', tab, 'step:', step, 'targetTab:', targetTab, 'autoAnalyze:', autoAnalyze);
    if (targetTab) {
      console.log('[URLParams] Setting activeTab to:', targetTab);
      setActiveTab(targetTab);
      
      // Pre-fill form data if provided
      if (urlAddress) {
        setAddress(urlAddress);
      }
      if (location) {
        // For market tab, set the explore address
        setExploreAddress(location);
      }
      if (urlBedrooms) {
        setBedrooms(urlBedrooms);
      }
      if (urlBathrooms) {
        setBathrooms(urlBathrooms);
      }
      if (rent) {
        setMonthlyRent(rent);
      }
      
      // HubSpot personalization: Build location string from city/state/zip params
      // This enables personalized links like: /?tab=prove&city=Austin&state=TX&zip=78701
      let hubspotLocation = '';
      if (urlCity && urlState) {
        hubspotLocation = `${urlCity}, ${urlState}`;
        if (urlZip) {
          hubspotLocation += ` ${urlZip}`;
        }
        // Set explore address for market-related tabs
        setExploreAddress(hubspotLocation);
        setResearchMarket(hubspotLocation);
        console.log('[HubSpot] Auto-populated location:', hubspotLocation);
        
        // Store in myProperty context for all tools
        setMyProperty({
          address: urlAddress || '',
          bedrooms: urlBedrooms ? parseInt(urlBedrooms) : 2,
          bathrooms: urlBathrooms ? parseFloat(urlBathrooms) : 1,
          city: urlCity,
          state: urlState,
          zipCode: urlZip || undefined,
        });
        
        // For prove tab with zip code, set initial zip for auto-search
        if (targetTab === 'prove' && urlZip) {
          setProveInitialZipCode(urlZip);
        }
        
        // For prove tab with city/state (HubSpot personalization), set initial city/state
        if (targetTab === 'prove' && urlCity && urlState) {
          setProveInitialCity(urlCity);
          setProveInitialState(urlState);
        }
        
        // For opportunity tab (Find a Property), set initial city/state for auto-search
        if (targetTab === 'opportunity' && urlCity && urlState) {
          setExploreAddress(hubspotLocation);
        }
        
        // Auto-trigger analysis for HubSpot personalized links
        if (!autoAnalyze) {
          autoTriggerRef.current = { tab: targetTab, address: hubspotLocation };
        }
      }
      
      // For map tab, set myProperty context - coordinates are optional, MapFirstLayoutV2 will geocode if missing
      if (targetTab === 'map' && urlAddress) {
        const latitude = lat ? parseFloat(lat) : undefined;
        const longitude = lng ? parseFloat(lng) : undefined;
        const hasValidCoords = latitude && longitude && !isNaN(latitude) && !isNaN(longitude);
        
        // Extract city from location param if available
        const cityState = location?.split(',').map(s => s.trim()) || [];
        const city = cityState[0] || undefined;
        const state = cityState[1] || undefined;
        
        setMyProperty({
          address: urlAddress,
          bedrooms: urlBedrooms ? parseInt(urlBedrooms) : 2,
          bathrooms: urlBathrooms ? parseFloat(urlBathrooms) : 1,
          ...(hasValidCoords ? { latitude, longitude } : {}),
          ...(city ? { city } : {}),
          ...(state ? { state } : {}),
        });
      }
      
      // Mark for auto-trigger if autoAnalyze flag is set
      if (autoAnalyze === 'true' && urlAddress) {
        autoTriggerRef.current = { tab: targetTab, address: urlAddress };
      }
      
      // Scroll to the active tool panel after a short delay
      // Use longer delay to ensure content is rendered
      setTimeout(() => {
        // First scroll to tools section
        const toolsSection = document.getElementById('tools-section');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
        // Then scroll to the specific tool panel after it renders
        setTimeout(() => {
          const toolPanel = document.querySelector('[data-tool-panel]');
          if (toolPanel) {
            toolPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }, 200);
    }
  }, [searchString, setMyProperty]);
  
  // Auto-trigger analysis when URL params indicate it
  // Runs after URL params are processed (triggered by searchString change)
  const hasAutoTriggered = useRef(false);
  useEffect(() => {
    // Small delay to ensure the URL param useEffect has run first
    const timer = setTimeout(() => {
      if (autoTriggerRef.current && !hasAutoTriggered.current) {
        hasAutoTriggered.current = true;
        const { tab, address: triggerAddress } = autoTriggerRef.current;
        autoTriggerRef.current = null; // Clear to prevent re-triggering
        
        console.log('[AutoTrigger] Starting auto-trigger for tab:', tab, 'address:', triggerAddress);
        
        // Longer delay to ensure form is fully populated and rendered
        setTimeout(() => {
          if (tab === 'validate' && triggerAddress) {
            // Trigger the validate analysis
            const analyzeButton = document.querySelector('[data-analyze-button]') as HTMLButtonElement;
            console.log('[AutoTrigger] Looking for analyze button, found:', analyzeButton);
            console.log('[AutoTrigger] Button disabled:', analyzeButton?.disabled);
            if (analyzeButton) {
              if (!analyzeButton.disabled) {
                console.log('[AutoTrigger] Clicking validate button for:', triggerAddress);
                analyzeButton.click();
              } else {
                // Try again after another delay if button is still disabled
                console.log('[AutoTrigger] Button disabled, retrying in 1s...');
                setTimeout(() => {
                  const retryButton = document.querySelector('[data-analyze-button]') as HTMLButtonElement;
                  if (retryButton && !retryButton.disabled) {
                    console.log('[AutoTrigger] Retry: Clicking validate button');
                    retryButton.click();
                  } else {
                    console.log('[AutoTrigger] Retry: Button still disabled');
                  }
                }, 1500);
              }
            } else {
              console.log('[AutoTrigger] Button not found');
            }
          } else if (tab === 'map' && triggerAddress) {
            // For map tab, the MapFirstLayoutV2 component handles its own auto-search
            // We just need to ensure the address is set in the explore field
            setExploreAddress(triggerAddress);
          } else if (tab === 'opportunity' && triggerAddress) {
            // For opportunity tab (Find a Property), auto-trigger the property search
            console.log('[AutoTrigger] Setting up opportunity tab with:', triggerAddress);
            // Try to click the search button in the opportunity tab
            const opportunityButton = document.querySelector('[data-opportunity-button]') as HTMLButtonElement;
            if (opportunityButton && !opportunityButton.disabled) {
              console.log('[AutoTrigger] Clicking opportunity button');
              opportunityButton.click();
            } else {
              // Retry after delay
              setTimeout(() => {
                const retryButton = document.querySelector('[data-opportunity-button]') as HTMLButtonElement;
                if (retryButton && !retryButton.disabled) {
                  console.log('[AutoTrigger] Retry: Clicking opportunity button');
                  retryButton.click();
                }
              }, 1500);
            }
          } else if (tab === 'prove' && triggerAddress) {
            // For prove tab (Revenue), auto-trigger the market analysis
            console.log('[AutoTrigger] Setting up prove tab with:', triggerAddress);
            // Try to click the analyze button in the prove tab
            const proveButton = document.querySelector('[data-prove-button]') as HTMLButtonElement;
            if (proveButton && !proveButton.disabled) {
              console.log('[AutoTrigger] Clicking prove button');
              proveButton.click();
            } else {
              // Retry after delay
              setTimeout(() => {
                const retryButton = document.querySelector('[data-prove-button]') as HTMLButtonElement;
                if (retryButton && !retryButton.disabled) {
                  console.log('[AutoTrigger] Retry: Clicking prove button');
                  retryButton.click();
                }
              }, 1500);
            }
          } else if (tab === 'explore' && triggerAddress) {
            // For explore tab (Comps), auto-trigger the comps search
            console.log('[AutoTrigger] Setting up explore tab with:', triggerAddress);
            // Try to click the analyze button in the explore tab
            const exploreButton = document.querySelector('[data-explore-button]') as HTMLButtonElement;
            if (exploreButton && !exploreButton.disabled) {
              console.log('[AutoTrigger] Clicking explore button');
              exploreButton.click();
            } else {
              // Retry after delay
              setTimeout(() => {
                const retryButton = document.querySelector('[data-explore-button]') as HTMLButtonElement;
                if (retryButton && !retryButton.disabled) {
                  console.log('[AutoTrigger] Retry: Clicking explore button');
                  retryButton.click();
                }
              }, 1500);
            }
          } else if (tab === 'advisor' && triggerAddress) {
            // For AI advisor tab, auto-trigger the AI analysis
            console.log('[AutoTrigger] Setting up AI advisor tab with:', triggerAddress);
            // The AI advisor component should handle auto-analysis when address is pre-filled
            const aiButton = document.querySelector('[data-ai-button]') as HTMLButtonElement;
            if (aiButton && !aiButton.disabled) {
              console.log('[AutoTrigger] Clicking AI button');
              aiButton.click();
            } else {
              setTimeout(() => {
                const retryButton = document.querySelector('[data-ai-button]') as HTMLButtonElement;
                if (retryButton && !retryButton.disabled) {
                  console.log('[AutoTrigger] Retry: Clicking AI button');
                  retryButton.click();
                }
              }, 1500);
            }
          } else if (tab === 'market' && triggerAddress) {
            // For market advisor tab, auto-trigger the market analysis
            console.log('[AutoTrigger] Setting up market advisor tab with:', triggerAddress);
            // The market advisor component should handle auto-analysis when location is pre-filled
            const marketButton = document.querySelector('[data-market-button]') as HTMLButtonElement;
            if (marketButton && !marketButton.disabled) {
              console.log('[AutoTrigger] Clicking market button');
              marketButton.click();
            } else {
              setTimeout(() => {
                const retryButton = document.querySelector('[data-market-button]') as HTMLButtonElement;
                if (retryButton && !retryButton.disabled) {
                  console.log('[AutoTrigger] Retry: Clicking market button');
                  retryButton.click();
                }
              }, 1500);
            }
          }
        }, 1200);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [searchString]);
  
  // Ebook state
  const [isEbookExpanded, setIsEbookExpanded] = useState(true);
  const [isEbookOpen, setIsEbookOpen] = useState(false);
  
  // Help state
  const [showHelp, setShowHelp] = useState<TabType | null>(null);
  
  // Saved items
  const {
    savedMarkets,
    savedProperties,
    saveMarket,
    removeMarket,
    updateMarketNote,
    saveProperty,
    removeProperty,
    updatePropertyNote,
    isMarketSaved,
    isPropertySaved,
    clearAll,
    totalSaved,
  } = useSavedItems();
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  
  // Save with login prompt
  const {
    showPrompt: showSavePrompt,
    pendingSave,
    promptSave,
    handleContinueWithoutAccount,
    handleClose: handleCloseSavePrompt,
  } = useSaveWithPrompt();
  
  // ============================================
  // VALIDATE THE DEAL STATE (formerly Single Property)
  // ============================================
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [furnitureCost, setFurnitureCost] = useState('15000');
  const [expensePercent, setExpensePercent] = useState(20);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisTimer, setAnalysisTimer] = useState(0);
  
  // Lead capture state for Step 3
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  
  // Rentometer state for rent validation
  const [rentometerData, setRentometerData] = useState<{
    median: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    sampleCount: number;
    userRentVsMarket: 'below' | 'at' | 'above';
    rentAdvantage: number;
    percentileRank: number;
  } | null>(null);
  const [isLoadingRentometer, setIsLoadingRentometer] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  
  // ============================================
  // FIND THE BEST DEAL STATE (formerly Compare)
  // ============================================
  const [bulkProperties, setBulkProperties] = useState<BulkPropertyInput[]>([
    { id: '1', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
  ]);
  const [bulkResults, setBulkResults] = useState<BulkPropertyResult[] | null>(null);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkSortBy, setBulkSortBy] = useState<'profit' | 'revenue' | 'ratio'>('profit');
  const [bulkSortDir, setBulkSortDir] = useState<'desc' | 'asc'>('desc');
  const [showMethodology, setShowMethodology] = useState(false);
  
  // ============================================
  // FIND YOUR MARKET STATE (formerly Explore Area)
  // ============================================
  const [exploreAddress, setExploreAddress] = useState('');
  const [exploreRadius, setExploreRadius] = useState(3000);
  const [exploreBedroomFilter, setExploreBedroomFilter] = useState<number | null>(null);
  const [exploreMinRating, setExploreMinRating] = useState<number | null>(null);
  const [exploreSortBy, setExploreSortBy] = useState<'proximity' | 'revenue' | 'rating' | 'occupancy' | 'revpar'>('revenue');
  
  // Refs to track current filter values for callbacks (avoids stale closure issues)
  const exploreBedroomFilterRef = useRef<number | null>(null);
  const exploreSortByRef = useRef<'proximity' | 'revenue' | 'rating' | 'occupancy' | 'revpar'>('revenue');
  
  // Keep refs in sync with state
  useEffect(() => {
    exploreBedroomFilterRef.current = exploreBedroomFilter;
  }, [exploreBedroomFilter]);
  
  useEffect(() => {
    exploreSortByRef.current = exploreSortBy;
  }, [exploreSortBy]);
  const [explorePropertyType, setExplorePropertyType] = useState<string | null>(null);
  const [exploreMinOccupancy, setExploreMinOccupancy] = useState<number | null>(null);
  const [exploreMinRevenue, setExploreMinRevenue] = useState<number | null>(null);
  const [exploreSuperhostOnly, setExploreSuperhostOnly] = useState(false);
  const [areaListings, setAreaListings] = useState<AreaListing[] | null>(null);
  const [isExploring, setIsExploring] = useState(false);
  const [totalListings, setTotalListings] = useState(0);
  const [showMapView, setShowMapView] = useState(false);
  const [exploreCenter, setExploreCenter] = useState<{lat: number; lng: number} | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // NEW: Market-based Step 2 state
  const [selectedMarket, setSelectedMarket] = useState<{
    id: string;
    name: string;
    type: 'market' | 'submarket';
    listingCount: number;
    state?: string;
    zipcodes: string[];
  } | null>(null);
  const [marketListings, setMarketListings] = useState<any[] | null>(null);
  const [marketNeighborhoods, setMarketNeighborhoods] = useState<any[] | null>(null);
  const [isLoadingMarketListings, setIsLoadingMarketListings] = useState(false);
  const [marketListingsStats, setMarketListingsStats] = useState<{
    avgRevenue: number;
    avgOccupancy: number;
    topRevenue: number;
    topOccupancy: number;
    totalCount: number;
    avgAdr: number;
    marketGrade: string;
    marketVerdict: string;
    gradeColor: string;
    gradeBg: string;
  } | null>(null);
  
  // ============================================
  // PROVE THE MARKET STATE (formerly Market Research)
  // ============================================
  const [researchMarket, setResearchMarket] = useState('');
  const [researchResult, setResearchResult] = useState<MarketResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [showMarketSuggestions, setShowMarketSuggestions] = useState(false);
  const [marketSuggestions, setMarketSuggestions] = useState<Array<{
    id: string;
    name: string;
    type: 'market' | 'submarket';
    listingCount: number;
    state?: string;
    locationName?: string;
    parentMarket?: { id: string; name: string };
  }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [locationSelection, setLocationSelection] = useState<LocationSelection | null>(null);
  const [proveInitialZipCode, setProveInitialZipCode] = useState<string | undefined>(undefined);
  const [proveInitialCity, setProveInitialCity] = useState<string | undefined>(undefined);
  const [proveInitialState, setProveInitialState] = useState<string | undefined>(undefined);

  // ============================================
  // TRPC MUTATIONS
  // ============================================
  const analyzeProperty = trpc.rental.getPropertyReport.useMutation();
  const getAreaListings = trpc.listingsByArea.get.useMutation();
  const searchMarkets = trpc.marketResearchSimple.searchMarkets.useMutation();
  const getMarketReport = trpc.marketResearchSimple.getMarketReport.useMutation();
  const getSubmarketReport = trpc.marketResearchSimple.getSubmarketReport.useMutation();
  const getMarketReportByLocation = trpc.marketResearchSimple.getMarketReportByLocation.useMutation();
  const analyzeRent = trpc.rentometer.analyzeRent.useMutation();
  
  // Auto-notification for shareable reports
  const createAndNotifyReport = trpc.shareableReports.createAndNotify.useMutation({
    onSuccess: (response) => {
      if (response.success && response.shareCode) {
        const sentMethods: string[] = [];
        if (response.notificationsSent?.sms) sentMethods.push('SMS');
        if (response.notificationsSent?.email) sentMethods.push('email');
        
        if (sentMethods.length > 0) {
          toast.success(`Report sent via ${sentMethods.join(' and ')}!`, {
            description: 'Check your inbox for the shareable link.',
            duration: 5000,
          });
        }
      }
    },
    onError: (error) => {
      console.error('[AutoNotify] Error sending notification:', error);
    }
  });

  // ============================================
  // AUTO-POPULATE FROM PROPERTY CONTEXT
  // ============================================
  // Track if user has manually set the bedroom filter
  const userSetBedroomFilterRef = useRef(false);
  // Track if user has manually edited the Step 5 form
  const userEditedStep5Ref = useRef(false);
  
  useEffect(() => {
    // When property context changes, auto-populate bedroom filter for apples-to-apples comparison
    // But only if user hasn't manually set a different value
    if (hasProperty && myProperty?.bedrooms && !userSetBedroomFilterRef.current) {
      // Step 2: Explore Listings - set bedroom filter for apples-to-apples
      setExploreBedroomFilter(myProperty.bedrooms);
      exploreBedroomFilterRef.current = myProperty.bedrooms;
    }
    
    // Step 5: Validate the Deal - auto-populate form from myProperty
    // Sync when myProperty has data and user hasn't manually edited the form
    if (hasProperty && myProperty?.address && !userEditedStep5Ref.current) {
      setAddress(myProperty.address);
      setBedrooms(String(myProperty.bedrooms));
      setBathrooms(String(myProperty.bathrooms));
      // Rent mode: sync monthly rent
      if (myProperty.monthlyRent) {
        setMonthlyRent(String(myProperty.monthlyRent));
      }
      // Purchase mode: myProperty already contains purchasePrice, loanType, downPaymentPercent, interestRate
      // These are read directly from myProperty in the form, so no separate state sync needed
    }
    // Note: Step 4 (Find the Best Deal) is intentionally NOT auto-populated
    // because it's for comparing multiple different properties
  }, [hasProperty, myProperty]);
  
  // Also sync when switching to the validate tab
  useEffect(() => {
    if (activeTab === 'validate' && hasProperty && myProperty?.address && !userEditedStep5Ref.current) {
      setAddress(myProperty.address);
      setBedrooms(String(myProperty.bedrooms));
      setBathrooms(String(myProperty.bathrooms));
      // Rent mode: sync monthly rent
      if (myProperty.monthlyRent) {
        setMonthlyRent(String(myProperty.monthlyRent));
      }
      // Purchase mode: data is read directly from myProperty in the form
      // (purchasePrice, loanType, downPaymentPercent, interestRate)
    }
  }, [activeTab, hasProperty, myProperty]);

  // ============================================
  // DEBOUNCED MARKET SEARCH
  // ============================================
  useEffect(() => {
    // Don't search if input is too short or empty
    if (researchMarket.length < 2) {
      setMarketSuggestions([]);
      return;
    }
    
    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchMarkets.mutateAsync({ query: researchMarket });
        setMarketSuggestions(results);
      } catch (error) {
        console.error('Error searching markets:', error);
        setMarketSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [researchMarket]);

  // ============================================
  // HANDLERS
  // ============================================
  
  // Validate the Deal (Single Property)
  const handleAnalyze = async () => {
    // Note: Login requirement removed - AI Advisor is now free for all users
    
    if (!address) {
      toast.error('Please enter a property address');
      return;
    }
    
    setIsAnalyzing(true);
    setLoadingStep(1);
    setAnalysisTimer(0); // Reset timer
    setRentometerData(null); // Clear previous rentometer data
    
    // Start timer interval - defined outside try block for cleanup in finally
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    timerInterval = setInterval(() => {
      setAnalysisTimer(prev => prev + 1);
    }, 1000);
    
    try {
      // Fetch Rentometer data in parallel if rent is provided
      const rentValue = parseFloat(monthlyRent) || 0;
      if (rentValue > 0 && address) {
        setIsLoadingRentometer(true);
        try {
          const rentometerResponse = await analyzeRent.mutateAsync({
            address,
            bedrooms: parseInt(bedrooms),
            userRent: rentValue,
          });
          if (rentometerResponse.success && rentometerResponse.data) {
            const data = rentometerResponse.data;
            const userRentVsMarket = data.userRentComparison.rentAdvantage > 0 ? 'below' 
              : data.userRentComparison.rentAdvantage < 0 ? 'above' 
              : 'at';
            // Calculate percentile rank based on where user's rent falls
            const userRent = rentValue;
            let percentileRank = 50; // default to median
            if (userRent <= data.marketData.percentile25) {
              percentileRank = 25;
            } else if (userRent <= data.marketData.median) {
              percentileRank = 50 - ((data.marketData.median - userRent) / (data.marketData.median - data.marketData.percentile25)) * 25;
            } else if (userRent <= data.marketData.percentile75) {
              percentileRank = 50 + ((userRent - data.marketData.median) / (data.marketData.percentile75 - data.marketData.median)) * 25;
            } else {
              percentileRank = 75 + ((userRent - data.marketData.percentile75) / (data.marketData.max - data.marketData.percentile75)) * 25;
            }
            
            setRentometerData({
              median: data.marketData.median,
              percentile25: data.marketData.percentile25,
              percentile75: data.marketData.percentile75,
              min: data.marketData.min,
              max: data.marketData.max,
              sampleCount: data.marketData.samples,
              userRentVsMarket,
              rentAdvantage: data.userRentComparison.rentAdvantage,
              percentileRank: Math.round(percentileRank),
            });
          }
        } catch (rentError) {
          console.log('[Rentometer] Could not fetch rent data:', rentError);
          // Don't fail the main analysis if Rentometer fails
        } finally {
          setIsLoadingRentometer(false);
        }
      }
      const loadingInterval = setInterval(() => {
        setLoadingStep(prev => prev < 4 ? prev + 1 : prev);
      }, 1500);
      
      // Add timeout handling - 90 second timeout (increased from 45s for complex API calls)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. The property analysis is taking longer than expected. Please try again.')), 90000);
      });
      
      const response = await Promise.race([
        analyzeProperty.mutateAsync({
          address,
          bedrooms: parseInt(bedrooms),
          bathrooms: parseFloat(bathrooms),
          leadName: leadName || undefined,
          leadEmail: leadEmail || undefined,
          leadPhone: leadPhone || undefined,
        }),
        timeoutPromise
      ]);
      
      clearInterval(loadingInterval);
      clearInterval(timerInterval);
      
      if (!response.success || !response.data) {
        toast.error(response.error || 'Could not analyze this property');
        return;
      }
      
      const data = response.data;
      console.log('[Validate Deal] API Response:', JSON.stringify(data, null, 2));
      console.log('[Validate Deal] Property estimates:', data.property?.estimates);
      const rent = parseFloat(monthlyRent) || 0;
      const annualRevenue = data.property.estimates?.annual_revenue || 0;
      console.log('[Validate Deal] Annual revenue:', annualRevenue);
      const monthlyRevenue = annualRevenue / 12;
      
      // Transform API response to our result format
      setResult({
        revenue: {
          projected: annualRevenue,
          low: data.property.estimates?.annual_revenue_low || annualRevenue * 0.8,
          high: data.property.estimates?.annual_revenue_high || annualRevenue * 1.2,
        },
        metrics: {
          adr: data.property.estimates?.average_daily_rate || 0,
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = data.property.estimates?.occupancy_rate || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
        },
        cashFlow: {
          monthlyRevenue,
          monthlyRent: rent,
          monthlyProfit: monthlyRevenue - rent,
        },
        forecast: (data.property?.monthly_forecast || []).map((m: any) => ({
          month: m.month,
          revenue: m.revenue || 0,
          adr: m.adr || 0,
          occupancy: (m.occupancy || 0) > 1 ? m.occupancy : (m.occupancy || 0) * 100,
        })),
        comparables: (data.same_bedroom_comps || []).map((c: any) => ({
          id: c.id || String(Math.random()),
          title: c.title || `${c.bedrooms}BR Property`,
          bedrooms: c.bedrooms,
          bathrooms: c.bathrooms,
          accommodates: c.accommodates,
          revenue: c.annual_revenue || 0,
          adr: c.adr || 0,
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = c.occupancy || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
          rating: c.rating || 0,
          reviews: c.reviews || 0,
          imageUrl: c.image_url || c.thumbnail_url || undefined,
          images: c.images || [],
          airbnbUrl: c.airbnb_url,
          distanceMeters: c.distance_meters,
        })),
        // Market insights for professional management and superhost stats
        marketInsights: data.insights ? {
          professionallyManagedPct: data.insights.professionally_managed_pct || 0,
          superhostPct: data.insights.superhost_pct || 0,
          avgRating: (() => {
            const comps = data.same_bedroom_comps || [];
            if (comps.length === 0) return undefined;
            const ratings = comps.filter((c: any) => c.rating && c.rating > 0).map((c: any) => c.rating);
            return ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : undefined;
          })(),
          totalListings: data.market?.listing_count || (data.same_bedroom_comps || []).length,
          marketScore: data.market?.metrics?.market_score || undefined,
        } : undefined,
        // Market ID for MarketInsightsPanel
        marketId: (() => {
          const id = data.market?.id;
          console.log('[handleAnalyze] market data:', data.market);
          console.log('[handleAnalyze] marketId:', id);
          // Debug: show toast with marketId
          if (id) {
            toast.success(`MarketId found: ${id}`);
          } else {
            toast.error('MarketId not found in API response');
          }
          return id || undefined;
        })(),
        // Historical data for YoY trends - always use market.historical for months data
        historicalData: (() => {
          // Use market.historical for monthly data (needed for per-month YoY comparison)
          const historical = data.market?.historical;
          if (!historical?.revenue || historical.revenue.length < 2) {
            // Fallback: if no market historical data, use historical_valuation summary only
            const historicalValuation = data.historical_valuation;
            if (historicalValuation && historicalValuation.yoy_perc_chg !== undefined) {
              return {
                summary: {
                  monthly_pct_change: historicalValuation.mom_perc_chg || historicalValuation.yoy_perc_chg / 12,
                  yearly_pct_change: historicalValuation.yoy_perc_chg,
                  trend: historicalValuation.yoy_perc_chg > 2 ? 'up' as const : historicalValuation.yoy_perc_chg < -2 ? 'down' as const : 'stable' as const,
                },
                months: [],
              };
            }
            return undefined;
          }
          
          // Get the most recent 12 months and previous 12 months to calculate YoY change
          const sortedRevenue = [...historical.revenue].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          );
          
          // Also get occupancy and ADR historical data
          const sortedOccupancy = historical.occupancy ? [...historical.occupancy].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          ) : [];
          const sortedAdr = historical.adr ? [...historical.adr].sort((a, b) => 
            new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
          ) : [];
          
          if (sortedRevenue.length < 13) return undefined;
          
          const currentYearRevenue = sortedRevenue.slice(0, 12).reduce((sum, m) => sum + (m.value || 0), 0);
          const previousYearRevenue = sortedRevenue.slice(12, 24).reduce((sum, m) => sum + (m.value || 0), 0);
          
          if (previousYearRevenue === 0) return undefined;
          
          const yoyChange = ((currentYearRevenue - previousYearRevenue) / previousYearRevenue) * 100;
          
          // Build months array with all metrics for YoY comparison
          const months = sortedRevenue.slice(0, 24).map((m, idx) => {
            // Find matching occupancy and ADR by date
            const occupancyData = sortedOccupancy.find(o => o.date === m.date);
            const adrData = sortedAdr.find(a => a.date === m.date);
            
            return {
              date: m.date || '',
              revenue: m.value || 0,
              occupancy: occupancyData?.value || 0,
              adr: adrData?.value || 0,
            };
          });
          
          return {
            summary: {
              monthly_pct_change: yoyChange / 12,
              yearly_pct_change: yoyChange,
              trend: yoyChange > 2 ? 'up' as const : yoyChange < -2 ? 'down' as const : 'stable' as const,
            },
            months,
          };
        })(),
      });
      
      toast.success('Property validated! See your results below.');
      console.log('[handleAnalyze] Result set successfully:', { hasResult: true, activeTab });
      
      // Auto-send notification if user has contact info and auto-notifications enabled
      const hasContactInfo = myProperty?.userEmail || myProperty?.userPhone;
      const autoNotifyEnabled = myProperty?.enableAutoNotifications !== false;
      
      if (hasContactInfo && autoNotifyEnabled) {
        console.log('[handleAnalyze] Auto-sending revenue report notification');
        const annualRev = data.property.estimates?.annual_revenue || 0;
        const occupancy = data.property.estimates?.occupancy_rate || 0;
        const adr = data.property.estimates?.average_daily_rate || 0;
        
        createAndNotifyReport.mutate({
          reportType: 'revenue',
          address: address,
          city: myProperty?.city,
          state: myProperty?.state,
          zipCode: myProperty?.zipCode,
          latitude: myProperty?.latitude,
          longitude: myProperty?.longitude,
          bedrooms: parseInt(bedrooms),
          bathrooms: parseFloat(bathrooms),
          monthlyRent: parseFloat(monthlyRent) || undefined,
          reportData: {
            estimates: data.property.estimates,
            monthly_forecast: data.property.monthly_forecast,
            comps: data.same_bedroom_comps?.slice(0, 5),
            market: data.market,
          },
          title: `Revenue Analysis: ${address}`,
          summary: `Projected annual revenue: $${annualRev.toLocaleString()} with ${Math.round(occupancy * 100)}% occupancy and $${Math.round(adr)}/night ADR.`,
          annualRevenue: annualRev,
          occupancyRate: occupancy,
          averageDailyRate: adr,
          userEmail: myProperty?.userEmail,
          userPhone: myProperty?.userPhone,
          userName: myProperty?.userEmail?.split('@')[0],
          triggeredBy: 'revenue_calculator',
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not analyze this property. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
      setLoadingStep(0);
      if (timerInterval) clearInterval(timerInterval);
    }
  };
  
  // Find the Best Deal (Bulk Compare)
  const addBulkProperty = () => {
    if (bulkProperties.length >= 25) {
      toast.error('Maximum 25 properties allowed');
      return;
    }
    setBulkProperties([
      ...bulkProperties,
      { id: Date.now().toString(), address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
    ]);
  };
  
  const removeBulkProperty = (id: string) => {
    if (bulkProperties.length <= 1) return;
    setBulkProperties(bulkProperties.filter(p => p.id !== id));
  };
  
  const updateBulkProperty = (id: string, field: keyof BulkPropertyInput, value: string | number) => {
    setBulkProperties(bulkProperties.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  const handleBulkAnalyze = async () => {
    const validProperties = bulkProperties.filter(p => p.address.trim());
    if (validProperties.length === 0) {
      toast.error('Please enter at least one property address');
      return;
    }
    
    // Check if any property is missing rent
    const propertiesWithoutRent = validProperties.filter(p => !p.rent || p.rent <= 0);
    if (propertiesWithoutRent.length > 0) {
      toast.error(`Please enter monthly rent for all properties (${propertiesWithoutRent.length} missing)`);
      return;
    }
    
    setIsBulkAnalyzing(true);
    const results: BulkPropertyResult[] = [];
    
    for (const prop of validProperties) {
      try {
        const response = await analyzeProperty.mutateAsync({
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
        });
        
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to analyze');
        }
        
        const data = response.data;
        const annualRevenue = data.property.estimates?.annual_revenue || 0;
        const monthlyRevenue = annualRevenue / 12;
        const profit = monthlyRevenue - prop.rent;
        
        // Get property type and comparable count for confidence indicator
        const firstComp = data.property.comps?.[0];
        const propertyType = firstComp?.property_type || undefined;
        const comparableCount = data.property.comps?.length || 0;
        
        results.push({
          id: prop.id,
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          rent: prop.rent,
          revenue: monthlyRevenue,
          profit,
          ratio: prop.rent > 0 ? monthlyRevenue / prop.rent : 0,
          adr: data.property.estimates?.average_daily_rate || 0,
          // Convert occupancy from decimal to percentage if needed (API returns 0.57 for 57%)
          occupancy: (() => {
            const occ = data.property.estimates?.occupancy_rate || 0;
            return occ < 1 ? Math.round(occ * 100) : Math.round(occ);
          })(),
          status: 'success',
          propertyType,
          comparableCount,
        });
      } catch (error) {
        results.push({
          id: prop.id,
          address: prop.address,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          rent: prop.rent,
          revenue: 0,
          profit: 0,
          ratio: 0,
          adr: 0,
          occupancy: 0,
          status: 'error',
          error: 'Could not analyze this property',
        });
      }
    }
    
    setBulkResults(results);
    setIsBulkAnalyzing(false);
    toast.success(`Found the best deal from ${results.filter(r => r.status === 'success').length} properties!`);
  };
  
  // Find Your Market (Explore Area)
  const handleExplore = async () => {
    if (!exploreAddress) {
      toast.error('Please enter an address or city');
      return;
    }
    
    setIsExploring(true);
    
    try {
      const response = await getAreaListings.mutateAsync({
        address: exploreAddress,
        radiusMeters: exploreRadius,
        bedrooms: exploreBedroomFilter || undefined,
        minRating: exploreMinRating || undefined,
        sortBy: exploreSortBy === 'revpar' ? 'revenue' : exploreSortBy,
        sortDirection: exploreSortBy === 'revenue' ? 'descending' : 'ascending',
      });
      
      if (response.success && response.data) {
        const listings = response.data.listings.map((l: any) => ({
          id: l.id,
          title: l.title,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          accommodates: l.accommodates,
          property_type: l.property_type,
          rating: l.rating,
          reviews: l.reviews,
          annual_revenue: l.annual_revenue,
          adr: l.adr,
          occupancy: l.occupancy,
          distance_meters: l.distance_meters,
          airbnb_url: l.airbnb_url,
          image_url: l.image_url,
          latitude: l.latitude,
          longitude: l.longitude,
        }));
        setAreaListings(listings);
        setTotalListings(response.data.total_count);
        if (response.data.center) {
          setExploreCenter({ lat: response.data.center.latitude, lng: response.data.center.longitude });
        }
        toast.success(`Found ${response.data.total_count} opportunities in this market!`);
      } else {
        toast.error(response.error || 'Could not explore this area');
      }
    } catch (error) {
      console.error('Explore error:', error);
      toast.error('Could not explore this area. Please try again.');
    } finally {
      setIsExploring(false);
    }
  };
  
  // NEW: Market-based Step 2 search handler
  // Using trpc.useUtils() to call queries imperatively
  const trpcUtils = trpc.useUtils();
  
  const handleMarketSearch = async (market: {
    id: string;
    name: string;
    type: 'market' | 'submarket';
    listingCount: number;
    state?: string;
    zipcodes: string[];
  }, overrides?: { bedrooms?: number | null; sortBy?: string }) => {
    setSelectedMarket(market);
    setIsLoadingMarketListings(true);
    setMarketListings(null);
    setMarketNeighborhoods(null);
    setMarketListingsStats(null);
    
    // Use overrides if provided, otherwise use current state
    // IMPORTANT: Use ref values as fallback since state might be stale in callbacks
    const bedroomFilter = overrides?.bedrooms !== undefined ? overrides.bedrooms : (exploreBedroomFilterRef.current ?? exploreBedroomFilter);
    const sortByFilter = overrides?.sortBy !== undefined ? overrides.sortBy : (exploreSortByRef.current ?? exploreSortBy);
    
    console.log('[handleMarketSearch] Called with:', {
      marketId: market.id,
      marketName: market.name,
      overrides,
      bedroomFilter,
      sortByFilter,
      exploreBedroomFilter,
      exploreBedroomFilterRef: exploreBedroomFilterRef.current,
    });
    
    try {
      // Fetch listings using trpc utils fetch
      const listingsResult = await trpcUtils.marketExplorer.getListings.fetch({
        marketId: market.id,
        marketType: market.type,
        bedrooms: bedroomFilter !== null ? bedroomFilter : undefined,
        sortBy: sortByFilter === 'revpar' ? 'revenue' : (sortByFilter === 'proximity' ? 'revenue' : sortByFilter) as 'revenue' | 'occupancy' | 'adr' | 'rating',
        limit: 50,
      });
      
      // Fetch neighborhoods only for market-level searches
      let neighborhoodsResult: any[] = [];
      if (market.type === 'market') {
        neighborhoodsResult = await trpcUtils.marketExplorer.getNeighborhoods.fetch({ marketId: market.id });
      }
      
      if (listingsResult.listings) {
        setMarketListings(listingsResult.listings);
        
        // Calculate letter grade based on revenue and occupancy
        const avgRev = listingsResult.summary.avgRevenue;
        const avgOcc = listingsResult.summary.avgOccupancy;
        const avgAdr = listingsResult.summary.avgAdr || (listingsResult.listings.length > 0 
          ? listingsResult.listings.reduce((sum: number, l: any) => sum + (l.adr || 0), 0) / listingsResult.listings.length 
          : 0);
        
        let marketGrade = 'C';
        let marketVerdict = 'Average Market';
        let gradeColor = 'text-amber-600';
        let gradeBg = 'bg-amber-50 border-amber-200';
        
        // Grade based on combination of revenue and occupancy
        if (avgOcc >= 65 && avgRev >= 60000) {
          marketGrade = 'A';
          marketVerdict = 'High-Performing Market';
          gradeColor = 'text-emerald-600';
          gradeBg = 'bg-emerald-50 border-emerald-200';
        } else if (avgOcc >= 55 && avgRev >= 45000) {
          marketGrade = 'B+';
          marketVerdict = 'Strong Market';
          gradeColor = 'text-blue-600';
          gradeBg = 'bg-blue-50 border-blue-200';
        } else if (avgOcc >= 50 && avgRev >= 35000) {
          marketGrade = 'B';
          marketVerdict = 'Good Market';
          gradeColor = 'text-blue-500';
          gradeBg = 'bg-blue-50 border-blue-200';
        } else if (avgOcc >= 40 && avgRev >= 25000) {
          marketGrade = 'C+';
          marketVerdict = 'Moderate Market';
          gradeColor = 'text-amber-500';
          gradeBg = 'bg-amber-50 border-amber-200';
        } else if (avgOcc < 35 || avgRev < 20000) {
          marketGrade = 'C-';
          marketVerdict = 'Challenging Market';
          gradeColor = 'text-orange-600';
          gradeBg = 'bg-orange-50 border-orange-200';
        }
        
        setMarketListingsStats({
          avgRevenue: avgRev,
          avgOccupancy: avgOcc,
          topRevenue: listingsResult.summary.topRevenue,
          topOccupancy: listingsResult.summary.topOccupancy,
          totalCount: listingsResult.totalCount,
          avgAdr,
          marketGrade,
          marketVerdict,
          gradeColor,
          gradeBg,
        });
        toast.success(`Found ${listingsResult.totalCount} properties in ${market.name}!`);
      }
      
      if (Array.isArray(neighborhoodsResult) && neighborhoodsResult.length > 0) {
        setMarketNeighborhoods(neighborhoodsResult);
      }
    } catch (error) {
      console.error('Market search error:', error);
      toast.error('Could not load market data. Please try again.');
    } finally {
      setIsLoadingMarketListings(false);
    }
  };
  
  // Prove the Market (Market Research)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  
  const handleResearch = async (directSelection?: LocationSelection) => {
    // Support hierarchical selection at any level
    // Use directSelection if provided (for immediate calls after state update)
    const selection = directSelection || locationSelection;
    const hasHierarchicalSelection = selection && (selection.market || selection.submarket || selection.zipcode);
    
    if (!researchMarket && !hasHierarchicalSelection) {
      toast.error('Please select a location');
      return;
    }
    
    setIsResearching(true);
    setShowMarketSuggestions(false);
    
    try {
      let report;
      
      // If we have a hierarchical selection, use the appropriate endpoint
      if (hasHierarchicalSelection && selection) {
        // Check the selection level: zipcode > submarket > market
        if (selection.zipcode && selection.submarket?.id) {
          // For zip code, we use the submarket data but display with zip code context
          // The submarket endpoint gives us the most specific data available
          const submarketId = selection.submarket.id;
          const submarketName = `${selection.zipcode} (${selection.submarket.name})`;
          console.log(`[handleResearch] Using submarket endpoint for zip code ${selection.zipcode} in ${selection.submarket.name}`);
          report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
        } else if (selection.submarket?.id) {
          // Use submarket endpoint for neighborhood-level data
          const submarketId = selection.submarket.id;
          const submarketName = selection.submarket.name;
          console.log(`[handleResearch] Using submarket endpoint for ${submarketName} (${submarketId})`);
          report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
        } else if (selection.market?.id) {
          // Check if this is a submarket being treated as a market (e.g., Downtown Nashville, Glendale AZ)
          if (selection.market.isSubmarketAsMarket) {
            // Use submarket endpoint for submarkets selected as markets
            const submarketId = selection.market.id;
            const submarketName = selection.market.name;
            console.log(`[handleResearch] Using submarket endpoint for market-as-submarket: ${submarketName} (${submarketId})`);
            report = await getSubmarketReport.mutateAsync({ submarketId, submarketName });
          } else {
            // Use market endpoint for regular city-level data
            const marketId = selection.market.id;
            const marketName = selection.market.name;
            console.log(`[handleResearch] Using market endpoint for ${marketName} (${marketId})`);
            report = await getMarketReport.mutateAsync({ marketId, marketName });
          }
        } else {
          // Fallback to location-based search
          report = await getMarketReportByLocation.mutateAsync({ location: researchMarket });
        }
      } else {
        // Use the location-based endpoint for text search
        report = await getMarketReportByLocation.mutateAsync({ location: researchMarket });
      }
      
      setSelectedMarketId(report.market.id);
      
      // Transform to our result format
      // Use the user's searched zip code in the display name if available
      // Use selection (which is directSelection or locationSelection) to avoid race conditions
      let displayMarketName = report.market.name;
      if (selection?.zipcode) {
        // For zip code searches, show the user's searched zip code with the market name
        const marketNameWithoutZip = report.market.name.replace(/\s*\d{5}\s*/, '').trim();
        displayMarketName = `${marketNameWithoutZip} ${selection.zipcode}`;
      }
      
      console.log('[handleResearch] Raw report:', JSON.stringify(report, null, 2));
      console.log('[handleResearch] report.overview.avgRevenue:', report.overview.avgRevenue);
      console.log('[handleResearch] report.overview.avgOccupancy:', report.overview.avgOccupancy);
      console.log('[handleResearch] report.overview.avgAdr:', report.overview.avgAdr);
      console.log('[handleResearch] report.overview.totalListings:', report.overview.totalListings);
      
      // Determine search level and data level
      let searchLevel: 'zip' | 'submarket' | 'city' | 'metro' = 'metro';
      let searchedLocation = researchMarket;
      let dataLevel: 'zip' | 'submarket' | 'city' | 'metro' = 'metro';
      let dataLocationName = report.market.name;
      
      if (selection?.zipcode) {
        searchLevel = 'zip';
        searchedLocation = selection.zipcode;
        // Data comes from submarket level when searching by zip
        dataLevel = 'submarket';
        dataLocationName = selection.submarket?.name || report.market.name;
      } else if (selection?.submarket?.id) {
        searchLevel = 'submarket';
        searchedLocation = selection.submarket.name;
        dataLevel = 'submarket';
        dataLocationName = selection.submarket.name;
      } else if (selection?.market?.id) {
        searchLevel = selection.market.isSubmarketAsMarket ? 'submarket' : 'city';
        searchedLocation = selection.market.name;
        dataLevel = selection.market.isSubmarketAsMarket ? 'submarket' : 'city';
        dataLocationName = selection.market.name;
      }
      
      setResearchResult({
        marketName: displayMarketName,
        avgRevenue: report.overview.avgRevenue,
        avgAdr: report.overview.avgAdr,
        avgOccupancy: report.overview.avgOccupancy,
        totalListings: report.overview.totalListings,
        propertyTypes: report.bedroomBreakdown.map(b => ({
          type: b.bedrooms === 0 ? 'Studio' : b.bedrooms === 6 ? '6+ Bedroom' : `${b.bedrooms} Bedroom`,
          count: b.count,
          avgRevenue: b.avgRevenue,
          occupancy: b.avgOccupancy
        })),
        seasonality: report.seasonality.monthlyData.map(m => ({
          month: m.month,
          occupancy: m.occupancy,
          adr: m.adr,
          revenue: m.revenue || (m.adr * 30 * (m.occupancy / 100)) // Estimate monthly revenue if not provided
        })),
        // Step 1 Super Experience fields
        marketScores: (report as any).marketScores,
        bookingPatterns: (report as any).bookingPatterns,
        revenuePercentiles: (report as any).revenuePercentiles,
        competitionData: (report as any).competitionData,
        // Submarkets for large cities
        submarkets: (report as any).submarkets,
        // Data scope tracking
        searchLevel,
        searchedLocation,
        dataLevel,
        dataLocationName,
      });
      
      toast.success('Market proven! See the real revenue data below.');
    } catch (error) {
      console.error('Research error:', error);
      toast.error('Could not research this market. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };
  
  // Handle hierarchical location search
  const handleHierarchicalSearch = async (selection: LocationSelection) => {
    setLocationSelection(selection);
    
    // Build a display name for the selection
    let displayName = '';
    if (selection.zipcode) {
      displayName = `${selection.zipcode}, ${selection.submarket?.name}`;
    } else if (selection.submarket) {
      displayName = `${selection.submarket.name}, ${selection.market?.name}`;
    } else if (selection.market) {
      displayName = selection.market.name;
    }
    
    setResearchMarket(displayName);
    
    // Trigger the research - pass selection directly to avoid state timing issues
    handleResearch(selection);
  };
  
  // Sorted bulk results
  const sortedBulkResults = bulkResults ? [...bulkResults].sort((a, b) => {
    if (a.status === 'error') return 1;
    if (b.status === 'error') return -1;
    const aVal = bulkSortBy === 'profit' ? a.profit : bulkSortBy === 'revenue' ? a.revenue : a.ratio;
    const bVal = bulkSortBy === 'profit' ? b.profit : bulkSortBy === 'revenue' ? b.revenue : b.ratio;
    return bulkSortDir === 'desc' ? bVal - aVal : aVal - bVal;
  }) : null;

  // ============================================
  // JOB DESCRIPTIONS FOR EACH TOOL
  // ============================================
  const jobDescriptions = {
    ebook: {
      title: "Read the Guide",
      subtitle: "Learn the fundamentals of Airbnb arbitrage",
      job: "Answer: How does this business actually work?",
      icon: BookOpen,
      color: "from-violet-500 to-purple-500"
    },
    regulations: {
      title: "Check Regulations",
      subtitle: "See if STRs are allowed in your target market",
      job: "Answer: Can I legally operate here?",
      icon: Shield,
      color: "from-blue-500 to-indigo-500"
    },
    prove: {
      title: "See Real Revenue",
      subtitle: "View actual Airbnb earnings data from any market",
      job: "Answer: How much do hosts actually make here?",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-500"
    },
    find: {
      title: "Explore Listings",
      subtitle: "Browse active rentals and see what's working in any area",
      job: "Answer: What properties are succeeding here?",
      icon: Search,
      color: "from-blue-500 to-cyan-500"
    },
    validate: {
      title: "Validate the Deal",
      subtitle: "Check if a specific property will actually make you money",
      job: "Answer: Is this property worth it?",
      icon: Target,
      color: "from-purple-500 to-pink-500"
    },
    compare: {
      title: "Compare Favorites",
      subtitle: "Compare your saved properties side-by-side",
      job: "Answer: Which of my saved properties is the best deal?",
      icon: Trophy,
      color: "from-amber-500 to-orange-500"
    },
    map: {
      title: "See the Map",
      subtitle: "Visualize competitors and compare your property location",
      job: "Answer: How does my property compare to nearby competition?",
      icon: Map,
      color: "from-teal-500 to-cyan-500"
    },
    advisor: {
      title: "AI Advisor",
      subtitle: "Get comprehensive AI-powered analysis of your property",
      job: "Answer: What does all this data mean for me?",
      icon: Sparkles,
      color: "from-amber-500 to-yellow-500"
    },
    market: {
      title: "Market Advisor",
      subtitle: "Deep-dive into any market with 5 years of data",
      job: "Answer: Is this market worth investing in?",
      icon: TrendingUp,
      color: "from-blue-500 to-indigo-500"
    },
    opportunity: {
      title: "Find a Property",
      subtitle: "Browse rentals and validate STR potential instantly",
      job: "Answer: What properties are available in my target market?",
      icon: Search,
      color: "from-rose-500 to-pink-500"
    },
    explore: {
      title: "Explore Comps",
      subtitle: "See similar Airbnb listings in any area",
      job: "Answer: What are similar properties earning?",
      icon: Users,
      color: "from-indigo-500 to-purple-500"
    }
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <>
      <SEOHead
        title="Free Property Analysis Tools"
        description="Analyze rental properties with our free tools. Get revenue estimates, market insights, regulation checks, and AI-powered investment advice for Airbnb & VRBO."
        canonicalPath="/tools"
        keywords={['property analysis', 'rental calculator', 'Airbnb tools', 'market research', 'investment analysis', 'short-term rental']}
        structuredData={createWebPageSchema({
          name: 'Free Property Analysis Tools',
          description: 'Comprehensive rental property analysis tools including revenue calculator, market advisor, and regulation tracker.',
          url: '/tools'
        })}
      />
      <div className="min-h-screen bg-white">
      
      {/* Fixed Header Actions */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <AuthButton />
        <NotificationBell />
      </div>
      
      {/* ============================================ */}
      {/* HERO HEADLINE */}
      {/* ============================================ */}
      <section className="relative pt-12 pb-8 md:pt-20 md:pb-12 bg-gradient-to-b from-[oklch(0.98_0_0)] to-white">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.75_0.14_75)]/10 border border-[oklch(0.75_0.14_75)]/20 rounded-full text-[oklch(0.55_0.12_75)] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Free Tools by Coach Inayah
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-[oklch(0.15_0_0)] mb-6 leading-tight">
            Make Informed{' '}
            <span className="text-[oklch(0.55_0.14_75)]">Rental Decisions</span>
          </h1>
          <p className="text-lg md:text-xl text-[oklch(0.45_0_0)] max-w-2xl mx-auto leading-relaxed mb-8">
            Free research tools to analyze markets, compare properties, and understand the data—so you can decide with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                const toolsSection = document.getElementById('tools-section');
                if (toolsSection) {
                  toolsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="btn-gold-light flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Start Analyzing Now
            </button>
            <a 
              href="https://masterclass.coachinayah.com/the-turnkey-program"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-light flex items-center justify-center gap-2"
            >
              Learn About the Turnkey Program
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          
          {/* Trustpilot Social Proof Banner */}
          <a 
            href="https://www.trustpilot.com/review/coachinayah.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 mt-8 px-5 py-3 bg-white border border-[oklch(0.9_0_0)] rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center gap-1">
              {/* Trustpilot Stars - 4.5 rating */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-5 h-5 bg-[#00b67a] flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                ))}
                {/* Half star for 4.5 */}
                <div className="w-5 h-5 bg-gradient-to-r from-[#00b67a] from-50% to-[#dcdce6] to-50% flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-[oklch(0.25_0_0)]">Excellent</span>
              <span className="text-xs text-[oklch(0.5_0_0)]">57 reviews on <span className="font-medium">Trustpilot</span></span>
            </div>
            <ExternalLink className="w-4 h-4 text-[oklch(0.6_0_0)] group-hover:text-[oklch(0.4_0_0)] transition-colors" />
          </a>
        </div>
      </section>
      

      {/* ============================================ */}
      {/* TOOLS SECTION - JOB-FOCUSED */}
      {/* ============================================ */}
      <section id="tools-section" className="pt-8 pb-20 md:pt-12 md:pb-24">
        <div className="container max-w-4xl mx-auto">
          
          {/* Start With Property - Property-Centric Entry Point */}
          <div className="mb-12">
            <StartWithProperty
              onPropertySet={(property) => {
                // When property is set, auto-fill the validate form
                setAddress(property.address);
                setBedrooms(String(property.bedrooms));
                setBathrooms(String(property.bathrooms));
                if (property.monthlyRent) {
                  setMonthlyRent(String(property.monthlyRent));
                }
              }}
              onNavigateToStep={(step) => {
                setActiveTab(step as TabType);
              }}
            />
          </div>
          
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[oklch(0.55_0.14_75)]/10 border border-[oklch(0.55_0.14_75)]/20 rounded-full text-gold text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Free Tools That Do The Work For You
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[oklch(0.15_0_0)] mb-6">
              Your{' '}
              <span className="text-gradient-gold">
                Research Toolkit
              </span>
            </h2>
            <p className="text-[oklch(0.45_0_0)] text-xl max-w-xl mx-auto leading-relaxed">
              Each tool answers a specific question to help you make informed decisions
            </p>
            
            {/* Saved Items Button */}
            {totalSaved > 0 && (
              <button
                onClick={() => setShowSavedPanel(!showSavedPanel)}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.78_0.12_75)]/10 border border-[oklch(0.78_0.12_75)]/30 rounded-full text-[oklch(0.78_0.12_75)] text-sm font-medium hover:bg-[oklch(0.78_0.12_75)]/20 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                {totalSaved} Saved Item{totalSaved !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          
          {/* Saved Items Panel */}
          {showSavedPanel && (
            <div className="mb-12 bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-2xl p-6">
              <SavedItemsPanel
                savedMarkets={savedMarkets}
                savedProperties={savedProperties}
                onRemoveMarket={removeMarket}
                onRemoveProperty={removeProperty}
                onUpdateMarketNote={updateMarketNote}
                onUpdatePropertyNote={updatePropertyNote}
                onClearAll={clearAll}
                onUseProperty={(property) => {
                  // Auto-fill Step 3 form with saved property data
                  setAddress(property.address);
                  setBedrooms(String(property.bedrooms));
                  setBathrooms(String(property.bathrooms));
                  // Switch to validate tab
                  setActiveTab('validate');
                  // Close the saved panel
                  setShowSavedPanel(false);
                  // Scroll to the form
                  setTimeout(() => {
                    document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                  toast.success('Property loaded! Enter the monthly rent to validate.');
                }}
                onCompareProperties={(properties) => {
                  // Auto-fill Step 4 form with selected properties
                  const bulkInputs = properties.map((prop, index) => ({
                    id: String(index + 1),
                    address: prop.address,
                    bedrooms: prop.bedrooms,
                    bathrooms: prop.bathrooms,
                    rent: 0 // User will need to enter rent
                  }));
                  setBulkProperties(bulkInputs);
                  // Switch to compare tab
                  setActiveTab('compare');
                  // Close the saved panel
                  setShowSavedPanel(false);
                  // Scroll to the form
                  setTimeout(() => {
                    document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                  toast.success(`${properties.length} properties loaded! Enter the monthly rent for each to compare.`);
                }}
              />
            </div>
          )}
          
          {/* Job-Focused Tab Navigation - Horizontal Swipe on Mobile, Grid on Desktop */}
          <div className="relative mb-8 md:mb-12">
            {/* Mobile: Improved Navigation with Clear Affordances */}
            <div className="sm:hidden">
              {/* Header with Step Counter and Navigation Arrows */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-medium text-[oklch(0.45_0_0)]">
                  {(() => {
                    const tabs = ['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[];
                    const currentIndex = tabs.indexOf(activeTab);
                    return `Tool ${currentIndex + 1} of ${tabs.length}`;
                  })()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const tabs = ['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex > 0) {
                        setActiveTab(tabs[currentIndex - 1]);
                      }
                    }}
                    disabled={activeTab === 'ebook'}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-[oklch(0.95_0_0)] border border-[oklch(0.88_0_0)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                    aria-label="Previous tool"
                  >
                    <ChevronLeft className="w-5 h-5 text-[oklch(0.35_0_0)]" />
                  </button>
                  <button
                    onClick={() => {
                      const tabs = ['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex < tabs.length - 1) {
                        setActiveTab(tabs[currentIndex + 1]);
                      }
                    }}
                    disabled={activeTab === 'advisor'}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-[oklch(0.95_0_0)] border border-[oklch(0.88_0_0)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                    aria-label="Next tool"
                  >
                    <ChevronRight className="w-5 h-5 text-[oklch(0.35_0_0)]" />
                  </button>
                </div>
              </div>
              
              {/* Current Tool Card - Full Width */}
              {(() => {
                const job = jobDescriptions[activeTab];
                const Icon = job.icon;
                const tabs = ['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[];
                const currentIndex = tabs.indexOf(activeTab);
                
                return (
                  <div className="apple-card p-4 ring-2 ring-[oklch(0.55_0.14_75)]/30">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[oklch(0.55_0.14_75)]">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-[oklch(0.55_0_0)] font-semibold uppercase tracking-wider bg-[oklch(0.92_0_0)] px-2 py-0.5 rounded">
                            {activeTab === 'ebook' ? 'Guide' : `Step ${currentIndex}`}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base text-[oklch(0.55_0.14_75)] mb-1">
                          {job.title}
                        </h3>
                        <p className="text-sm text-[oklch(0.45_0_0)] leading-snug">
                          {job.job}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Quick Jump Pills */}
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {(['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[]).map((tab, index) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[oklch(0.55_0.14_75)] text-white'
                          : 'bg-[oklch(0.95_0_0)] text-[oklch(0.45_0_0)] border border-[oklch(0.88_0_0)]'
                      }`}
                    >
                      {tab === 'ebook' ? 'Guide' : index}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Desktop: Grid Layout */}
            <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(['ebook', 'regulations', 'opportunity', 'prove', 'find', 'validate', 'compare', 'map', 'market', 'advisor'] as TabType[]).map((tab, index) => {
                const job = jobDescriptions[tab];
                const Icon = job.icon;
                const isActive = activeTab === tab;
                
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative p-4 rounded-2xl transition-all duration-300 text-left min-h-[120px] ${
                      isActive
                        ? 'apple-card ring-2 ring-[oklch(0.55_0.14_75)]/30'
                        : 'apple-card hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isActive 
                          ? 'bg-[oklch(0.55_0.14_75)]' 
                          : 'bg-[oklch(0.92_0_0)]'
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[oklch(0.50_0_0)]'}`} />
                      </div>
                      <span className="text-[10px] text-[oklch(0.55_0_0)] font-medium uppercase tracking-wider">
                        {tab === 'ebook' ? 'Guide' : tab === 'regulations' ? 'Step 1' : tab === 'opportunity' ? 'Step 2' : tab === 'prove' ? 'Step 3' : tab === 'find' ? 'Step 4' : tab === 'validate' ? 'Step 5' : tab === 'compare' ? 'Step 6' : tab === 'map' ? 'Step 7' : tab === 'market' ? 'Step 8' : tab === 'advisor' ? 'Step 9' : `Step ${index}`}
                      </span>
                    </div>
                    <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${isActive ? 'text-[oklch(0.55_0.14_75)]' : 'text-[oklch(0.25_0_0)]'}`}>
                      {job.title}
                    </h3>
                    <p className="text-xs text-[oklch(0.55_0_0)] leading-snug line-clamp-2">
                      {job.job}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          
          
          {/* Tool Content Area */}
          <div 
            ref={toolContentRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="apple-card p-4 sm:p-6 md:p-8 lg:p-12"
          >
            
            {/* Current Job Header */}
            <div className="mb-6 sm:mb-8 md:mb-10 pb-6 sm:pb-8 md:pb-10 border-b border-[oklch(0.92_0_0)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 sm:gap-5">
                  {(() => {
                    const job = jobDescriptions[activeTab];
                    const Icon = job.icon;
                    return (
                      <>
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[oklch(0.55_0.14_75)] flex items-center justify-center glow-gold flex-shrink-0">
                          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)]">{job.title}</h3>
                          <p className="text-[oklch(0.50_0_0)] text-sm sm:text-base md:text-lg">{job.subtitle}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {/* Share Button - appears on all tools except ebook */}
                {activeTab !== 'ebook' && (
                  <ShareToolButton
                    step={activeTab === 'regulations' ? 1 : activeTab === 'opportunity' ? 2 : activeTab === 'prove' ? 3 : activeTab === 'find' ? 4 : activeTab === 'validate' ? 5 : activeTab === 'compare' ? 6 : activeTab === 'map' ? 7 : activeTab === 'market' ? 8 : activeTab === 'advisor' ? 9 : 1}
                    city={myProperty?.city || exploreAddress?.split(',')[0]?.trim()}
                    state={myProperty?.state || exploreAddress?.split(',')[1]?.trim()}
                    zipCode={myProperty?.zipCode}
                    address={address || myProperty?.address}
                    bedrooms={myProperty?.bedrooms || (bedrooms ? parseInt(bedrooms) : undefined)}
                    bathrooms={myProperty?.bathrooms || (bathrooms ? parseFloat(bathrooms) : undefined)}
                    rent={myProperty?.monthlyRent || (monthlyRent ? parseInt(monthlyRent) : undefined)}
                    variant="outline"
                    size="sm"
                    showLabel={true}
                  />
                )}
              </div>
              <p className="text-gold font-medium text-sm sm:text-base md:text-lg mt-3 sm:mt-4 md:mt-5">
                {jobDescriptions[activeTab].job}
              </p>
            </div>
            
            {/* ============================================ */}
            {/* EBOOK TAB */}
            {/* ============================================ */}
            {activeTab === 'ebook' && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <p className="text-[oklch(0.50_0_0)] text-lg leading-relaxed">
                    Start here to learn the fundamentals of Airbnb arbitrage. This guide will teach you everything you need to know before using the analysis tools.
                  </p>
                </div>
                <InlineEbook onStartTools={() => {
                  setActiveTab('prove');
                }} />
              </div>
            )}
            
            {/* ============================================ */}
            {/* REGULATIONS TAB */}
            {/* ============================================ */}
            {activeTab === 'regulations' && (
              <div data-tool-panel="regulations">
                <RegulationTrackerStep />
              </div>
            )}
            
            {/* ============================================ */}
            {/* PROVE THE MARKET TAB */}
            {/* ============================================ */}
            {activeTab === 'prove' && (
              <div className="space-y-8" data-tool-panel="prove">
                <HelpSection
                  title="How This Tool Helps You"
                  description="See real revenue data from actual Airbnb hosts to prove that short-term rentals make money in any market"
                  example="You're curious about Nashville and want to see if hosts there are actually making good money before you invest any time researching properties."
                  steps={[
                    'Select a state from the dropdown',
                    'Choose a city/metro, then optionally narrow down to neighborhood or zip code',
                    'Click the search button at your desired level',
                    'See average revenue hosts are actually making',
                    'View occupancy rates and seasonal trends'
                  ]}
                  isOpen={showHelp === 'prove'}
                  onToggle={() => setShowHelp(showHelp === 'prove' ? null : 'prove')}
                />
                
                {/* Back to Property Button */}
                <BackToPropertyButton className="mb-4" />
                
                {/* Hierarchical Location Selector */}
                <div className="space-y-4">
                  <label className="block text-base font-medium text-[oklch(0.25_0_0)]">
                    Select Your Market
                  </label>
                  <HierarchicalLocationSelector
                    onSelectionChange={setLocationSelection}
                    onSearch={handleHierarchicalSearch}
                    disabled={isResearching}
                    initialZipCode={proveInitialZipCode}
                    initialCity={proveInitialCity}
                    initialState={proveInitialState}
                    autoSearch={!!proveInitialZipCode || (!!proveInitialCity && !!proveInitialState)}
                  />
                </div>
                
                {/* Loading indicator when researching */}
                {isResearching && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <div className="w-6 h-6 border-2 border-[oklch(0.75_0.15_75)]/30 border-t-[oklch(0.75_0.15_75)] rounded-full animate-spin" />
                    <span className="text-[oklch(0.50_0_0)] text-lg">Analyzing market data...</span>
                  </div>
                )}
              </div>
            )}
            
            {/* ============================================ */}
            {/* FIND YOUR MARKET TAB - See What's Working */}
            {/* ============================================ */}
            {activeTab === 'find' && (
              <div className="space-y-8">
                <HelpSection
                  title="What You'll Discover"
                  description="See real Airbnb properties that are actually making money in your target city or neighborhood. This helps you understand what success looks like before you invest."
                  example="You've heard St. Louis has good Airbnb potential. Now you want to see actual properties making $50K+ per year so you know what to look for."
                  steps={[
                    'Type a zip code, city, or neighborhood (e.g., "63101", "St. Louis", or "Central West End")',
                    'Select from the dropdown to see which zip codes are included',
                    'Filter by bedroom count if you have a target property type',
                    'Browse real listings sorted by annual revenue',
                    'See which neighborhoods perform best within the city'
                  ]}
                  isOpen={showHelp === 'find'}
                  onToggle={() => setShowHelp(showHelp === 'find' ? null : 'find')}
                />
                
                {/* Guiding Question */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-blue-800 font-medium flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    What does a successful Airbnb look like in my target area?
                  </p>
                </div>
                
                {/* Market Search */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    <InfoTooltip content="Search for a city or neighborhood. The dropdown shows how many active Airbnb properties are in each area and which zip codes are included.">
                      <span>City or Neighborhood</span>
                    </InfoTooltip>
                  </label>
                  <MarketAutocomplete
                    onSelect={(market) => {
                      // Log the current filter values for debugging
                      console.log('[MarketAutocomplete onSelect] Current filter values:', {
                        exploreBedroomFilter,
                        exploreBedroomFilterRef: exploreBedroomFilterRef.current,
                        exploreSortBy,
                        exploreSortByRef: exploreSortByRef.current,
                      });
                      // Use ref values which are updated immediately on change
                      handleMarketSearch(market, { 
                        bedrooms: exploreBedroomFilterRef.current, 
                        sortBy: exploreSortByRef.current 
                      });
                    }}
                    placeholder="Type a zip code, city, or neighborhood (e.g., 63101, St. Louis)..."
                    initialValue={exploreAddress} // Pre-fill from URL params (HubSpot emails)
                  />
                </div>
                
                {/* Optional Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)] flex items-center gap-2">
                      <InfoTooltip content="Filter by bedroom count to see properties similar to what you're looking for. This gives you an apples-to-apples comparison.">
                        <span>Bedrooms</span>
                      </InfoTooltip>
                      {hasProperty && exploreBedroomFilter === myProperty?.bedrooms && (
                        <span className="text-xs px-2 py-0.5 bg-[oklch(0.55_0.14_75)]/10 text-[oklch(0.55_0.14_75)] rounded-full">
                          Apples-to-apples
                        </span>
                      )}
                    </label>
                    <select
                      value={exploreBedroomFilter ?? ''}
                      onChange={(e) => {
                        const newValue = e.target.value ? parseInt(e.target.value) : null;
                        console.log('Bedroom filter changed to:', newValue, 'selectedMarket:', selectedMarket?.name);
                        setExploreBedroomFilter(newValue);
                        exploreBedroomFilterRef.current = newValue; // Update ref immediately
                        userSetBedroomFilterRef.current = true; // Mark that user manually set this filter
                        // Re-search if market is already selected, passing new value directly
                        if (selectedMarket) {
                          console.log('Triggering market search with bedrooms:', newValue);
                          handleMarketSearch(selectedMarket, { bedrooms: newValue });
                        }
                      }}
                      className="input-apple h-12"
                    >
                      <option value="">Any</option>
                      <option value="0">Studio</option>
                      <option value="1">1 Bedroom</option>
                      <option value="2">2 Bedrooms</option>
                      <option value="3">3 Bedrooms</option>
                      <option value="4">4 Bedrooms</option>
                      <option value="5">5+ Bedrooms</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      <InfoTooltip content="Sort results by what matters most to you. 'Highest Revenue' shows top earners first.">
                        <span>Sort By</span>
                      </InfoTooltip>
                    </label>
                    <select
                      value={exploreSortBy}
                      onChange={(e) => {
                        const newValue = e.target.value as typeof exploreSortBy;
                        setExploreSortBy(newValue);
                        exploreSortByRef.current = newValue; // Update ref immediately
                        // Re-search if market is already selected, passing new value directly
                        if (selectedMarket) {
                          handleMarketSearch(selectedMarket, { sortBy: newValue });
                        }
                      }}
                      className="input-apple h-12"
                    >
                      <option value="revenue">Highest Revenue</option>
                      <option value="occupancy">Highest Booking Rate</option>
                      <option value="rating">Best Rated</option>
                    </select>
                  </div>
                </div>
                
                {/* Loading State */}
                {isLoadingMarketListings && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-neutral-600">Loading properties...</span>
                  </div>
                )}
              </div>
            )}
            
            {/* ============================================ */}
            {/* VALIDATE THE DEAL TAB */}
            {/* ============================================ */}
            {activeTab === 'validate' && (
              <div className="space-y-8" data-tool-panel="validate">
                <HelpSection
                  title="Run the Numbers on Your Deal"
                  description="Found a property you like? Enter the exact address and rent amount to see projected revenue, profit margins, and how it compares to similar properties nearby."
                  example="You found a 2-bedroom apartment on Zillow for $1,800/month in East Nashville and want to know if it will actually make you money as a short-term rental."
                  steps={[
                    'Enter the exact property address you found',
                    'Enter the monthly rent the landlord is asking',
                    'Select the bedroom and bathroom count',
                    'Click "Validate This Deal" to analyze',
                    'Review projected revenue, profit, and market comparison'
                  ]}
                  isOpen={showHelp === 'validate'}
                  onToggle={() => setShowHelp(showHelp === 'validate' ? null : 'validate')}
                />
                
                {/* Visual indicator when data is synced from Step 1 */}
                {hasProperty && myProperty?.address && address === myProperty.address && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-center w-5 h-5 bg-amber-500 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-amber-800">
                      Property loaded from Step 1
                    </span>
                    <span className="text-xs text-amber-600 ml-auto">
                      {myProperty.bedrooms} BR • {myProperty.bathrooms} BA
                      {globalMode === 'purchase' && myProperty.purchasePrice && (
                        <> • ${myProperty.purchasePrice.toLocaleString()}</>
                      )}
                      {globalMode === 'rent' && myProperty.monthlyRent && (
                        <> • ${myProperty.monthlyRent.toLocaleString()}/mo</>
                      )}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <InfoTooltip content="Paste a Zillow or Redfin listing URL to auto-fill property details, or type an address manually. URLs automatically extract bedrooms, bathrooms, and rent/price.">
                    <span className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Property Address or Zillow/Redfin URL
                    </span>
                  </InfoTooltip>
                  <SmartAddressInput
                    value={address}
                    onChange={setAddress}
                    onPropertyDetected={(details) => {
                      // Auto-fill property details from Zillow
                      if (details.bedrooms !== null) {
                        setBedrooms(String(details.bedrooms));
                      }
                      if (details.bathrooms !== null) {
                        setBathrooms(String(details.bathrooms));
                      }
                      if (details.price !== null && details.priceType === 'rent') {
                        setMonthlyRent(String(details.price));
                      }
                      toast.success(`Property details loaded from Zillow!`);
                    }}
                    placeholder="Enter address or paste Zillow/Redfin URL..."
                    showPropertyCard={true}
                  />
                </div>
                
                {/* RENT MODE: Monthly Rent */}
                {globalMode === 'rent' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Monthly Rent <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        value={monthlyRent}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || parseFloat(val) >= 0) {
                            setMonthlyRent(val);
                            setRentometerData(null);
                          }
                        }}
                        placeholder="2000"
                        className="input-apple h-12"
                      />
                      {isLoadingRentometer && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PURCHASE MODE: Purchase Price & Financing */}
                {globalMode === 'purchase' && (
                  <div className="space-y-4">
                    {/* Purchase Price */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                        Purchase Price <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={myProperty?.purchasePrice || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || parseFloat(val) >= 0) {
                            // Initialize myProperty if null (user went directly to Step 5)
                            if (myProperty) {
                              setMyProperty({
                                ...myProperty,
                                purchasePrice: val ? parseFloat(val) : undefined
                              });
                            } else {
                              // Create new property with default values
                              setMyProperty({
                                address: address || '',
                                city: '',
                                state: '',
                                zipCode: '',
                                bedrooms: parseInt(bedrooms) || 2,
                                bathrooms: parseFloat(bathrooms) || 1,
                                purchasePrice: val ? parseFloat(val) : undefined,
                                loanType: 'conventional',
                                downPaymentPercent: 20,
                                interestRate: 7
                              });
                            }
                          }
                        }}
                        placeholder="450000"
                        className="input-apple h-12"
                      />
                    </div>

                    {/* Loan Type */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                        Loan Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['conventional', 'dscr', 'fha', 'cash'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              if (myProperty) {
                                setMyProperty({
                                  ...myProperty,
                                  loanType: type,
                                  downPaymentPercent: type === 'fha' ? 3.5 : type === 'cash' ? 100 : (myProperty.downPaymentPercent || 20)
                                });
                              }
                            }}
                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                              myProperty?.loanType === type
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                            }`}
                          >
                            {type === 'conventional' ? 'Conv.' : type.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Down Payment & Interest Rate (not for Cash) */}
                    {myProperty?.loanType !== 'cash' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                            Down Payment %
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={myProperty?.downPaymentPercent || 20}
                            onChange={(e) => {
                              if (myProperty) {
                                setMyProperty({
                                  ...myProperty,
                                  downPaymentPercent: parseFloat(e.target.value) || 20
                                });
                              }
                            }}
                            className="input-apple h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                            Interest Rate %
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            step="0.125"
                            value={myProperty?.interestRate || 7}
                            onChange={(e) => {
                              if (myProperty) {
                                setMyProperty({
                                  ...myProperty,
                                  interestRate: parseFloat(e.target.value) || 7
                                });
                              }
                            }}
                            className="input-apple h-12"
                          />
                        </div>
                      </div>
                    )}

                    {/* Financing Summary */}
                    {myProperty?.purchasePrice && (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Financing Summary</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Down Payment:</span>
                            <span className="ml-2 font-medium">
                              ${Math.round(myProperty.purchasePrice * (myProperty.downPaymentPercent || 20) / 100).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Loan Amount:</span>
                            <span className="ml-2 font-medium">
                              ${Math.round(myProperty.purchasePrice * (1 - (myProperty.downPaymentPercent || 20) / 100)).toLocaleString()}
                            </span>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-200">
                            <span className="text-slate-500">Monthly Mortgage:</span>
                            <span className="ml-2 font-semibold text-amber-600">
                              ${(() => {
                                if (myProperty.loanType === 'cash') return '0';
                                const principal = myProperty.purchasePrice * (1 - (myProperty.downPaymentPercent || 20) / 100);
                                const monthlyRate = (myProperty.interestRate || 7) / 100 / 12;
                                const numPayments = 30 * 12;
                                const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                                return Math.round(payment).toLocaleString();
                              })()}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Bedrooms & Bathrooms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Beds
                    </label>
                    <select
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="input-apple h-12"
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num} Bedroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Baths
                    </label>
                    <select
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="input-apple h-12"
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                        <option key={num} value={num}>{num} Bathroom{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Furniture/Setup Cost */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    Furniture & Setup Cost
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={furnitureCost}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        setFurnitureCost(val);
                      }
                    }}
                    placeholder="15000"
                    className="input-apple h-12"
                  />
                  <p className="text-xs text-slate-500">Estimated cost to furnish and set up the property</p>
                </div>
                
                {/* Expense Percentage Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      Operating Expenses
                    </label>
                    <span className="text-sm font-semibold text-amber-600">{expensePercent}%</span>
                  </div>
                  <div className="relative pb-8">
                    <input
                      type="range"
                      min="10"
                      max="40"
                      step="5"
                      value={expensePercent}
                      onChange={(e) => setExpensePercent(parseInt(e.target.value))}
                      className="expense-slider"
                      style={{ '--slider-progress': `${((expensePercent - 10) / 30) * 100}%` } as React.CSSProperties}
                    />
                    {/* Tick marks - positioned at actual percentage positions */}
                    {/* 10% = 0%, 20% = 33.33%, 30% = 66.67%, 40% = 100% of the range */}
                    <div className="absolute top-4 left-0 right-0 pointer-events-none">
                      {/* 10% tick - at 0% */}
                      <div className="absolute left-0 flex flex-col items-center" style={{ transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">10%</span>
                      </div>
                      {/* 20% tick - at 33.33% (recommended) */}
                      <div className="absolute flex flex-col items-center" style={{ left: '33.33%', transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-3 bg-emerald-500"></div>
                        <span className="text-[10px] text-emerald-600 font-medium mt-1">20%</span>
                        <span className="text-[9px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">Recommended</span>
                      </div>
                      {/* 30% tick - at 66.67% */}
                      <div className="absolute flex flex-col items-center" style={{ left: '66.67%', transform: 'translateX(-50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">30%</span>
                      </div>
                      {/* 40% tick - at 100% */}
                      <div className="absolute right-0 flex flex-col items-center" style={{ transform: 'translateX(50%)' }}>
                        <div className="w-0.5 h-2 bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 mt-1">40%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-4">
                    <span>Below Avg</span>
                    <span>Above Avg</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Covers cleaning, supplies, utilities, repairs, and platform fees</p>
                </div>
                
                {/* Login Requirement Section */}
                {!isAuthenticated ? (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-semibold">Create Free Account to Continue</span>
                    </div>
                    <p className="text-sm text-amber-800/80">Sign up for free to run unlimited property analyses and save your results.</p>
                    
                    <button
                      onClick={() => window.location.href = getLoginUrl()}
                      className="btn-gold w-full h-12 flex items-center justify-center gap-2"
                    >
                      <Users className="w-5 h-5" />
                      <span>Create Free Account</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Logged in as {user?.name || user?.email || 'User'}</span>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !address || (globalMode === 'rent' ? (!monthlyRent || parseFloat(monthlyRent) <= 0) : (!myProperty?.purchasePrice || myProperty.purchasePrice <= 0)) || !isAuthenticated}
                  className="btn-gold w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-analyze-button
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[oklch(0.55_0.14_75)]/30 border-t-[oklch(0.55_0.14_75)] rounded-full animate-spin" />
                      <span>Validating Deal... ({analysisTimer}s)</span>
                    </>
                  ) : (
                    <>
                      <Target className="w-5 h-5" />
                      <span>Validate This Deal</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* ============================================ */}
            {/* COMPARE FAVORITES TAB */}
            {/* ============================================ */}
            {activeTab === 'compare' && (
              <div className="space-y-8">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Compare your saved favorites from the Map view side-by-side to find which one will make you the most money"
                  example="You've saved 5 properties from the Map view and want to see which one has the best profit potential. Select the ones you want to compare and see them ranked."
                  steps={[
                    'Save properties from the Map view by clicking the heart icon',
                    'Come here to see all your favorites',
                    'Enter estimated rent for each property',
                    'Select properties to compare',
                    'See them ranked by profit potential'
                  ]}
                  isOpen={showHelp === 'compare'}
                  onToggle={() => setShowHelp(showHelp === 'compare' ? null : 'compare')}
                />
                
                <CompareFavoritesSection 
                  onNavigateToMap={() => setActiveTab('map')}
                />
              </div>
            )}
            
            {/* ============================================ */}
            {/* AI ADVISOR TAB */}
            {/* ============================================ */}
            {activeTab === 'advisor' && result && (
              <AIAdvisorStep
                property={{
                  address: address,
                  city: '',
                  state: '',
                  zipCode: '',
                  bedrooms: parseInt(bedrooms) || 2,
                  bathrooms: parseFloat(bathrooms) || 1,
                  accommodates: (parseInt(bedrooms) || 2) * 2,
                  monthlyRent: parseFloat(monthlyRent) || undefined,
                }}
                revenue={{
                  projected: result.revenue.projected,
                  low: result.revenue.low,
                  high: result.revenue.high,
                  adr: result.metrics.adr,
                  occupancy: result.metrics.occupancy,
                  revpar: result.metrics.adr * result.metrics.occupancy,
                }}
                cashFlow={result.cashFlow.monthlyRent ? {
                  monthlyRevenue: result.cashFlow.monthlyRevenue,
                  monthlyRent: result.cashFlow.monthlyRent,
                  monthlyProfit: result.cashFlow.monthlyProfit,
                  annualProfit: result.cashFlow.monthlyProfit * 12,
                  profitMargin: (result.cashFlow.monthlyProfit / result.cashFlow.monthlyRevenue) * 100,
                  breakEvenOccupancy: result.cashFlow.monthlyRent / (result.metrics.adr * 30),
                } : undefined}
                comparables={(result.comparables || []).map(c => ({
                  title: c.title,
                  bedrooms: c.bedrooms,
                  bathrooms: c.bathrooms,
                  accommodates: c.accommodates,
                  revenue: c.revenue,
                  adr: c.adr,
                  occupancy: c.occupancy,
                  revpar: c.adr * c.occupancy,
                  rating: c.rating,
                  reviews: c.reviews,
                  distanceMeters: c.distanceMeters,
                }))}
                marketInsights={{
                  professionallyManagedPct: result.marketInsights?.professionallyManagedPct || 0,
                  superhostPct: result.marketInsights?.superhostPct || 0,
                  avgRating: result.marketInsights?.avgRating || 0,
                  totalListings: result.marketInsights?.totalListings || 0,
                  marketScore: result.marketInsights?.marketScore || 50,
                }}
                historicalData={{
                  yoyChange: result.historicalData?.summary?.yearly_pct_change || 0,
                  trend: (result.historicalData?.summary?.trend as 'up' | 'down' | 'stable') || 'stable',
                  months: (result.historicalData?.months || []).map((m: { date: string; revenue: number; occupancy: number; adr: number; listingCount?: number }) => ({
                    date: m.date,
                    revenue: m.revenue,
                    occupancy: m.occupancy,
                    adr: m.adr,
                    revpar: m.adr * m.occupancy,
                    listingCount: m.listingCount,
                  })),
                }}
                seasonality={(result.forecast || []).map((s: { month: string; revenue: number; adr: number; occupancy: number }) => ({
                  month: s.month,
                  revenue: s.revenue,
                  adr: s.adr,
                  occupancy: s.occupancy,
                  revpar: s.adr * s.occupancy,
                  yoyChange: undefined,
                }))}
                marketGrade={{
                  grade: 'C',
                  score: result.marketInsights?.marketScore || 50,
                  description: 'Market conditions based on available data',
                  factors: [],
                }}
                marketPosition={{
                  percentile: 50,
                  rank: 0,
                  totalListings: result.marketInsights?.totalListings || 0,
                  vsAverage: 0,
                }}
                mode={globalMode}
                purchaseData={globalMode === 'purchase' && myProperty?.purchasePrice ? {
                  purchasePrice: myProperty.purchasePrice,
                  loanType: (myProperty.loanType || 'conventional') as 'conventional' | 'dscr' | 'fha' | 'cash',
                  downPaymentPercent: myProperty.downPaymentPercent || 20,
                  downPayment: myProperty.purchasePrice * ((myProperty.downPaymentPercent || 20) / 100),
                  loanAmount: myProperty.purchasePrice * (1 - (myProperty.downPaymentPercent || 20) / 100),
                  interestRate: myProperty.interestRate || 7,
                  monthlyMortgage: (() => {
                    const principal = myProperty.purchasePrice * (1 - (myProperty.downPaymentPercent || 20) / 100);
                    const monthlyRate = (myProperty.interestRate || 7) / 100 / 12;
                    const numPayments = 30 * 12;
                    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                  })(),
                  closingCosts: myProperty.purchasePrice * 0.03,
                  totalCashNeeded: myProperty.purchasePrice * ((myProperty.downPaymentPercent || 20) / 100) + myProperty.purchasePrice * 0.03,
                } : undefined}
              />
            )}

            {activeTab === 'advisor' && !result && (
              <div className="max-w-2xl mx-auto">
                {/* Back to Property Button */}
                <BackToPropertyButton className="mb-6" />
                
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl mb-4">
                    <Sparkles className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">AI Property Advisor</h2>
                  <p className="text-slate-600">
                    Get AI-powered analysis of any property. Enter an address below to see projected revenue, 
                    market insights, and personalized recommendations.
                  </p>
                </div>
                
                {/* Standalone Address Input Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="space-y-4">
                    {/* Address Input - Smart Input accepts Zillow URLs */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Property Address or Zillow/Redfin URL</label>
                      <SmartAddressInput
                        value={address}
                        onChange={setAddress}
                        onPropertyDetected={(details) => {
                          if (details.bedrooms !== null) setBedrooms(String(details.bedrooms));
                          if (details.bathrooms !== null) setBathrooms(String(details.bathrooms));
                          if (details.price !== null && details.priceType === 'rent') setMonthlyRent(String(details.price));
                          toast.success(`Property details loaded from Zillow!`);
                        }}
                        placeholder="Enter address or paste Zillow/Redfin URL..."
                        showPropertyCard={true}
                      />
                    </div>
                    
                    {/* Property Details Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bedrooms</label>
                        <select
                          value={bedrooms}
                          onChange={(e) => setBedrooms(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n} value={n}>{n} BR</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bathrooms</label>
                        <select
                          value={bathrooms}
                          onChange={(e) => setBathrooms(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        >
                          {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => (
                            <option key={n} value={n}>{n} BA</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Rent</label>
                        <Input
                          type="number"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(e.target.value)}
                          placeholder="Optional"
                          min="0"
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    {/* Analyze Button */}
                    <Button
                      onClick={handleAnalyze}
                      disabled={!address || isAnalyzing}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 text-lg font-semibold"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Analyzing Property...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Get AI Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Or use existing data hint */}
                {hasProperty && myProperty?.address && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500 mb-2">Or use your saved property:</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddress(myProperty.address);
                        setBedrooms(String(myProperty.bedrooms));
                        setBathrooms(String(myProperty.bathrooms));
                        if (myProperty.monthlyRent) setMonthlyRent(String(myProperty.monthlyRent));
                      }}
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Use {myProperty.address.split(',')[0]}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================ */}
            {/* MARKET ADVISOR TAB */}
            {/* ============================================ */}
            <div className={activeTab === 'market' ? '' : 'hidden'} data-tool-panel="market">
              <StandaloneMarketAdvisor key="market-advisor-stable" myProperty={myProperty || undefined} />
            </div>

            {/* ============================================ */}
            {/* OPPORTUNITY FINDER TAB (Step 8) */}
            {/* ============================================ */}
            {/* ============================================ */}
            {/* EXPLORE TAB - Redirects to Find with pre-filled data */}
            {/* ============================================ */}
            {activeTab === 'explore' && (
              <div className="space-y-8" data-tool-panel="explore">
                <HelpSection
                  title="What You'll Discover"
                  description="See real Airbnb properties that are actually making money in your target city or neighborhood. This helps you understand what success looks like before you invest."
                  example="You've heard St. Louis has good Airbnb potential. Now you want to see actual properties making $50K+ per year so you know what to look for."
                  steps={[
                    'Type a zip code, city, or neighborhood (e.g., "63101", "St. Louis", or "Central West End")',
                    'Select from the dropdown to see which zip codes are included',
                    'Filter by bedroom count if you have a target property type',
                    'Browse real listings sorted by annual revenue',
                    'See which neighborhoods perform best within the city'
                  ]}
                  isOpen={showHelp === 'explore'}
                  onToggle={() => setShowHelp(showHelp === 'explore' ? null : 'explore')}
                />
                
                {/* Back to Property Button */}
                <BackToPropertyButton className="mb-4" />
                
                {/* Guiding Question */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-indigo-800 font-medium flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    What are similar properties earning in this area?
                  </p>
                </div>
                
                {/* Market Search */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                    <InfoTooltip content="Search for a city or neighborhood. The dropdown shows how many active Airbnb properties are in each area and which zip codes are included.">
                      <span>City or Neighborhood</span>
                    </InfoTooltip>
                  </label>
                  <MarketAutocomplete
                    onSelect={(market) => {
                      // Log the current filter values for debugging
                      console.log('[Explore Tab] Market selected:', market);
                      // Use ref values which are updated immediately on change
                      handleMarketSearch(market, { 
                        bedrooms: exploreBedroomFilterRef.current, 
                        sortBy: exploreSortByRef.current 
                      });
                    }}
                    placeholder="Type a zip code, city, or neighborhood (e.g., 63101, St. Louis)..."
                  />
                </div>
                
                {/* Optional Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)] flex items-center gap-2">
                      <InfoTooltip content="Filter by bedroom count to see properties similar to what you're looking for. This gives you an apples-to-apples comparison.">
                        <span>Bedrooms</span>
                      </InfoTooltip>
                      {hasProperty && exploreBedroomFilter === myProperty?.bedrooms && (
                        <span className="text-xs px-2 py-0.5 bg-[oklch(0.55_0.14_75)]/10 text-[oklch(0.55_0.14_75)] rounded-full">
                          Apples-to-apples
                        </span>
                      )}
                    </label>
                    <select
                      value={exploreBedroomFilter ?? ''}
                      onChange={(e) => {
                        const newValue = e.target.value ? parseInt(e.target.value) : null;
                        console.log('[Explore Tab] Bedroom filter changed to:', newValue);
                        setExploreBedroomFilter(newValue);
                        exploreBedroomFilterRef.current = newValue;
                        userSetBedroomFilterRef.current = true;
                        if (selectedMarket) {
                          handleMarketSearch(selectedMarket, { bedrooms: newValue });
                        }
                      }}
                      className="input-apple h-12"
                      data-explore-button
                    >
                      <option value="">Any</option>
                      <option value="0">Studio</option>
                      <option value="1">1 Bedroom</option>
                      <option value="2">2 Bedrooms</option>
                      <option value="3">3 Bedrooms</option>
                      <option value="4">4 Bedrooms</option>
                      <option value="5">5+ Bedrooms</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[oklch(0.45_0.01_265)]">
                      <InfoTooltip content="Sort results by what matters most to you. 'Highest Revenue' shows top earners first.">
                        <span>Sort By</span>
                      </InfoTooltip>
                    </label>
                    <select
                      value={exploreSortBy}
                      onChange={(e) => {
                        const newValue = e.target.value as typeof exploreSortBy;
                        setExploreSortBy(newValue);
                        exploreSortByRef.current = newValue;
                        if (selectedMarket) {
                          handleMarketSearch(selectedMarket, { sortBy: newValue });
                        }
                      }}
                      className="input-apple h-12"
                    >
                      <option value="revenue">Highest Revenue</option>
                      <option value="occupancy">Highest Booking Rate</option>
                      <option value="rating">Best Rated</option>
                      <option value="adr">Highest Nightly Rate</option>
                    </select>
                  </div>
                </div>
                
                {/* Loading State */}
                {isLoadingMarketListings && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <span className="ml-3 text-slate-600">Loading comparable properties...</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'opportunity' && (
              <div className="space-y-8" data-tool-panel="opportunity">
                <HelpSection
                  title="How This Tool Helps You"
                  description="Browse available rentals on Zillow and instantly validate their STR profit potential without leaving this page."
                  example="You've identified a promising market and want to find actual rental listings you could lease for arbitrage. Search by city or zip code, then click 'Analyze' on any property to see projected revenue."
                  steps={[
                    'Enter a city name or zip code in the search box',
                    'Optionally filter by price range, bedrooms, or property type',
                    'Browse the available rental listings',
                    'Click "Analyze Property" on any listing to see STR revenue projections',
                    'Use "Contact Now" to reach out to landlords directly',
                    'Compare deals and apply for the Turnkey Program when ready'
                  ]}
                  isOpen={showHelp === 'opportunity'}
                  onToggle={() => setShowHelp(showHelp === 'opportunity' ? null : 'opportunity')}
                />
                <OpportunityFinderStep
                  initialLocation={exploreAddress} // Pass location from URL params (HubSpot emails)
                  onSelectProperty={(property) => {
                    // Pre-fill the validate tab with this property (but don't switch tabs)
                    // This allows action buttons to appear on the card after analysis
                    setAddress(property.address);
                    setBedrooms(String(property.bedrooms));
                    setBathrooms(String(property.bathrooms));
                    setMonthlyRent(String(property.monthlyRent));
                    // Don't switch tabs - let user see action buttons on the card
                    // setActiveTab('validate');
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* MAP TAB - FULL WIDTH (outside container) */}
      {/* ============================================ */}
      {activeTab === 'map' && (
        <section className="bg-slate-50" data-tool-panel="map">
          <MapFirstLayoutV2 
            key={`map-${myProperty?.address || 'no-property'}`}
            embedded={false} 
            className="min-h-[600px]" 
          />
        </section>
      )}

      {/* ============================================ */}
      {/* RESULTS SECTIONS */}
      {/* ============================================ */}
      
      {/* Prove the Market Results - Loading Skeleton */}
      {activeTab === 'prove' && isResearching && (
        <section className="py-12 bg-[oklch(0.97_0_0)]">
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[oklch(0.90_0_0)] rounded-full mb-4 animate-pulse">
                <div className="w-4 h-4 bg-[oklch(0.85_0_0)] rounded-full" />
                <div className="w-24 h-4 bg-[oklch(0.85_0_0)] rounded" />
              </div>
              <div className="h-8 w-64 bg-[oklch(0.90_0_0)] rounded mx-auto mb-2 animate-pulse" />
              <div className="h-4 w-80 bg-[oklch(0.92_0_0)] rounded mx-auto animate-pulse" />
            </div>
            
            {/* Key Metrics Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-4 text-center">
                  <div className="h-4 w-24 bg-[oklch(0.90_0_0)] rounded mx-auto mb-2 animate-pulse" />
                  <div className="h-8 w-20 bg-[oklch(0.88_0_0)] rounded mx-auto animate-pulse" />
                </div>
              ))}
            </div>
            
            {/* Property Types Skeleton */}
            <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-48 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                <div className="h-5 w-24 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-[oklch(0.96_0_0)] rounded-lg p-4 border border-[oklch(0.92_0_0)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-5 w-20 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                      <div className="h-4 w-12 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-full bg-[oklch(0.92_0_0)] rounded mb-2 animate-pulse" />
                    <div className="flex justify-between">
                      <div className="h-4 w-16 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                      <div className="h-4 w-12 bg-[oklch(0.90_0_0)] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Seasonality Skeleton */}
            <div className="bg-[oklch(0.98_0_0)] border border-[oklch(0.90_0_0)] rounded-xl p-6 mb-8">
              <div className="h-6 w-40 bg-[oklch(0.90_0_0)] rounded mb-4 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="h-4 w-32 bg-[oklch(0.92_0_0)] rounded mb-3 animate-pulse" />
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-[oklch(0.90_0_0)] rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="h-4 w-40 bg-[oklch(0.92_0_0)] rounded mb-3 animate-pulse" />
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-8 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-[oklch(0.90_0_0)] rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />
                      <div className="h-3 w-10 bg-[oklch(0.92_0_0)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Loading message */}
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 text-[oklch(0.50_0_0)]">
                <div className="w-5 h-5 border-2 border-[oklch(0.75_0.15_75)]/30 border-t-[oklch(0.75_0.15_75)] rounded-full animate-spin" />
                <span>Analyzing market data...</span>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Prove the Market Results */}
      {activeTab === 'prove' && researchResult && !isResearching && (() => {
        // Get bedroom-filtered metrics if filter is active
        const filteredBedroomData = bedroomFilter && researchResult.propertyTypes 
          ? researchResult.propertyTypes.find(t => {
              const bedroomNum = parseInt(t.type.split(' ')[0]) || 0;
              return bedroomNum === bedroomFilter;
            })
          : null;
        
        // Use filtered data if available, otherwise use market-wide averages
        const displayRevenue = filteredBedroomData?.avgRevenue || researchResult.avgRevenue;
        const displayOccupancy = filteredBedroomData?.occupancy || researchResult.avgOccupancy;
        const displayListings = filteredBedroomData?.count || researchResult.totalListings;
        const isFiltered = bedroomFilter && filteredBedroomData;
        
        return (
        <section className="py-12 bg-slate-50">
          <div className="container max-w-4xl mx-auto">
            {/* Hero Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Market Validated
                </div>
                <ShareReportButton
                  reportType="market"
                  reportData={{
                    marketName: researchResult.marketName,
                    avgRevenue: researchResult.avgRevenue,
                    avgOccupancy: researchResult.avgOccupancy,
                    avgAdr: researchResult.avgAdr,
                    totalListings: researchResult.totalListings,
                    propertyTypes: researchResult.propertyTypes,
                    marketScores: researchResult.marketScores,
                    revenuePercentiles: researchResult.revenuePercentiles,
                    bookingPatterns: researchResult.bookingPatterns,
                    competitionData: researchResult.competitionData,
                    seasonality: researchResult.seasonality,
                  }}
                  marketId={locationSelection?.market?.id}
                  marketName={researchResult.marketName}
                />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                {researchResult.marketName} is Profitable
              </h3>
              <p className="text-slate-500">
                {isFiltered 
                  ? `Avg revenue data for ${bedroomFilter}BR properties in this market`
                  : 'Avg revenue data from active Airbnb hosts in this market'
                }
              </p>
            </div>
            
            {/* Market Verdict Card - The Big Answer */}
            {(() => {
              // Calculate letter grade based on market score and key metrics
              // If market score is 0 or undefined, calculate grade primarily from occupancy and revenue
              const rawMarketScore = researchResult.marketScores?.overall;
              const occupancy = researchResult.avgOccupancy || 0;
              const revenue = researchResult.avgRevenue || 0;
              
              // If no market score from API, estimate one based on occupancy and revenue
              // Occupancy 60%+ is strong, 50-60% is decent, below 50% is challenging
              // Revenue $50k+ is strong, $30-50k is decent, below $30k is challenging
              let marketScore = rawMarketScore || 0;
              if (!rawMarketScore || rawMarketScore === 0) {
                // Calculate estimated score from available metrics
                let estimatedScore = 50; // Start at average
                if (occupancy >= 65) estimatedScore += 20;
                else if (occupancy >= 55) estimatedScore += 10;
                else if (occupancy >= 45) estimatedScore += 0;
                else estimatedScore -= 10;
                
                if (revenue >= 60000) estimatedScore += 15;
                else if (revenue >= 40000) estimatedScore += 5;
                else if (revenue >= 25000) estimatedScore += 0;
                else estimatedScore -= 10;
                
                marketScore = Math.max(0, Math.min(100, estimatedScore));
              }
              
              // Determine letter grade
              let grade = 'C';
              let gradeColor = 'text-amber-600';
              let gradeBg = 'bg-amber-50 border-amber-200';
              let verdict = 'Average Market';
              let verdictDetail = 'This market shows moderate potential for short-term rentals.';
              let encouragement = ''; // Extra encouragement for challenging markets
              
              if (marketScore >= 75 && occupancy >= 60) {
                grade = 'A';
                gradeColor = 'text-emerald-600';
                gradeBg = 'bg-emerald-50 border-emerald-200';
                verdict = 'Strong Market';
                verdictDetail = 'High demand and healthy occupancy rates. Properties here tend to perform well.';
              } else if (marketScore >= 65 && occupancy >= 55) {
                grade = 'B+';
                gradeColor = 'text-emerald-500';
                gradeBg = 'bg-emerald-50/70 border-emerald-200';
                verdict = 'Good Market';
                verdictDetail = 'Solid fundamentals with good booking rates. Worth investigating further.';
              } else if (marketScore >= 55 && occupancy >= 50) {
                grade = 'B';
                gradeColor = 'text-blue-600';
                gradeBg = 'bg-blue-50 border-blue-200';
                verdict = 'Decent Market';
                verdictDetail = 'Reasonable performance. Success depends on property quality and pricing strategy.';
              } else if (marketScore >= 45 || occupancy >= 45) {
                grade = 'C+';
                gradeColor = 'text-amber-600';
                gradeBg = 'bg-amber-50 border-amber-200';
                verdict = 'Challenging Market';
                verdictDetail = 'Below-average metrics. May require exceptional property or strategy to succeed.';
                encouragement = 'Even in challenging markets, great opportunities exist. Look for unique properties, underserved neighborhoods, or niche guest experiences.';
              } else {
                grade = 'C';
                gradeColor = 'text-orange-600';
                gradeBg = 'bg-orange-50 border-orange-200';
                verdict = 'Difficult Market';
                verdictDetail = 'Low demand or high competition. Proceed with caution and thorough research.';
                encouragement = 'Difficult markets can still have hidden gems. Focus on specific neighborhoods, unique amenities, or targeting specific guest types.';
              }
              
              return (
                <div className={`${gradeBg} border rounded-2xl p-6 mb-8 shadow-sm`}>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Grade Circle */}
                    <div className="flex-shrink-0">
                      <div className={`w-24 h-24 rounded-full bg-white shadow-md flex items-center justify-center border-4 ${gradeBg.replace('bg-', 'border-').replace('-50', '-300')}`}>
                        <span className={`text-4xl font-bold ${gradeColor}`}>{grade}</span>
                      </div>
                    </div>
                    
                    {/* Verdict Text */}
                    <div className="flex-1 text-center md:text-left">
                      <h4 className={`text-2xl font-bold ${gradeColor} mb-1`}>
                        {researchResult.marketName} is a {verdict}
                      </h4>
                      <p className="text-slate-600 mb-3">{verdictDetail}</p>
                      <div className="flex flex-wrap gap-3 justify-center md:justify-start text-sm">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full border border-slate-200">
                          <span className="font-medium">{researchResult.totalListings.toLocaleString()}</span>
                          <InfoTooltip content="Total number of Airbnb properties currently competing in this market">
                            <span className="text-slate-500">active listings</span>
                          </InfoTooltip>
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full border border-slate-200">
                          <span className="font-medium">{researchResult.avgOccupancy}%</span>
                          <InfoTooltip content={`How often properties are booked. ${researchResult.avgOccupancy}% means booked about ${Math.round(researchResult.avgOccupancy * 3.65)} nights per year`}>
                            <span className="text-slate-500">avg booking rate</span>
                          </InfoTooltip>
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full border border-slate-200">
                          <span className="font-medium">{formatCurrency(researchResult.avgRevenue)}</span>
                          <InfoTooltip content="Average annual revenue calculated from actual Airbnb/Vrbo booking data. Calendar data is scraped daily and AI detects real bookings vs blocked dates - independently verified at 96% accuracy.">
                            <span className="text-slate-500">avg revenue</span>
                          </InfoTooltip>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* What This Means Section */}
                  <div className="mt-6 pt-6 border-t border-slate-200/50">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">What does this mean?</span> This grade is based on the market's occupancy rate ({occupancy}%), average revenue (${revenue.toLocaleString()}/year), and overall demand. A higher grade indicates stronger demand and better earning potential for short-term rental investors.
                    </p>
                    {encouragement && (
                      <p className="text-sm text-amber-700 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="font-semibold">Pro Tip:</span> {encouragement}
                      </p>
                    )}
                    
                    {/* Data Scope Indicator */}
                    {researchResult.searchLevel && researchResult.searchLevel !== researchResult.dataLevel && (
                      <div className="mt-4">
                        <DataScopeIndicator
                          level={researchResult.dataLevel || 'metro'}
                          locationName={researchResult.dataLocationName || researchResult.marketName}
                          parentName={researchResult.dataLocationName}
                          isFallback={researchResult.searchLevel === 'zip' && researchResult.dataLevel !== 'zip'}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Quick Insights Summary */}
            {researchResult.propertyTypes && researchResult.propertyTypes.length > 0 && (() => {
              // Find the best performing bedroom type
              const sortedByRevenue = [...researchResult.propertyTypes]
                .filter(t => t.count > 0)
                .sort((a, b) => b.avgRevenue - a.avgRevenue);
              const bestPerformer = sortedByRevenue[0];
              const highestOccupancy = [...researchResult.propertyTypes]
                .filter(t => t.count > 0)
                .sort((a, b) => (b.occupancy || 0) - (a.occupancy || 0))[0];
              
              return (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      <h4 className="font-semibold text-slate-800">What should I know first about this market?</h4>
                    </div>
                    <p className="text-sm text-slate-500 ml-7">Here are the key takeaways at a glance</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Best Revenue */}
                    <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-amber-600" />
                        <InfoTooltip content="The bedroom type that earns the most money on average in this market">
                          <span className="text-sm text-slate-500">Top Earner</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">{bestPerformer?.type || 'N/A'}</p>
                      <p className="text-sm text-slate-500">{formatCurrency(bestPerformer?.avgRevenue || 0)}/year avg</p>
                    </div>
                    
                    {/* Highest Booking Rate */}
                    <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <InfoTooltip content="The bedroom type with the highest booking rate - how often the property is rented out (most nights booked per year)">
                          <span className="text-sm text-slate-500">Most Booked</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-blue-600">{highestOccupancy?.type || 'N/A'}</p>
                      <p className="text-sm text-slate-500">{highestOccupancy?.occupancy || 0}% booking rate</p>
                    </div>
                    
                    {/* Market Size */}
                    <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-purple-600" />
                        <InfoTooltip content="Total number of active short-term rentals competing in this area">
                          <span className="text-sm text-slate-500">Market Size</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-purple-600">{researchResult.totalListings.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">active listings</p>
                    </div>
                  </div>
                  {/* Confidence Note */}
                  <p className="text-xs text-slate-400 mt-4 text-center">Based on {researchResult.totalListings.toLocaleString()} active properties in this market</p>
                </div>
              );
            })()}
            
            {/* Submarket Comparison - "Where in [City]?" */}
            {researchResult.submarkets && researchResult.submarkets.length > 0 && (() => {
              // Sort by revenue to show best areas first
              const sortedSubmarkets = [...researchResult.submarkets]
                .filter(s => s.avgRevenue > 0)
                .sort((a, b) => b.avgRevenue - a.avgRevenue)
                .slice(0, 8);
              
              if (sortedSubmarkets.length === 0) return null;
              
              // Find the best submarket for beginners (high occupancy, good revenue)
              const bestForBeginners = [...researchResult.submarkets]
                .filter(s => s.avgOccupancy >= 50 && s.avgRevenue > 0)
                .sort((a, b) => (b.avgOccupancy * b.avgRevenue) - (a.avgOccupancy * a.avgRevenue))[0];
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-[#C9A962]" />
                        Where in {researchResult.marketName.split(',')[0]}?
                      </h4>
                      <p className="text-slate-500 text-sm">Not all neighborhoods perform the same. Here are the top areas:</p>
                    </div>
                  </div>
                  
                  {/* Best for Beginners Callout */}
                  {bestForBeginners && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">Best for Beginners</span>
                      </div>
                      <p className="text-emerald-800 font-medium">{bestForBeginners.name}</p>
                      <p className="text-emerald-600 text-sm">
                        {bestForBeginners.avgOccupancy}% occupancy • {formatCurrency(bestForBeginners.avgRevenue)}/year avg
                      </p>
                    </div>
                  )}
                  
                  {/* Submarket Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Neighborhood</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-600">Listings</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-600">Avg Revenue</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-600">Booking Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSubmarkets.map((submarket, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {submarket.name}
                              {bestForBeginners && submarket.name === bestForBeginners.name && (
                                <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Recommended</span>
                              )}
                            </td>
                            <td className="text-right py-2 px-3 text-slate-600">{submarket.listingCount.toLocaleString()}</td>
                            <td className="text-right py-2 px-3 text-emerald-600 font-medium">{formatCurrency(submarket.avgRevenue)}</td>
                            <td className="text-right py-2 px-3 text-blue-600 font-medium">{submarket.avgOccupancy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                      <span className="font-medium">Pro tip:</span> Higher booking rate areas are often better for beginners - consistent bookings mean more predictable income.
                    </p>
                  </div>
                </div>
              );
            })()}
            
            {/* Market Health Score Card */}
            {researchResult.marketScores && (() => {
              const scores = researchResult.marketScores;
              const getScoreColor = (score: number) => {
                if (score >= 70) return 'text-emerald-500';
                if (score >= 50) return 'text-amber-500';
                return 'text-red-500';
              };
              const getScoreBg = (score: number) => {
                if (score >= 70) return 'bg-emerald-500';
                if (score >= 50) return 'bg-amber-500';
                return 'bg-red-500';
              };
              const getScoreLabel = (score: number) => {
                if (score >= 80) return 'Excellent';
                if (score >= 70) return 'Good';
                if (score >= 50) return 'Fair';
                return 'Needs Review';
              };
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-slate-900">Is this market healthy for investors?</h4>
                        {researchResult.searchLevel === 'zip' && researchResult.dataLevel !== 'zip' && (
                          <DataScopeBadge level={researchResult.dataLevel || 'metro'} isFallback={true} />
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">Overall investment potential across 5 key factors</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(scores.overall)}`}>{scores.overall}</div>
                      <div className="text-xs text-slate-500">{getScoreLabel(scores.overall)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Profit Potential', value: scores.investability, tooltip: 'Can you make good money here? This compares property prices to rental income. Higher = better profit margins.' },
                      { label: 'Guest Interest', value: scores.rentalDemand, tooltip: 'How many people want to stay here? Based on how often places get booked and searched. Higher = more guests looking.' },
                      { label: 'Earnings Trend', value: scores.revenueGrowth, tooltip: 'Are hosts making more or less than last year? Higher = earnings are growing.' },
                      { label: 'Income Stability', value: scores.seasonality, tooltip: 'Is income steady all year, or do some months earn way more? Higher = more consistent monthly income.' },
                      { label: 'Local Rules', value: scores.regulation, tooltip: 'How easy is it to legally rent here? Higher = fewer restrictions and easier permits.' },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3 group relative">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-slate-600 font-medium cursor-help border-b border-dotted border-slate-400">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${getScoreBg(item.value)}`} style={{ width: `${item.value}%` }} />
                          </div>
                          <span className={`text-sm font-bold ${getScoreColor(item.value)}`}>{item.value}</span>
                        </div>
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-56">
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                            {item.tooltip}
                            <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Section Verdict */}
                  <div className="mt-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">What This Means For You</p>
                        <p className="text-sm text-slate-600">
                          {scores.overall >= 70 
                            ? `With an overall score of ${scores.overall}, this market shows strong fundamentals. ${scores.rentalDemand >= 70 ? 'Guest interest is high, meaning properties get booked consistently.' : ''} ${scores.seasonality >= 70 ? 'Income stays steady throughout the year.' : scores.seasonality < 50 ? 'Expect some seasonal ups and downs in bookings.' : ''}`
                            : scores.overall >= 50
                            ? `This market scores ${scores.overall}, indicating moderate opportunity. ${scores.investability >= 70 ? 'Profit margins look healthy.' : scores.investability < 50 ? 'Profit margins may be tighter than other markets.' : ''} ${scores.regulation >= 70 ? 'Local rules are favorable for short-term rentals.' : scores.regulation < 50 ? 'Check local regulations carefully before investing.' : ''}`
                            : `This market scores ${scores.overall}, suggesting caution. ${scores.rentalDemand < 50 ? 'Guest demand is lower than average.' : ''} ${scores.seasonality < 50 ? 'Income varies significantly by season.' : ''} Consider researching nearby markets for comparison.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Revenue Distribution */}
            {researchResult.revenuePercentiles && (() => {
              const percentiles = researchResult.revenuePercentiles;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-slate-900">How much can I realistically expect to earn?</h4>
                        {researchResult.searchLevel === 'zip' && researchResult.dataLevel !== 'zip' && (
                          <DataScopeBadge level={researchResult.dataLevel || 'metro'} isFallback={true} />
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">See the full range of what hosts actually earn here</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Annual revenue</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {[
                      { label: 'Bottom 10%', value: percentiles.p10, color: 'bg-red-100 text-red-700 border-red-200' },
                      { label: 'Lower 25%', value: percentiles.p25, color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      { label: 'Median', value: percentiles.p50, color: 'bg-blue-100 text-blue-700 border-blue-200' },
                      { label: 'Upper 25%', value: percentiles.p75, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                      { label: 'Top 10%', value: percentiles.p90, color: 'bg-purple-100 text-purple-700 border-purple-200' },
                    ].map((item, idx) => (
                      <div key={idx} className={`rounded-lg p-3 border ${item.color}`}>
                        <p className="text-xs font-medium mb-1">{item.label}</p>
                        <p className="text-lg font-bold">{formatCurrency(item.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600">
                      <strong>What this means:</strong> Top performers (90th percentile) earn {formatCurrency(percentiles.p90)}/year, 
                      while the median host earns {formatCurrency(percentiles.p50)}. The gap of {formatCurrency(percentiles.p90 - percentiles.p50)} 
                      shows the potential upside with better optimization.
                    </p>
                  </div>
                  {/* Section Verdict */}
                  <div className="mt-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">Realistic Earning Expectation</p>
                        <p className="text-sm text-slate-600">
                          {(() => {
                            const monthlyMedian = Math.round(percentiles.p50 / 12);
                            const monthlyTop = Math.round(percentiles.p90 / 12);
                            const gap = percentiles.p90 - percentiles.p50;
                            const gapPercent = Math.round((gap / percentiles.p50) * 100);
                            return `Most hosts earn around ${formatCurrency(monthlyMedian)}/month (${formatCurrency(percentiles.p50)}/year). Top performers earn ${formatCurrency(monthlyTop)}/month—that's ${gapPercent}% more. The difference usually comes from better photos, pricing strategy, and guest reviews.`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Guest Behavior Insights */}
            {researchResult.bookingPatterns && (() => {
              const patterns = researchResult.bookingPatterns;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-slate-900">How do guests typically book here?</h4>
                        {researchResult.searchLevel === 'zip' && researchResult.dataLevel !== 'zip' && (
                          <DataScopeBadge level={researchResult.dataLevel || 'metro'} isFallback={true} />
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">Understanding booking patterns helps you plan pricing and availability</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium text-blue-900">Booking Lead Time</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{Math.round(patterns.avgLeadTime)} days</p>
                      <p className="text-xs text-blue-600 mt-1">Average advance booking</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(patterns.lastMinutePercent)}% last-minute
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(patterns.advanceBookingPercent)}% advance
                        </span>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                        <span className="text-sm font-medium text-purple-900">Length of Stay</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{patterns.avgLengthOfStay.toFixed(1)} nights</p>
                      <p className="text-xs text-purple-600 mt-1">Average stay duration</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {Math.round(patterns.weekendPercent)}% weekends
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {Math.round(patterns.weekPlusPercent)}% week+
                        </span>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium text-amber-900">Guest Mix</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-amber-700">Weekend Stays</span>
                            <span className="font-medium text-amber-800">{Math.round(patterns.weekendPercent)}%</span>
                          </div>
                          <div className="bg-amber-200 rounded-full h-2">
                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${patterns.weekendPercent}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-amber-700">Week+ Stays</span>
                            <span className="font-medium text-amber-800">{Math.round(patterns.weekPlusPercent)}%</span>
                          </div>
                          <div className="bg-amber-200 rounded-full h-2">
                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${patterns.weekPlusPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Section Verdict */}
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">Booking Strategy Insight</p>
                        <p className="text-sm text-slate-600">
                          {(() => {
                            const isLastMinuteMarket = patterns.lastMinutePercent > 40;
                            const isWeekendMarket = patterns.weekendPercent > 50;
                            const avgStay = patterns.avgLengthOfStay;
                            
                            if (isLastMinuteMarket && isWeekendMarket) {
                              return `This market favors last-minute weekend getaways (${Math.round(patterns.lastMinutePercent)}% book within days). Keep your calendar flexible and consider dynamic pricing that increases as dates approach.`;
                            } else if (isLastMinuteMarket) {
                              return `With ${Math.round(patterns.lastMinutePercent)}% last-minute bookings, guests here decide quickly. Stay responsive to inquiries and keep your listing updated for spontaneous travelers.`;
                            } else if (avgStay > 5) {
                              return `Guests stay an average of ${avgStay.toFixed(1)} nights—this is a longer-stay market. Consider weekly discounts and amenities like workspaces or full kitchens.`;
                            } else {
                              return `Most guests book ${Math.round(patterns.avgLeadTime)} days ahead for ${avgStay.toFixed(1)}-night stays. Plan your pricing calendar in advance and offer early-bird discounts to secure bookings.`;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Competition Landscape */}
            {researchResult.competitionData && (() => {
              const comp = researchResult.competitionData;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-slate-900">How competitive is this market?</h4>
                        {researchResult.searchLevel === 'zip' && researchResult.dataLevel !== 'zip' && (
                          <DataScopeBadge level={researchResult.dataLevel || 'metro'} isFallback={true} />
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">Know your competition before you enter</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="w-4 h-4 text-slate-500" />
                        <span className="text-xs text-slate-600 font-medium">Pro Managed</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.professionallyManagedPct}%</p>
                      <p className="text-xs text-slate-500">Professional hosts</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-slate-600 font-medium">Top-Rated Hosts</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.superhostPct}%</p>
                      <p className="text-xs text-slate-500">Top-rated hosts</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-slate-600 font-medium">Entire Homes</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.entireHomePct}%</p>
                      <p className="text-xs text-slate-500">Full property rentals</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-slate-600 font-medium">Single Hosts</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{comp.singleHostPct}%</p>
                      <p className="text-xs text-slate-500">1 listing only</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600">
                      <strong>Market insight:</strong> 
                      {comp.professionallyManagedPct > 30 
                        ? ` This is a competitive market with ${comp.professionallyManagedPct}% professional managers. Focus on unique amenities and guest experience to stand out.`
                        : ` This market has ${100 - comp.professionallyManagedPct}% individual hosts, suggesting opportunity for professional-level service to differentiate.`
                      }
                    </p>
                  </div>
                  {/* Section Verdict */}
                  <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Target className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">How to Stand Out Here</p>
                        <p className="text-sm text-slate-600">
                          {(() => {
                            const isHighlyProfessional = comp.professionallyManagedPct > 40;
                            const hasManySuperhost = comp.superhostPct > 30;
                            const mostlyEntireHomes = comp.entireHomePct > 70;
                            const manySingleHosts = comp.singleHostPct > 60;
                            
                            if (isHighlyProfessional && hasManySuperhost) {
                              return `This is a mature market with ${comp.professionallyManagedPct}% professional managers and ${comp.superhostPct}% top-rated hosts. Success here requires excellent photos, fast response times, and standout amenities like hot tubs or unique decor.`;
                            } else if (manySingleHosts) {
                              return `With ${comp.singleHostPct}% single-property hosts, this market has room for someone who treats hosting professionally. Consistent quality, great communication, and attention to detail can help you rise above the crowd.`;
                            } else if (mostlyEntireHomes) {
                              return `${comp.entireHomePct}% of listings are entire homes. If you're considering a private room or shared space, you'll face less direct competition but a smaller guest pool.`;
                            } else {
                              return `This market has a healthy mix of host types. Focus on what makes your property unique—location, amenities, or experience—and highlight it in your listing title and photos.`;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Key Metrics - Tesla Dashboard Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow relative group ${isFiltered ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium cursor-help border-b border-dotted border-slate-400 inline-block">Avg Annual Revenue</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(displayRevenue)}</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR avg` : 'All property types'}</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 pointer-events-none">
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg">
                    Average yearly income for properties in this market. This is what hosts typically earn before expenses like cleaning, supplies, and management fees.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                <div className="inline-flex p-2 rounded-lg mb-2 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium cursor-help border-b border-dotted border-slate-400 inline-block">Avg Nightly Rate</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(researchResult.avgAdr)}</p>
                <p className="text-slate-400 text-xs">Market average ADR</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 pointer-events-none">
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg">
                    Average Daily Rate (ADR) - the typical nightly price guests pay. Higher ADR means guests are willing to pay more for properties in this area.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow relative group ${isFiltered ? 'border-purple-300 ring-1 ring-purple-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Percent className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium cursor-help border-b border-dotted border-slate-400 inline-block">Avg Booking Rate</p>
                <p className="text-xl font-bold text-slate-900">{Math.round(displayOccupancy)}%</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR avg` : 'Market average'}</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 pointer-events-none">
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg">
                    How often properties are booked. 60%+ is healthy, 70%+ is excellent. Low booking rate may indicate oversupply or seasonal market.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow relative group ${isFiltered ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'}`}>
                <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Home className="w-5 h-5" />
                </div>
                <p className="text-slate-500 text-xs font-medium cursor-help border-b border-dotted border-slate-400 inline-block">{isFiltered ? 'Similar Listings' : 'Active Listings'}</p>
                <p className="text-xl font-bold text-slate-900">{displayListings.toLocaleString()}</p>
                <p className="text-slate-400 text-xs">{isFiltered ? `${bedroomFilter}BR in market` : 'All types in market'}</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 pointer-events-none">
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg">
                    Total number of active short-term rentals. More listings = more competition. Compare with booking rate to gauge market saturation.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Property Types - Show all bedroom types */}
            {researchResult.propertyTypes && researchResult.propertyTypes.length > 0 && (() => {
              // Ensure we show all bedroom types from Studio (0) to 6+ BR
              const allBedroomTypes = [0, 1, 2, 3, 4, 5, 6];
              const existingTypesMap: Record<number, typeof researchResult.propertyTypes[0]> = {};
              researchResult.propertyTypes.forEach(t => {
                // Handle "Studio", "0 Bedroom", "6 Bedroom" (which represents 6+), etc.
                const bedroomNum = t.type === 'Studio' ? 0 : parseInt(t.type.split(' ')[0]) || 0;
                existingTypesMap[bedroomNum] = t;
              });
              
              // Create complete list with placeholders for missing types
              const completeTypes = allBedroomTypes.map(bedrooms => {
                const existing = existingTypesMap[bedrooms];
                if (existing) {
                  // Ensure proper display name
                  return {
                    ...existing,
                    type: bedrooms === 0 ? 'Studio' : bedrooms === 6 ? '6+ Bedroom' : `${bedrooms} Bedroom`
                  };
                }
                return {
                  type: bedrooms === 0 ? 'Studio' : bedrooms === 6 ? '6+ Bedroom' : `${bedrooms} Bedroom`,
                  count: 0,
                  avgRevenue: 0,
                  occupancy: 0
                };
              });
              
              // Calculate total from bedroom breakdown to show coverage
              const totalFromBreakdown = completeTypes.reduce((sum, t) => sum + t.count, 0);
              
              // Filter to only show types with data or common types (1-4 BR)
              const typesToShow = completeTypes.filter(t => {
                const bedroomNum = t.type === 'Studio' ? 0 : t.type === '6+ Bedroom' ? 6 : parseInt(t.type.split(' ')[0]);
                return t.count > 0 || (bedroomNum >= 1 && bedroomNum <= 4);
              });
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Which property types earn the most?</h4>
                      <p className="text-slate-500 text-sm">Compare revenue and booking rate by bedroom count</p>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">By Bedroom</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {typesToShow.map((type, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border transition-all ${
                          type.count > 0 
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-300' 
                            : 'bg-slate-50/50 border-dashed border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                              type.count > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-200 text-slate-400'
                            }`}>
                              {type.type === 'Studio' ? 'S' : type.type === '6+ Bedroom' ? '6+' : type.type.split(' ')[0]}
                            </div>
                            <p className={`font-semibold text-sm ${type.count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                              {type.type}
                            </p>
                          </div>
                        </div>
                        {type.count > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between group relative">
                              <p className="text-xs text-slate-500 cursor-help border-b border-dotted border-slate-400">Revenue/yr</p>
                              <p className="text-emerald-600 font-bold text-sm">{formatCurrency(type.avgRevenue)}</p>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48">
                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                                  Average annual income from similar {type.type} properties in this area
                                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between group relative">
                              <p className="text-xs text-slate-500 cursor-help border-b border-dotted border-slate-400">Booking Rate</p>
                              <p className="text-slate-900 font-semibold text-sm">{type.occupancy}%</p>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48">
                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                                  How often these properties are booked. Higher = more demand for this type
                                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between group relative">
                              <p className="text-xs text-slate-400 cursor-help border-b border-dotted border-slate-300">{type.count} listings</p>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-52">
                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-lg">
                                  Total active {type.type} short-term rentals currently listed in this market
                                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-400 italic">
                              Uncommon in this market
                            </p>
                            <p className="text-[10px] text-slate-300">
                              Few {type.type} rentals here
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {typesToShow.some(t => t.count === 0) && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <span className="font-semibold">Pro Tip:</span> Some bedroom types are uncommon in this area. This tells you what property types are most popular here. Focus on the bedroom counts with the most listings—that's where demand is proven!
                      </p>
                    </div>
                  )}
                  
                  {/* Data-Driven Insight Summary */}
                  {(() => {
                    const typesWithData = typesToShow.filter(t => t.count > 0);
                    if (typesWithData.length === 0) return null;
                    
                    // Find highest revenue type
                    const highestRevenue = typesWithData.reduce((max, t) => t.avgRevenue > max.avgRevenue ? t : max, typesWithData[0]);
                    // Find highest occupancy type
                    const highestOccupancy = typesWithData.reduce((max, t) => (t.occupancy || 0) > (max.occupancy || 0) ? t : max, typesWithData[0]);
                    // Find most common type (most listings)
                    const mostCommon = typesWithData.reduce((max, t) => t.count > max.count ? t : max, typesWithData[0]);
                    
                    // Calculate total listings from breakdown
                    const totalListingsFromBreakdown = typesWithData.reduce((sum, t) => sum + t.count, 0);
                    
                    return (
                      <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-slate-900 mb-2">What This Data Shows</h5>
                            <div className="space-y-2 text-sm text-slate-700">
                              <p>
                                <span className="font-medium text-emerald-700">Highest Revenue:</span> {highestRevenue.type} properties average <span className="font-bold text-emerald-600">{formatCurrency(highestRevenue.avgRevenue)}/year</span>
                              </p>
                              <p>
                                <span className="font-medium text-blue-700">Highest Demand:</span> {highestOccupancy.type} properties have <span className="font-bold text-blue-600">{highestOccupancy.occupancy}% booking rate</span>
                              </p>
                              <p>
                                <span className="font-medium text-purple-700">Most Common:</span> {mostCommon.type} has <span className="font-bold text-purple-600">{mostCommon.count} active listings</span> ({Math.round(mostCommon.count / totalListingsFromBreakdown * 100)}% of market)
                              </p>
                            </div>
                            <p className="mt-3 text-xs text-slate-500 italic">
                              Based on {totalListingsFromBreakdown.toLocaleString()} active short-term rentals in this market
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            
            
            {/* Seasonality Summary */}
            {isResearching && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Monthly Earnings Pattern</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-3">How Often It's Booked Each Month</p>
                    <div className="space-y-2">
                      {[...Array(12)].map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                          <div className="flex-1 bg-slate-200 rounded-full h-5 animate-pulse" />
                          <div className="w-10 h-4 bg-slate-200 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Nightly Rate Each Month</p>
                    <div className="space-y-2">
                      {[...Array(12)].map((_, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="w-12 h-4 bg-slate-200 rounded animate-pulse" />
                          <div className="w-16 h-4 bg-slate-200 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!isResearching && researchResult.seasonality && researchResult.seasonality.length > 0 && (() => {
              // Calculate averages for the guide lines
              const avgOccupancy = researchResult.seasonality.reduce((sum, m) => sum + m.occupancy, 0) / researchResult.seasonality.length;
              const avgAdr = researchResult.seasonality.reduce((sum, m) => sum + m.adr, 0) / researchResult.seasonality.length;
              const maxAdr = Math.max(...researchResult.seasonality.map(m => m.adr));
              const minAdr = Math.min(...researchResult.seasonality.map(m => m.adr));
              const adrRange = maxAdr - minAdr || 1;
              
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Monthly Earnings Pattern</h4>
                      <p className="text-slate-500 text-sm">See which months earn the most (and least) in this market</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">12-month avg</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Booking Rate Chart */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-500">How Often It's Booked Each Month</p>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-0.5 bg-amber-500"></div>
                          <span className="text-xs text-amber-600 font-medium">Avg: {Math.round(avgOccupancy)}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {researchResult.seasonality.map((month, idx) => {
                          const isAboveAvg = month.occupancy >= avgOccupancy;
                          const diffFromAvg = month.occupancy - avgOccupancy;
                          const seasonLabel = month.occupancy >= 70 ? 'Peak Season' : month.occupancy >= 55 ? 'Good Season' : month.occupancy >= 40 ? 'Moderate Season' : 'Slow Season';
                          return (
                            <div key={idx} className="flex items-center gap-3 group relative">
                              <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative cursor-pointer">
                                {/* Average line indicator */}
                                <div 
                                  className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                                  style={{left: `${avgOccupancy}%`}}
                                />
                                <div 
                                  className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-amber-300 to-amber-400'}`}
                                  style={{width: `${month.occupancy}%`}}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-10 text-right ${isAboveAvg ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round(month.occupancy)}%</span>
                              {/* Tooltip */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                                <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                  <p className="font-semibold">{formatMonth(month.month)} - Booking Rate</p>
                                  <p className="text-slate-300">{Math.round(month.occupancy)}% of nights booked</p>
                                  <p className={`${diffFromAvg >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {diffFromAvg >= 0 ? '+' : ''}{Math.round(diffFromAvg)}% vs average
                                  </p>
                                  <p className="text-slate-400 mt-1">{seasonLabel}</p>
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Green = above average, Amber = below average</p>
                    </div>
                    {/* ADR Chart */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-slate-500">Nightly Rate Each Month</p>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-0.5 bg-blue-500"></div>
                          <span className="text-xs text-blue-600 font-medium">Avg: {formatCurrency(avgAdr)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {researchResult.seasonality.map((month, idx) => {
                          // Calculate bar width as percentage of range (min 20%, max 100%)
                          const barWidth = 20 + ((month.adr - minAdr) / adrRange) * 80;
                          const isAboveAvg = month.adr >= avgAdr;
                          const avgPosition = 20 + ((avgAdr - minAdr) / adrRange) * 80;
                          const diffFromAvg = month.adr - avgAdr;
                          const priceLabel = month.adr >= maxAdr * 0.9 ? 'Premium Pricing' : month.adr >= avgAdr ? 'Above Average' : month.adr <= minAdr * 1.1 ? 'Budget Season' : 'Below Average';
                          const estimatedMonthlyRevenue = Math.round(month.adr * month.occupancy / 100 * 30);
                          return (
                            <div key={idx} className="flex items-center gap-3 group relative">
                              <span className="text-xs text-slate-500 w-12">{formatMonth(month.month)}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative cursor-pointer">
                                {/* Average line indicator */}
                                <div 
                                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                                  style={{left: `${avgPosition}%`}}
                                />
                                <div 
                                  className={`h-full transition-all ${isAboveAvg ? 'bg-gradient-to-r from-blue-400 to-cyan-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}
                                  style={{width: `${barWidth}%`}}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-14 text-right ${isAboveAvg ? 'text-blue-600' : 'text-slate-500'}`}>{formatCurrency(month.adr)}</span>
                              {/* Tooltip */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                                <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                  <p className="font-semibold">{formatMonth(month.month)} - Nightly Rate</p>
                                  <p className="text-slate-300">{formatCurrency(month.adr)} per night</p>
                                  <p className={`${diffFromAvg >= 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {diffFromAvg >= 0 ? '+' : ''}{formatCurrency(diffFromAvg)} vs average
                                  </p>
                                  <p className="text-emerald-400 mt-1">Est. monthly: {formatCurrency(estimatedMonthlyRevenue)}</p>
                                  <p className="text-slate-400">{priceLabel}</p>
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Blue = above average, Gray = below average</p>
                    </div>
                  </div>
                  
                  {/* Monthly Pattern Verdict */}
                  {(() => {
                    // Find best and worst months
                    const sortedByOccupancy = [...researchResult.seasonality].sort((a, b) => b.occupancy - a.occupancy);
                    const bestMonths = sortedByOccupancy.slice(0, 3).map(m => formatMonth(m.month));
                    const slowestMonths = sortedByOccupancy.slice(-3).reverse().map(m => formatMonth(m.month));
                    const seasonalVariation = Math.round(sortedByOccupancy[0].occupancy - sortedByOccupancy[sortedByOccupancy.length - 1].occupancy);
                    const isHighlySeasonalMarket = seasonalVariation > 25;
                    
                    return (
                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-slate-900 mb-2">When to Expect the Most Bookings</h5>
                            <div className="space-y-2 text-sm text-slate-700">
                              <p>
                                <span className="font-medium text-emerald-700">Best Months:</span> <span className="font-bold text-emerald-600">{bestMonths.join(', ')}</span> - highest booking rates
                              </p>
                              <p>
                                <span className="font-medium text-amber-700">Slowest Months:</span> <span className="font-bold text-amber-600">{slowestMonths.join(', ')}</span> - lower demand
                              </p>
                              {isHighlySeasonalMarket && (
                                <p className="text-slate-600 mt-2 pt-2 border-t border-blue-200">
                                  <span className="font-medium">Note:</span> This market has {seasonalVariation}% seasonal variation. Plan for slower months by building cash reserves during peak season.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            
            {/* Historical Charts - Market Trends (YoY Data) */}
            {/* Moved closer to Seasonality section per feedback */}
            {/* Note: Historical data API only works with market IDs, not submarket IDs */}
            {/* When a submarket is selected as a market (isSubmarketAsMarket), use the parent market ID if available */}
            {locationSelection?.market?.id && (
              <div className="mt-8">
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-600 text-sm">
                    <span className="font-medium">Is this market growing or shrinking?</span> See how booking rates, income, and competition have changed over time. Look for upward trends in revenue and stable or growing booking rates.
                  </p>
                </div>
                {/* For submarkets with parent market info, show the charts with parent market data */}
                {locationSelection.market.isSubmarketAsMarket && locationSelection.market.parentMarketId ? (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-sm">
                        <span className="font-medium">Note:</span> Historical trends shown for {locationSelection.market.parentMarketName || 'parent market'} (broader market area)
                      </p>
                    </div>
                    <HistoricalCharts
                      marketId={locationSelection.market.parentMarketId}
                      marketName={locationSelection.market.parentMarketName || researchResult.marketName}
                    />
                  </div>
                ) : locationSelection.market.isSubmarketAsMarket ? (
                  /* For submarkets without parent market info, show a message */
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-900">Historical Trends</h4>
                        <p className="text-amber-700 text-sm mt-1">
                          Historical trend data is available at the city/metro level. Select a parent market (like Austin instead of Downtown Austin) to view historical occupancy, revenue, and ADR trends.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* For regular markets, show charts directly */
                  <HistoricalCharts
                    marketId={locationSelection.market.id}
                    marketName={researchResult.marketName}
                  />
                )}
              </div>
            )}
            
            {/* Comp Data Table - Individual Property Listings */}
            {(locationSelection?.submarket?.id || locationSelection?.market?.id) && (
              <div className="mt-8">
                <CompDataTable
                  key={`comp-table-${locationSelection.submarket?.id || locationSelection.market?.id}-${researchResult.marketName}`}
                  submarketId={locationSelection.submarket?.id || locationSelection.market?.id || ''}
                  marketName={researchResult.marketName}
                  isMarketLevel={!locationSelection?.submarket?.id && !!locationSelection?.market?.id}
                />
              </div>
            )}
            
            {/* Next Step CTA - Moved after Comp Data per feedback */}
            <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 text-center">
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Ready for the Next Step?</h4>
              <p className="text-slate-500 mb-4">Find specific opportunities in this market</p>
              <Button
                onClick={() => {
                  setExploreAddress(researchResult.marketName);
                  setActiveTab('find');
                }}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                <Search className="w-4 h-4 mr-2" />
                Find Opportunities in {researchResult.marketName}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const marketName = researchResult.marketName.split(',')[0].trim();
                  const state = researchResult.marketName.split(',')[1]?.trim() || '';
                  
                  // Use promptSave to show login prompt for non-authenticated users
                  promptSave('market', researchResult.marketName, () => {
                    saveMarket({
                      name: marketName,
                      state: state,
                      avgRevenue: researchResult.avgRevenue,
                      avgOccupancy: researchResult.avgOccupancy,
                    });
                    toast.success(`Saved ${marketName} to your list!`);
                  });
                }}
                className={`ml-3 border-amber-500 text-amber-600 hover:bg-amber-50 ${isMarketSaved(researchResult.marketName.split(',')[0].trim(), researchResult.marketName.split(',')[1]?.trim() || '') ? 'bg-amber-50' : ''}`}
              >
                {isMarketSaved(researchResult.marketName.split(',')[0].trim(), researchResult.marketName.split(',')[1]?.trim() || '') ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4 mr-2" />
                    Save Market
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
        );
      })()}
      
      {/* NEW: Market-Based Step 2 Results - See What's Working */}
      {activeTab === 'find' && selectedMarket && marketListings && (
        <section className="py-12 bg-white">
          <div className="container max-w-5xl mx-auto">
            {/* Header with Market Info */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <InfoTooltip
                  content="Total number of active Airbnb properties in this market that match your current filters. These are real listings you can study and learn from."
                  side="bottom"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {marketListingsStats?.totalCount || marketListings.length} Properties Found
                  </div>
                </InfoTooltip>
                <ShareReportButton
                  reportType="market"
                  reportData={{
                    marketName: selectedMarket.name,
                    marketId: selectedMarket.id,
                    marketType: selectedMarket.type,
                    zipcodes: selectedMarket.zipcodes,
                    totalCount: marketListingsStats?.totalCount || marketListings.length,
                    avgRevenue: marketListingsStats?.avgRevenue || 0,
                    avgOccupancy: marketListingsStats?.avgOccupancy || 0,
                    topRevenue: marketListingsStats?.topRevenue || 0,
                    topOccupancy: marketListingsStats?.topOccupancy || 0,
                    bedroomFilter: exploreBedroomFilter,
                    sortBy: exploreSortBy,
                    topListings: marketListings.slice(0, 10).map((l: any) => ({
                      title: l.title,
                      bedrooms: l.bedrooms,
                      bathrooms: l.bathrooms,
                      annualRevenue: l.annualRevenue,
                      occupancy: l.occupancy,
                      rating: l.rating,
                      reviewCount: l.reviewCount,
                      listingUrl: l.listingUrl
                    }))
                  }}
                  marketId={selectedMarket.id}
                  marketName={selectedMarket.name}
                />
                <UniversalShareButton
                  reportType="listings"
                  title={`Explore Listings: ${selectedMarket.name}`}
                  reportData={{
                    marketName: selectedMarket.name,
                    marketId: selectedMarket.id,
                    totalCount: marketListingsStats?.totalCount || marketListings.length,
                    avgRevenue: marketListingsStats?.avgRevenue || 0,
                    avgOccupancy: marketListingsStats?.avgOccupancy || 0,
                    topListings: marketListings.slice(0, 10).map((l: any) => ({
                      title: l.title,
                      bedrooms: l.bedrooms,
                      annualRevenue: l.annualRevenue,
                      occupancy: l.occupancy,
                      listingUrl: l.listingUrl
                    }))
                  }}
                  variant="outline"
                  size="sm"
                />
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                What's Working in {selectedMarket.name}
              </h3>
              
              {/* Zip Code Transparency */}
              {selectedMarket.zipcodes && selectedMarket.zipcodes.length > 0 && (
                <div className="mt-4">
                  <InfoTooltip content="These are the zip codes included in this market's data. This helps you understand exactly where the data is coming from.">
                    <p className="text-sm text-slate-500 inline-flex items-center gap-2 cursor-help">
                      <MapPin className="w-4 h-4" />
                      Includes zip codes: <span className="font-medium text-slate-700">
                        {selectedMarket.zipcodes.slice(0, 5).join(', ')}
                        {selectedMarket.zipcodes.length > 5 && ` +${selectedMarket.zipcodes.length - 5} more`}
                      </span>
                    </p>
                  </InfoTooltip>
                </div>
              )}
            </div>
            
            {/* Market Grade Card */}
            {marketListingsStats && (
              <div className={`${marketListingsStats.gradeBg} border rounded-xl p-6 mb-8`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-600 font-medium mb-1">Market Performance Grade</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-4xl font-bold ${marketListingsStats.gradeColor}`}>
                        {marketListingsStats.marketGrade}
                      </span>
                      <div>
                        <p className={`font-semibold ${marketListingsStats.gradeColor}`}>
                          {marketListingsStats.marketVerdict}
                        </p>
                        <p className="text-xs text-slate-500">
                          Based on {marketListingsStats.totalCount.toLocaleString()} active properties
                        </p>
                      </div>
                    </div>
                  </div>
                  <InfoTooltip content="Market grades are based on average revenue and booking rates. A = High-performing ($60K+ avg revenue, 65%+ booking), B+ = Strong ($45K+, 55%+), B = Good ($35K+, 50%+), C+ = Moderate ($25K+, 40%+), C- = Challenging (below thresholds).">
                    <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center cursor-help">
                      <span className="text-slate-400">?</span>
                    </div>
                  </InfoTooltip>
                </div>
              </div>
            )}
            
            {/* Verdict Section - What This Data Shows */}
            {marketListingsStats && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 mb-8">
                {/* Guiding Question */}
                <p className="text-sm text-slate-600 mb-4 font-medium">
                  What can I learn from the top performers in {selectedMarket.name}?
                </p>
                
                {/* Summary Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <InfoTooltip content="The highest annual revenue among all properties in this market, calculated from actual booking data. This shows what top performers are earning.">
                      <div className="cursor-help">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Top Earner</p>
                        <p className="text-xl font-bold text-emerald-600">${marketListingsStats.topRevenue.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">per year</p>
                      </div>
                    </InfoTooltip>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <InfoTooltip content="Average annual revenue across all properties, calculated from daily scraped Airbnb/Vrbo data. This methodology is independently verified at 96% accuracy.">
                      <div className="cursor-help">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Average Revenue</p>
                        <p className="text-xl font-bold text-blue-600">${marketListingsStats.avgRevenue.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">per year</p>
                      </div>
                    </InfoTooltip>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <InfoTooltip content="The highest booking rate in this market. Higher booking rate means more consistent income throughout the year.">
                      <div className="cursor-help">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Most Booked</p>
                        <p className="text-xl font-bold text-purple-600">{Math.round(marketListingsStats.topOccupancy)}%</p>
                        <p className="text-xs text-slate-400">booking rate</p>
                      </div>
                    </InfoTooltip>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <InfoTooltip content="The average booking rate across all properties. This tells you how often properties are typically booked in this market.">
                      <div className="cursor-help">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Booking Rate</p>
                        <p className="text-xl font-bold text-amber-600">{Math.round(marketListingsStats.avgOccupancy)}%</p>
                        <p className="text-xs text-slate-400">~{Math.round(marketListingsStats.avgOccupancy * 3.65)} nights/yr</p>
                      </div>
                    </InfoTooltip>
                  </div>
                </div>
                
                {/* Contextual Insight */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>What this means:</strong> The top earner makes{' '}
                    <span className="font-semibold">
                      {marketListingsStats.avgRevenue > 0 
                        ? `${(marketListingsStats.topRevenue / marketListingsStats.avgRevenue).toFixed(1)}x`
                        : 'N/A'}
                    </span>{' '}
                    the average revenue. Properties here are booked about{' '}
                    <span className="font-semibold">{Math.round(marketListingsStats.avgOccupancy * 3.65)} nights per year</span>{' '}
                    on average.
                  </p>
                </div>
              </div>
            )}
            
            {/* Neighborhood Comparison (if available) */}
            {marketNeighborhoods && marketNeighborhoods.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-slate-600" />
                  <h4 className="font-semibold text-slate-900">Best Neighborhoods in {selectedMarket.name}</h4>
                  <InfoTooltip content="These are the neighborhoods (submarkets) within this city, ranked by average revenue. Click on one to see properties in that specific area.">
                    <span className="cursor-help" />
                  </InfoTooltip>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-slate-500 font-medium">Neighborhood</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Properties</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Avg Revenue</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Avg Booking</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketNeighborhoods.slice(0, 8).map((neighborhood: any, idx: number) => (
                        <tr key={neighborhood.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-900">{neighborhood.name}</span>
                            {idx === 0 && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Top</span>}
                          </td>
                          <td className="text-right py-3 px-3 text-slate-600">{neighborhood.listingCount}</td>
                          <td className="text-right py-3 px-3 font-medium text-emerald-600">${Math.round(neighborhood.avgRevenue).toLocaleString()}</td>
                          <td className="text-right py-3 px-3 text-slate-600">{Math.round(neighborhood.avgOccupancy)}%</td>
                          <td className="text-right py-3 px-3">
                            <button
                              onClick={() => handleMarketSearch({
                                id: neighborhood.id,
                                name: neighborhood.name,
                                type: 'submarket',
                                listingCount: neighborhood.listingCount,
                                zipcodes: [],
                              })}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Properties
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Property Listings */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900">Properties Making Money</h4>
                <p className="text-sm text-slate-500">Sorted by {exploreSortBy === 'revenue' ? 'highest revenue' : exploreSortBy === 'occupancy' ? 'highest booking rate' : 'best rated'}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {marketListings.slice(0, 20).map((listing: any, idx: number) => (
                  <PropertyCard
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    imageUrl={listing.imageUrl || listing.images?.[0]}
                    bedrooms={listing.bedrooms}
                    bathrooms={listing.bathrooms}
                    propertyType={listing.propertyType || 'Entire home'}
                    rating={listing.rating}
                    reviews={listing.reviewCount}
                    annualRevenue={listing.annualRevenue}
                    occupancy={listing.occupancyRate}
                    adr={listing.adr}
                    airbnbUrl={listing.airbnbUrl}
                    superhost={listing.superhost}
                    index={idx}
                    daysAvailable={listing.daysAvailable}
                    daysReserved={listing.daysReserved}
                    isSaved={isPropertySaved(listing.title)}
                    onSave={() => {
                      promptSave('property', listing.title, () => {
                        saveProperty({
                          title: listing.title,
                          address: selectedMarket.name,
                          bedrooms: listing.bedrooms,
                          bathrooms: listing.bathrooms,
                          revenue: listing.annualRevenue,
                          adr: listing.adr,
                          occupancy: listing.occupancyRate,
                          airbnbUrl: listing.airbnbUrl,
                        });
                        toast.success(`Saved "${listing.title.substring(0, 30)}..." to your list!`);
                      });
                    }}

                  />
                ))}
              </div>
            </div>
            
            {/* Confidence Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8">
              <p className="text-center text-sm text-slate-600">
                <span className="font-medium">Data confidence:</span> Based on{' '}
                <span className="font-bold text-slate-900">{marketListingsStats?.totalCount.toLocaleString() || marketListings.length}</span>{' '}
                active Airbnb properties in {selectedMarket.name}
                {exploreBedroomFilter && (
                  <span className="text-slate-500"> (filtered to {exploreBedroomFilter}BR only)</span>
                )}
              </p>
            </div>
            
            {/* Next Step CTA */}
            <div className="text-center">
              <p className="text-slate-500 mb-4">Found a neighborhood you like? Validate a specific property to see if it will make you money.</p>
              <Button
                onClick={() => setActiveTab('validate')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Target className="w-4 h-4 mr-2" />
                Validate a Specific Deal
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* OLD: Find Your Market Results (keeping for backward compatibility with address-based search) */}
      {activeTab === 'find' && !selectedMarket && areaListings && (
        <section className="py-12 bg-white">
          <div className="container max-w-5xl mx-auto">
            {/* Tesla Dashboard Style Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-sm font-medium mb-4">
                <CheckCircle2 className="w-4 h-4" />
                {totalListings} Opportunities Found
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                Here's What's Making Money
              </h3>
              <p className="text-slate-500 text-lg">
                Real Airbnb properties near <span className="font-medium text-slate-700">{exploreAddress}</span>
              </p>
            </div>
            
            
            {/* Step 2 Verdict Section - What This Data Shows */}
            {(() => {
              // Calculate insights from the listings
              const filteredListings = areaListings
                .filter(listing => listing.airbnb_url && listing.airbnb_url.includes('airbnb.com'));
              const topEarner = filteredListings.reduce((max, l) => (l.annual_revenue || 0) > (max?.annual_revenue || 0) ? l : max, filteredListings[0]);
              const mostBooked = filteredListings.reduce((max, l) => (l.occupancy || 0) > (max?.occupancy || 0) ? l : max, filteredListings[0]);
              const avgRevenue = filteredListings.length > 0 
                ? filteredListings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / filteredListings.length 
                : 0;
              const avgBookingRate = filteredListings.length > 0
                ? filteredListings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / filteredListings.length
                : 0;
              
              // Calculate letter grade for market opportunity
              // Based on avg booking rate and revenue potential
              let opportunityGrade = 'C';
              let gradeColor = 'text-amber-600';
              let gradeBg = 'bg-amber-50 border-amber-200';
              let gradeVerdict = 'Average Opportunity';
              
              if (avgBookingRate >= 65 && avgRevenue >= 60000) {
                opportunityGrade = 'A';
                gradeColor = 'text-emerald-600';
                gradeBg = 'bg-emerald-50 border-emerald-200';
                gradeVerdict = 'Strong Opportunity';
              } else if (avgBookingRate >= 55 && avgRevenue >= 40000) {
                opportunityGrade = 'B+';
                gradeColor = 'text-emerald-500';
                gradeBg = 'bg-emerald-50/70 border-emerald-200';
                gradeVerdict = 'Good Opportunity';
              } else if (avgBookingRate >= 50 && avgRevenue >= 30000) {
                opportunityGrade = 'B';
                gradeColor = 'text-blue-600';
                gradeBg = 'bg-blue-50 border-blue-200';
                gradeVerdict = 'Decent Opportunity';
              } else if (avgBookingRate >= 40) {
                opportunityGrade = 'C+';
                gradeColor = 'text-amber-600';
                gradeBg = 'bg-amber-50 border-amber-200';
                gradeVerdict = 'Moderate Opportunity';
              }
              
              // Calculate contextual comparisons
              const nightsPerYear = Math.round(avgBookingRate * 3.65); // 365 * (rate/100)
              const topEarnerMultiple = avgRevenue > 0 ? ((topEarner?.annual_revenue || 0) / avgRevenue).toFixed(1) : '0';
              
              return (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 mb-8">
                  {/* Guiding Question */}
                  <p className="text-sm text-slate-600 mb-4 font-medium">
                    What can I learn from the top performers in this area?
                  </p>
                  
                  {/* Letter Grade + Title Row */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                    {/* Grade Circle */}
                    <div className="flex-shrink-0">
                      <InfoTooltip content={`This grade is based on the average booking rate (${Math.round(avgBookingRate)}%) and average revenue ($${Math.round(avgRevenue).toLocaleString()}/yr) of properties in this search. A higher grade means better earning potential.`}>
                        <div className={`w-16 h-16 rounded-full ${gradeBg} flex items-center justify-center border-2 cursor-help`}>
                          <span className={`text-2xl font-bold ${gradeColor}`}>{opportunityGrade}</span>
                        </div>
                      </InfoTooltip>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-600" />
                        <h4 className="font-semibold text-slate-900 text-lg">{gradeVerdict}</h4>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Properties here are booked about <span className="font-medium text-slate-700">{nightsPerYear} nights per year</span> on average
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Top Earner */}
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <InfoTooltip content="The highest-earning property in this search. Study what makes it successful - location, amenities, photos, and pricing.">
                          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Top Earner</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-slate-900">${topEarner?.annual_revenue?.toLocaleString() || 0}/yr</p>
                      <p className="text-xs text-slate-500">{parseFloat(topEarnerMultiple) > 1 ? `${topEarnerMultiple}x the average` : 'At average level'}</p>
                    </div>
                    
                    {/* Most Booked */}
                    <div className="bg-white rounded-lg p-4 border border-amber-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        <InfoTooltip content={`The property with the highest booking rate. ${Math.round(mostBooked?.occupancy || 0)}% means it's booked about ${Math.round((mostBooked?.occupancy || 0) * 3.65)} nights per year.`}>
                          <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Most Booked</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{Math.round(mostBooked?.occupancy || 0)}% booked</p>
                      <p className="text-xs text-slate-500">~{Math.round((mostBooked?.occupancy || 0) * 3.65)} nights/year</p>
                    </div>
                    
                    {/* Market Average */}
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        <InfoTooltip content="Average annual revenue across all properties in this search, calculated from actual booking data scraped daily from Airbnb and Vrbo.">
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Avg Revenue</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-slate-900">${Math.round(avgRevenue).toLocaleString()}/yr</p>
                      <p className="text-xs text-slate-500">${Math.round(avgRevenue / 12).toLocaleString()}/month</p>
                    </div>
                    
                    {/* Avg Booking Rate */}
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Percent className="w-4 h-4 text-purple-600" />
                        <InfoTooltip content={`Average booking rate in this market. ${Math.round(avgBookingRate)}% means properties are booked about ${nightsPerYear} nights per year. 50%+ is considered healthy demand.`}>
                          <span className="text-xs font-medium text-purple-600 uppercase tracking-wider">Avg Booking Rate</span>
                        </InfoTooltip>
                      </div>
                      <p className="text-lg font-bold text-slate-900">{Math.round(avgBookingRate)}%</p>
                      <p className="text-xs text-slate-500">{avgBookingRate >= 60 ? 'Strong demand' : avgBookingRate >= 45 ? 'Moderate demand' : 'Lower demand'}</p>
                    </div>
                  </div>
                  
                  {/* Confidence Note */}
                  <p className="text-xs text-slate-500 text-center">
                    Based on {filteredListings.length} active Airbnb properties within your search area
                  </p>
                </div>
              );
            })()}
            
            {/* Tesla Dashboard Style Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Filter & Sort</h4>
                  <p className="text-xs text-slate-500">How can I narrow down my search?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="Choose how to order the properties. 'Most Revenue' shows the highest earners first. 'Highest Booking Rate' shows the most in-demand properties.">
                      <span>Sort By</span>
                    </InfoTooltip>
                  </label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreSortBy}
                    onChange={(e) => setExploreSortBy(e.target.value as typeof exploreSortBy)}
                  >
                    <option value="revenue">Most Revenue</option>
                    <option value="occupancy">Highest Booking Rate</option>
                    <option value="rating">Best Rating</option>
                    <option value="revpar">Highest Avg Daily Earnings</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="'Entire Home' means guests get the whole place. 'Private Room' means guests rent a room in a shared home. Entire homes typically earn more but require more investment.">
                      <span>Property Type</span>
                    </InfoTooltip>
                  </label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={explorePropertyType || ''}
                    onChange={(e) => setExplorePropertyType(e.target.value || null)}
                  >
                    <option value="">All Types</option>
                    <option value="entire_home">Entire Home</option>
                    <option value="private_room">Private Room</option>
                    <option value="shared_room">Shared Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="Guest ratings from 1-5 stars. 4.5+ is good, 4.7+ is excellent, 4.9+ is exceptional. Higher-rated properties often charge more and get more bookings.">
                      <span>Min Rating</span>
                    </InfoTooltip>
                  </label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinRating || ''}
                    onChange={(e) => setExploreMinRating(e.target.value ? parseFloat(e.target.value) : null)}
                  >
                    <option value="">Any Rating</option>
                    <option value="4.5">4.5+ Stars</option>
                    <option value="4.7">4.7+ Stars</option>
                    <option value="4.9">4.9+ Stars</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="How often properties are booked. 50%+ means booked about 183 nights/year. 70%+ means booked about 256 nights/year. Higher booking rates indicate stronger demand.">
                      <span>Min Booking Rate</span>
                    </InfoTooltip>
                  </label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinOccupancy || ''}
                    onChange={(e) => setExploreMinOccupancy(e.target.value ? parseFloat(e.target.value) : null)}
                  >
                    <option value="">Any Booking Rate</option>
                    <option value="50">50%+ Booked</option>
                    <option value="70">70%+ Booked</option>
                    <option value="85">85%+ Booked</option>
                  </select>
                </div>
              </div>
              {/* Second row of filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="Filter by annual revenue. $30K/year = $2,500/month. $50K/year = $4,167/month. Use this to focus on higher-performing properties.">
                      <span>Min Revenue</span>
                    </InfoTooltip>
                  </label>
                  <select 
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    value={exploreMinRevenue || ''}
                    onChange={(e) => setExploreMinRevenue(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Any Revenue</option>
                    <option value="30000">$30K+/year</option>
                    <option value="50000">$50K+/year</option>
                    <option value="75000">$75K+/year</option>
                    <option value="100000">$100K+/year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    <InfoTooltip content="Superhosts are top-rated hosts with excellent reviews and response rates. Filtering for Superhosts shows you the best-performing hosts to learn from.">
                      <span>Host Type</span>
                    </InfoTooltip>
                  </label>
                  <button
                    onClick={() => setExploreSuperhostOnly(!exploreSuperhostOnly)}
                    className={`w-full h-11 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      exploreSuperhostOnly 
                        ? 'bg-amber-500 text-white border-amber-500' 
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${exploreSuperhostOnly ? 'fill-white' : ''}`} />
                    {exploreSuperhostOnly ? 'Top-Rated Only' : 'All Hosts'}
                  </button>
                </div>
              </div>
            </div>
            {/* View Toggle - Tesla Dashboard Style */}
            <div className="flex justify-center gap-2 mb-8">
              <button
                onClick={() => setShowMapView(false)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  !showMapView 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <List className="w-4 h-4" />
                List View
              </button>
              <button
                onClick={() => setShowMapView(true)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showMapView 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Map className="w-4 h-4" />
                Map View
              </button>
            </div>
            
            {/* Listings */}
            {!showMapView ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {areaListings
                  // Filter to only show Airbnb listings
                  .filter(listing => listing.airbnb_url && listing.airbnb_url.includes('airbnb.com'))
                  // Filter by property type
                  .filter(listing => !explorePropertyType || listing.property_type?.toLowerCase().replace(/\s+/g, '_') === explorePropertyType)
                  // Filter by min rating
                  .filter(listing => !exploreMinRating || (listing.rating && listing.rating >= exploreMinRating))
                  // Filter by min occupancy
                  .filter(listing => !exploreMinOccupancy || (listing.occupancy && listing.occupancy >= exploreMinOccupancy))
                  // Filter by min revenue
                  .filter(listing => !exploreMinRevenue || (listing.annual_revenue && listing.annual_revenue >= exploreMinRevenue))
                  // Filter by superhost
                  .filter(listing => !exploreSuperhostOnly || listing.superhost === true)
                  // Sort by selected criteria
                  .sort((a, b) => {
                    if (exploreSortBy === 'revenue') return (b.annual_revenue || 0) - (a.annual_revenue || 0);
                    if (exploreSortBy === 'occupancy') return (b.occupancy || 0) - (a.occupancy || 0);
                    if (exploreSortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
                    if (exploreSortBy === 'revpar') {
                      const revparA = (a.adr || 0) * ((a.occupancy || 0) / 100);
                      const revparB = (b.adr || 0) * ((b.occupancy || 0) / 100);
                      return revparB - revparA;
                    }
                    return 0;
                  })
                  .slice(0, 15)
                  .map((listing, idx) => (
                  <PropertyCard
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    imageUrl={listing.image_url}
                    bedrooms={listing.bedrooms}
                    bathrooms={listing.bathrooms}
                    propertyType={listing.property_type}
                    rating={listing.rating}
                    reviews={listing.reviews}
                    annualRevenue={listing.annual_revenue}
                    occupancy={listing.occupancy}
                    adr={listing.adr}
                    airbnbUrl={listing.airbnb_url}
                    superhost={listing.superhost}
                    index={idx}
                    daysAvailable={listing.days_available}
                    daysReserved={listing.days_reserved}
                    isSaved={isPropertySaved(listing.title)}
                    onSave={() => {
                      // Use promptSave to show login prompt for non-authenticated users
                      promptSave('property', listing.title, () => {
                        saveProperty({
                          title: listing.title,
                          address: exploreAddress,
                          bedrooms: listing.bedrooms,
                          bathrooms: listing.bathrooms,
                          revenue: listing.annual_revenue,
                          adr: listing.adr,
                          occupancy: listing.occupancy,
                          airbnbUrl: listing.airbnb_url,
                        });
                        toast.success(`Saved "${listing.title.substring(0, 30)}..." to your list!`);
                      });
                    }}

                  />
                ))}
              </div>
            ) : (
              exploreCenter && (
                <div className="h-[500px] rounded-xl overflow-hidden border border-slate-700">
                  <MapView
                    initialCenter={exploreCenter}
                    initialZoom={13}
                    onMapReady={() => setMapReady(true)}
                  />
                </div>
              )
            )}
            
            {/* Next Step CTA */}
            <div className="text-center mt-8">
              <p className="text-[oklch(0.50_0_0)] mb-4">Found a property you like? Validate if it will actually make you money.</p>
              <Button
                onClick={() => setActiveTab('validate')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Target className="w-4 h-4 mr-2" />
                Validate a Specific Deal
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Validate the Deal Results - Tesla Dashboard */}
      {activeTab === 'validate' && result && (
        <section className="py-12 bg-slate-50">
          <div className="container max-w-5xl mx-auto px-4">
            {/* Share Report Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Property Analysis Results</h2>
                <p className="text-slate-500">{address}</p>
              </div>
              <UniversalShareButton
                reportType="validator"
                reportData={result}
                address={address}
                bedrooms={parseInt(bedrooms)}
                bathrooms={parseFloat(bathrooms)}
                monthlyRent={parseFloat(monthlyRent) || undefined}
                annualRevenue={(result as any)?.revenue_estimate?.annual || (result as any)?.estimates?.annual_revenue}
                occupancyRate={(result as any)?.revenue_estimate?.occupancy || (result as any)?.estimates?.occupancy_rate}
                averageDailyRate={(result as any)?.revenue_estimate?.nightly || (result as any)?.estimates?.average_daily_rate}
                verdict={(result as any)?.verdict}
                title={`Property Validation - ${address}`}
                summary={`$${((result as any)?.revenue_estimate?.annual || (result as any)?.estimates?.annual_revenue || 0).toLocaleString()}/year • ${Math.round(((result as any)?.revenue_estimate?.occupancy || (result as any)?.estimates?.occupancy_rate || 0) * 100)}% occupancy`}
              />
            </div>
            <TeslaDashboard
              result={result}
              address={address}
              bedrooms={parseInt(bedrooms)}
              bathrooms={parseFloat(bathrooms)}
              monthlyRent={parseFloat(monthlyRent) || undefined}
              furnitureCost={parseFloat(furnitureCost) || 0}
              expensePercent={expensePercent}
              marketId={result.marketId}
              rentometerData={rentometerData}
              mode={globalMode}
              purchasePrice={myProperty?.purchasePrice}
              loanType={myProperty?.loanType as 'conventional' | 'dscr' | 'fha' | 'cash' | undefined}
              downPaymentPercent={myProperty?.downPaymentPercent}
              interestRate={myProperty?.interestRate}
            />
            
            {/* Next Step CTA */}
            <div className="text-center mt-8">
              <p className="text-slate-500 mb-4">Have multiple properties to compare? Find the best one.</p>
              <Button
                onClick={() => {
                  setBulkProperties([
                    { id: '1', address: address, bedrooms: parseInt(bedrooms), bathrooms: parseFloat(bathrooms), rent: parseFloat(monthlyRent) || 0 },
                    { id: '2', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
                  ]);
                  setActiveTab('compare');
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Compare With Other Properties
              </Button>
            </div>
          </div>
        </section>
      )}
      
      {/* Find the Best Deal Results */}
      {activeTab === 'compare' && sortedBulkResults && (
        <section className="py-12 bg-gradient-to-b from-slate-50 to-white">
          <div className="container max-w-6xl mx-auto">
            {/* Share Comparison Header */}
            <div className="flex items-center justify-between mb-6 px-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Property Comparison</h2>
                <p className="text-slate-500">{sortedBulkResults.filter(r => r.status === 'success').length} properties analyzed</p>
              </div>
              <UniversalShareButton
                reportType="comparison"
                reportData={{ properties: sortedBulkResults }}
                title="Property Comparison Report"
                summary={`Comparing ${sortedBulkResults.filter(r => r.status === 'success').length} properties • Best: ${sortedBulkResults[0]?.address || 'N/A'}`}
                annualRevenue={(sortedBulkResults[0] as any)?.annualRevenue || (sortedBulkResults[0] as any)?.revenue}
              />
            </div>
            
            {/* ===== WINNER HERO SECTION ===== */}
            {sortedBulkResults.length > 0 && sortedBulkResults[0].status === 'success' && (
              <div className="mb-10">
                {/* Clean, light winner card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  {/* Header with trophy and grade */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#C9A962]/10 rounded-xl flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-[#C9A962]" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">Your Best Deal</h3>
                        <p className="text-slate-500 text-sm">{sortedBulkResults.filter(r => r.status === 'success').length} properties compared</p>
                      </div>
                    </div>
                    {/* Grade Badge */}
                    <div className={`px-4 py-2 rounded-xl text-center ${
                      sortedBulkResults[0].ratio >= 3 ? 'bg-emerald-50 border border-emerald-200' :
                      sortedBulkResults[0].ratio >= 2 ? 'bg-blue-50 border border-blue-200' :
                      sortedBulkResults[0].ratio >= 1.5 ? 'bg-amber-50 border border-amber-200' :
                      'bg-slate-50 border border-slate-200'
                    }`}>
                      <span className="text-xs text-slate-500 uppercase tracking-wide block">Grade</span>
                      <span className={`text-2xl font-bold ${
                        sortedBulkResults[0].ratio >= 3 ? 'text-emerald-600' :
                        sortedBulkResults[0].ratio >= 2 ? 'text-blue-600' :
                        sortedBulkResults[0].ratio >= 1.5 ? 'text-amber-600' :
                        'text-slate-600'
                      }`}>
                        {sortedBulkResults[0].ratio >= 3 ? 'A+' : 
                         sortedBulkResults[0].ratio >= 2.5 ? 'A' : 
                         sortedBulkResults[0].ratio >= 2 ? 'B+' : 
                         sortedBulkResults[0].ratio >= 1.75 ? 'B' : 
                         sortedBulkResults[0].ratio >= 1.5 ? 'C+' : 
                         sortedBulkResults[0].ratio >= 1.25 ? 'C' : 
                         sortedBulkResults[0].ratio >= 1 ? 'D' : 'F'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Property Address */}
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-slate-900 mb-2">{sortedBulkResults[0].address}</h4>
                    <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm">
                      <span className="flex items-center gap-1">
                        <BedDouble className="w-4 h-4" />
                        {sortedBulkResults[0].bedrooms} bed
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-4 h-4" />
                        {sortedBulkResults[0].bathrooms} bath
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(sortedBulkResults[0].rent)}/mo rent
                      </span>
                    </div>
                  </div>
                  
                  {/* Key Numbers - Simplified */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(sortedBulkResults[0].profit)}</p>
                      <p className="text-xs text-slate-500 mt-1">Monthly Profit</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900">{sortedBulkResults[0].ratio.toFixed(1)}x</p>
                      <p className="text-xs text-slate-500 mt-1">Profit Multiplier</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(sortedBulkResults[0].revenue)}</p>
                      <p className="text-xs text-slate-500 mt-1">Monthly Revenue</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900">{Math.round((sortedBulkResults[0].occupancy > 1 ? sortedBulkResults[0].occupancy : sortedBulkResults[0].occupancy * 100))}%</p>
                      <p className="text-xs text-slate-500 mt-1">Booking Rate</p>
                    </div>
                  </div>
                  
                  {/* Annual Highlight */}
                  <div className="bg-[#C9A962]/5 border border-[#C9A962]/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#C9A962] font-medium">Annual Profit Potential</p>
                        <p className="text-3xl font-bold text-slate-900">{formatCurrency(sortedBulkResults[0].profit * 12)}<span className="text-lg font-normal text-slate-500">/year</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Nightly Rate</p>
                        <p className="text-xl font-semibold text-slate-900">${Math.round(sortedBulkResults[0].adr)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Share Button */}
                  <button
                    onClick={() => {
                      const shareData = {
                        results: sortedBulkResults.filter(r => r.status === 'success').map(r => ({
                          address: r.address,
                          bedrooms: r.bedrooms,
                          bathrooms: r.bathrooms,
                          rent: r.rent,
                          revenue: r.revenue,
                          profit: r.profit,
                          ratio: r.ratio,
                          occupancy: r.occupancy,
                          adr: r.adr
                        })),
                        createdAt: new Date().toISOString()
                      };
                      const encoded = btoa(JSON.stringify(shareData));
                      const shareUrl = `${window.location.origin}/share/compare/${encoded}`;
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Share link copied to clipboard!', {
                        description: 'Send this link to anyone to show them your comparison results.'
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-medium transition-all duration-200"
                  >
                    <Share2 className="w-5 h-5" />
                    Share These Results
                  </button>
                </div>
              </div>
            )}
            
            {/* ===== HOW WE CALCULATE THIS + GRADE GUIDE ===== */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {/* How We Calculate This */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <button 
                  onClick={() => setShowMethodology(!showMethodology)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img src="/images/airbnb-logo.png" alt="Airbnb" className="h-8 w-auto" />
                      <span className="text-slate-300 text-lg">+</span>
                      <img src="/images/vrbo-logo.png" alt="VRBO" className="h-6 w-auto" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">How We Calculate This</h4>
                      <p className="text-sm text-slate-500">Powered by real performance data</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showMethodology ? 'rotate-180' : ''}`} />
                </button>
                {showMethodology && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-sm text-slate-600">
                    <p><strong>Revenue Estimates:</strong> Based on actual performance data from similar Airbnb and VRBO listings in your area.</p>
                    <p><strong>Nightly Rate (ADR):</strong> The average price per night that comparable properties charge in this market.</p>
                    <p><strong>Booking Rate:</strong> How often similar properties are booked throughout the year.</p>
                    <p><strong>Profit Calculation:</strong> Monthly Revenue minus your Rent = Your Take-Home Profit.</p>
                    <p className="text-slate-500 italic">We analyze properties with similar bedrooms, bathrooms, and location to give you the most accurate estimate.</p>
                  </div>
                )}
              </div>
              
              {/* Grade Guide */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Award className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Understanding Grades</h4>
                    <p className="text-sm text-slate-500">Based on profit multiplier</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">A+</span>
                    <span className="text-slate-600">3x+ rent (Excellent)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-emerald-400 text-white font-bold flex items-center justify-center text-xs">A</span>
                    <span className="text-slate-600">2.5x+ rent (Great)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-blue-500 text-white font-bold flex items-center justify-center text-xs">B+</span>
                    <span className="text-slate-600">2x+ rent (Good)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-blue-400 text-white font-bold flex items-center justify-center text-xs">B</span>
                    <span className="text-slate-600">1.75x+ rent (Solid)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-amber-400 text-white font-bold flex items-center justify-center text-xs">C+</span>
                    <span className="text-slate-600">1.5x+ rent (Fair)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-amber-500 text-white font-bold flex items-center justify-center text-xs">C</span>
                    <span className="text-slate-600">1.25x+ rent (Moderate)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-orange-500 text-white font-bold flex items-center justify-center text-xs">D</span>
                    <span className="text-slate-600">1x+ rent (Risky)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-red-500 text-white font-bold flex items-center justify-center text-xs">F</span>
                    <span className="text-slate-600">Below 1x (Losing $)</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* ===== QUICK COMPARISON TABLE ===== */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">All Properties Compared</h3>
                    <p className="text-slate-500 text-sm mt-1">Ranked by {bulkSortBy === 'profit' ? 'monthly profit' : bulkSortBy === 'revenue' ? 'revenue' : 'profit multiplier'}</p>
                  </div>
                  <div className="flex gap-2">
                    {(['profit', 'revenue', 'ratio'] as const).map(sortType => (
                      <button
                        key={sortType}
                        onClick={() => {
                          if (bulkSortBy === sortType) {
                            setBulkSortDir(bulkSortDir === 'desc' ? 'asc' : 'desc');
                          } else {
                            setBulkSortBy(sortType);
                            setBulkSortDir('desc');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                          bulkSortBy === sortType 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sortType === 'profit' ? 'Profit' : sortType === 'revenue' ? 'Revenue' : 'Multiplier'}
                        {bulkSortBy === sortType && (
                          bulkSortDir === 'desc' ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rank</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Property</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="Your monthly rent or mortgage payment for this property.">
                          <span>Rent</span>
                        </InfoTooltip>
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="Estimated monthly income from guest bookings, before subtracting rent.">
                          <span>Revenue</span>
                        </InfoTooltip>
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="Monthly revenue minus rent. This is your take-home before other expenses.">
                          <span>Profit</span>
                        </InfoTooltip>
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="How many times your rent you could earn. 2x+ is good, 3x+ is excellent.">
                          <span>Multiplier</span>
                        </InfoTooltip>
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="How often the property is booked. 50%+ means booked about 183 nights/year.">
                          <span>Booking</span>
                        </InfoTooltip>
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <InfoTooltip content="Letter grade based on profit multiplier. A+ = 3x+ (excellent), B+ = 2x+ (good), C = 1.25x+ (moderate), F = losing money.">
                          <span>Grade</span>
                        </InfoTooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedBulkResults.map((result, idx) => (
                      <tr 
                        key={result.id} 
                        className={`hover:bg-slate-50 transition-colors ${
                          idx === 0 && result.status === 'success' ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            idx === 0 && result.status === 'success'
                              ? 'bg-emerald-500 text-white'
                              : idx === 1 && result.status === 'success'
                              ? 'bg-blue-500 text-white'
                              : idx === 2 && result.status === 'success'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {idx === 0 && result.status === 'success' ? (
                              <Trophy className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Home className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px]">{result.address}</p>
                              <p className="text-xs text-slate-500">{result.bedrooms} bed • {result.bathrooms} bath</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-slate-600">{formatCurrency(result.rent)}</span>
                        </td>
                        {result.status === 'success' ? (
                          <>
                            <td className="py-4 px-4 text-right">
                              <span className="font-medium text-slate-900">{formatCurrency(result.revenue)}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={`font-bold ${result.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {result.profit > 0 ? '+' : ''}{formatCurrency(result.profit)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${
                                result.ratio >= 2 ? 'bg-emerald-100 text-emerald-700' :
                                result.ratio >= 1.5 ? 'bg-blue-100 text-blue-700' :
                                result.ratio >= 1 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {result.ratio.toFixed(1)}x
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-slate-600">{Math.round((result.occupancy > 1 ? result.occupancy : result.occupancy * 100))}%</span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold ${
                                result.ratio >= 3 ? 'bg-emerald-500 text-white' :
                                result.ratio >= 2.5 ? 'bg-emerald-400 text-white' :
                                result.ratio >= 2 ? 'bg-blue-500 text-white' :
                                result.ratio >= 1.75 ? 'bg-blue-400 text-white' :
                                result.ratio >= 1.5 ? 'bg-amber-400 text-white' :
                                result.ratio >= 1.25 ? 'bg-amber-500 text-white' :
                                result.ratio >= 1 ? 'bg-orange-500 text-white' :
                                'bg-red-500 text-white'
                              }`}>
                                {result.ratio >= 3 ? 'A+' : 
                                 result.ratio >= 2.5 ? 'A' : 
                                 result.ratio >= 2 ? 'B+' : 
                                 result.ratio >= 1.75 ? 'B' : 
                                 result.ratio >= 1.5 ? 'C+' : 
                                 result.ratio >= 1.25 ? 'C' : 
                                 result.ratio >= 1 ? 'D' : 'F'}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="py-4 px-4 text-center">
                            <span className="text-red-500 text-sm flex items-center justify-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {result.error || 'Analysis failed'}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* ===== DETAILED CARDS (Expandable) ===== */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Detailed Breakdown</h4>
              {sortedBulkResults.filter(r => r.status === 'success').slice(0, 5).map((result, idx) => (
                <div 
                  key={result.id} 
                  className={`bg-white border rounded-xl overflow-hidden transition-all duration-300 ${
                    idx === 0
                      ? 'border-emerald-200 shadow-md'
                      : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex flex-col lg:flex-row gap-5">
                      {/* Left: Rank + Grade + Property Info */}
                      <div className="flex gap-4 items-start flex-1 min-w-0">
                        {/* Rank Badge */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${
                          idx === 0
                            ? 'bg-emerald-500 text-white'
                            : idx === 1
                            ? 'bg-blue-500 text-white'
                            : idx === 2
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx === 0 ? <Trophy className="w-5 h-5" /> : `#${idx + 1}`}
                        </div>
                        
                        {/* Grade Badge */}
                        <InfoTooltip content={`Grade based on profit multiplier. A+ = 3x+ (excellent), B+ = 2x+ (good), C = 1.25x+ (moderate), F = losing money.`}>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${
                            result.ratio >= 3 ? 'bg-emerald-500 text-white' :
                            result.ratio >= 2.5 ? 'bg-emerald-400 text-white' :
                            result.ratio >= 2 ? 'bg-blue-500 text-white' :
                            result.ratio >= 1.75 ? 'bg-blue-400 text-white' :
                            result.ratio >= 1.5 ? 'bg-amber-400 text-white' :
                            result.ratio >= 1.25 ? 'bg-amber-500 text-white' :
                            result.ratio >= 1 ? 'bg-orange-500 text-white' :
                            'bg-red-500 text-white'
                          }`}>
                            {result.ratio >= 3 ? 'A+' : 
                             result.ratio >= 2.5 ? 'A' : 
                             result.ratio >= 2 ? 'B+' : 
                             result.ratio >= 1.75 ? 'B' : 
                             result.ratio >= 1.5 ? 'C+' : 
                             result.ratio >= 1.25 ? 'C' : 
                             result.ratio >= 1 ? 'D' : 'F'}
                          </div>
                        </InfoTooltip>
                        
                        <div className="min-w-0">
                          <h4 className="text-slate-900 font-semibold text-lg truncate">{result.address}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <BedDouble className="w-4 h-4" />
                              {result.bedrooms} bed
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-4 h-4" />
                              {result.bathrooms} bath
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {formatCurrency(result.rent)}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Key Metrics */}
                      <div className="grid grid-cols-4 gap-3 lg:w-auto">
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Profit</p>
                          <p className={`text-lg font-bold ${result.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(result.profit)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Revenue</p>
                          <p className="text-lg font-bold text-slate-900">{formatCurrency(result.revenue)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Multiplier</p>
                          <p className="text-lg font-bold text-purple-600">{result.ratio.toFixed(1)}x</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-1">Booking</p>
                          <p className="text-lg font-bold text-amber-600">{Math.round((result.occupancy > 1 ? result.occupancy : result.occupancy * 100))}%</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Additional Insights */}
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <InfoTooltip content="Your total profit for the year after paying rent each month. This is what you could take home annually.">
                          <span className="text-slate-500">Annual Profit</span>
                        </InfoTooltip>
                        <p className={`font-semibold ${result.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(result.profit * 12)}/yr
                        </p>
                      </div>
                      <div>
                        <InfoTooltip content={`What percentage of your revenue becomes profit. ${Math.round((result.profit / result.revenue) * 100)}% means ${Math.round((result.profit / result.revenue) * 100)}¢ of every dollar earned is profit.`}>
                          <span className="text-slate-500">Profit Margin</span>
                        </InfoTooltip>
                        <p className="font-semibold text-slate-900">
                          {Math.round((result.profit / result.revenue) * 100)}%
                        </p>
                      </div>
                      <div>
                        <InfoTooltip content="Average price per night that guests pay. Also called ADR (Average Daily Rate).">
                          <span className="text-slate-500">Nightly Rate</span>
                        </InfoTooltip>
                        <p className="font-semibold text-slate-900">${Math.round(result.adr)}/night</p>
                      </div>
                      <div>
                        <InfoTooltip content={`The minimum booking rate needed to cover your rent. ${Math.round((result.rent / result.revenue) * 100)}% means you need guests ${Math.round((result.rent / result.revenue) * 100 * 3.65)} nights/year just to break even. Lower is safer.`}>
                          <span className="text-slate-500">Break-Even</span>
                        </InfoTooltip>
                        <p className="font-semibold text-slate-900">
                          {Math.round((result.rent / result.revenue) * 100)}% occupancy
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show remaining properties if more than 5 */}
              {sortedBulkResults.filter(r => r.status === 'success').length > 5 && (
                <p className="text-center text-slate-500 text-sm py-4">
                  + {sortedBulkResults.filter(r => r.status === 'success').length - 5} more properties in the table above
                </p>
              )}
            </div>
            
            {/* Error Results */}
            {sortedBulkResults.filter(r => r.status === 'error').length > 0 && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {sortedBulkResults.filter(r => r.status === 'error').length} Properties Could Not Be Analyzed
                </h4>
                <ul className="space-y-1 text-sm text-red-700">
                  {sortedBulkResults.filter(r => r.status === 'error').map(result => (
                    <li key={result.id} className="flex items-center gap-2">
                      <span className="truncate">{result.address}</span>
                      <span className="text-red-500">— {result.error || 'Unknown error'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* ===== WHAT'S NOT INCLUDED DISCLAIMER ===== */}
            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-900 mb-2">What's Not Included in These Estimates</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Cleaning fees (typically $75-150/turnover)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Platform fees (Airbnb takes ~3%, VRBO ~5%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Supplies & consumables</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Utilities (if not included in rent)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Furniture & setup costs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Property management (if outsourced)</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mt-3 italic">
                    Actual results depend on your listing quality, pricing strategy, and guest reviews.
                  </p>
                </div>
              </div>
            </div>
            
            {/* CTA */}
            <div className="mt-8 bg-white border border-slate-200 rounded-xl p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-xl mb-4">
                  <Zap className="w-7 h-7 text-emerald-500" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Ready to Take Action?</h4>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Get personalized guidance on your next steps with Coach Inayah's Turnkey Program
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                    onClick={() => window.open('https://masterclass.coachinayah.com/the-turnkey-program', '_blank')}
                  >
                    Learn About the Turnkey Program
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setBulkProperties([
                        { id: '1', address: '', bedrooms: 2, bathrooms: 1, rent: 0 },
                        { id: '2', address: '', bedrooms: 2, bathrooms: 1, rent: 0 }
                      ]);
                      setBulkResults(null);
                    }}
                  >
                    Compare More Properties
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* FOOTER CTA */}
      {/* ============================================ */}
      <section className="section-padding border-t border-[oklch(0.92_0_0)] bg-[oklch(0.97_0_0)]">
        <div className="container max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)] mb-4 tracking-tight">
            Ready to Start Your Journey?
          </h2>
          <p className="text-[oklch(0.45_0_0)] text-lg mb-10 leading-relaxed">
            These free tools prove the opportunity is real. When you're ready for personalized guidance, 
            Coach Inayah's Turnkey Program will help you take action.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn-gold-outline flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Read the Guide First
            </button>
            <a 
              href="https://masterclass.coachinayah.com/the-turnkey-program"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold flex items-center justify-center gap-2"
            >
              Explore the Turnkey Program
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
      
      {/* FOOTER - Business Info & Policy Links (Affirm Compliance) */}
      <footer className="border-t border-[oklch(0.90_0_0)] bg-[oklch(0.98_0_0)] py-10">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Business Info */}
            <div>
              <h4 className="font-semibold text-[oklch(0.20_0_0)] mb-3">I&B Coaching</h4>
              <p className="text-[oklch(0.50_0_0)] text-sm leading-relaxed">
                Las Vegas, NV 89134<br />
                United States
              </p>
            </div>
            
            {/* Support */}
            <div>
              <h4 className="font-semibold text-[oklch(0.20_0_0)] mb-3">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:support@coachinayah.com" className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.55_0.14_75)] transition-colors">
                    support@coachinayah.com
                  </a>
                </li>
                <li>
                  <a href="/contact" className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.55_0.14_75)] transition-colors">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
            
            {/* Policies */}
            <div>
              <h4 className="font-semibold text-[oklch(0.20_0_0)] mb-3">Policies</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/refund-policy" className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.55_0.14_75)] transition-colors">
                    Refund Policy
                  </a>
                </li>
                <li>
                  <a href="/privacy-policy" className="text-[oklch(0.50_0_0)] hover:text-[oklch(0.55_0.14_75)] transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[oklch(0.90_0_0)] pt-6 text-center text-[oklch(0.55_0_0)] text-sm">
            <p>&copy; {new Date().getFullYear()} I&B Coaching. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Save Login Prompt Modal */}
      <SaveLoginPrompt
        isOpen={showSavePrompt}
        onClose={handleCloseSavePrompt}
        onContinueWithoutAccount={handleContinueWithoutAccount}
        itemType={pendingSave?.type || 'market'}
        itemName={pendingSave?.name || ''}
      />
      
      {/* Bug Report Button */}
      <BugReportButton
        toolName={activeTab ? `Step ${activeTab}` : undefined}
        propertyAddress={address || undefined}
        city={researchMarket?.split(',')[0]?.trim()}
        state={researchMarket?.split(',')[1]?.trim()}
      />
      
      {/* Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {[
            { tab: 'ebook' as TabType, icon: BookOpen, label: 'Guide' },
            { tab: 'opportunity' as TabType, icon: Search, label: 'Find' },
            { tab: 'validate' as TabType, icon: Target, label: 'Validate' },
            { tab: 'compare' as TabType, icon: Trophy, label: 'Compare' },
            { tab: 'advisor' as TabType, icon: Sparkles, label: 'AI' },
          ].map(({ tab, icon: Icon, label }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  // Scroll to tools section
                  document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex flex-col items-center justify-center min-w-[60px] py-2 px-1 rounded-lg transition-all ${
                  isActive
                    ? 'text-amber-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-0.5 transition-all ${
                  isActive
                    ? 'bg-amber-100'
                    : 'bg-transparent'
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-amber-600' : ''}`} />
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-amber-600' : ''}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Safe area spacer for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
      
      {/* Bottom padding to prevent content from being hidden behind bottom nav on mobile */}
      <div className="sm:hidden h-20" />
    </div>
    </>
  );
}
