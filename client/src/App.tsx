import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PropertyProvider } from "./contexts/PropertyContext";
import { ReportModeProvider } from "./contexts/ReportModeContext";
import { ReportModeToggle } from "./components/ReportModeToggle";
import { ReportModeOnboarding } from "./components/ReportModeOnboarding";
import { TrustBanner } from "./components/TrustBanner";
import { MockModeBadge } from "./components/MockModeBadge";
import { PageTracker } from "./components/PageTracker";
import GlobalAutoTranslator from "./components/GlobalAutoTranslator";
import GlobalLanguageSelector from "./components/GlobalLanguageSelector";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy loaded: Landing page (was eagerly loaded but 6700+ lines causes 3MB main bundle)
const LeadMagnet = lazy(() => import("./pages/LeadMagnet"));

// Lazy loaded: All other pages (code-split into separate chunks)
const NotFound = lazy(() => import("@/pages/NotFound"));
const PropertyAnalyzer = lazy(() => import("./pages/PropertyAnalyzer"));
const DeepAnalysis = lazy(() => import("./pages/DeepAnalysis"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminDashboard = lazy(() => import("./pages/Admin"));
const MapViewPage = lazy(() => import("./pages/MapViewPage"));
const MarketAdvisor = lazy(() => import("./pages/MarketAdvisor"));
const MarketComparisonPage = lazy(() => import("./pages/MarketComparisonPage"));
const MarketDiscoveryPage = lazy(() => import("./pages/MarketDiscoveryPage"));
const MyFavoritesPage = lazy(() => import("./pages/MyFavoritesPage"));
const MyFavorites = lazy(() => import("./pages/MyFavorites"));
const MarketAlertsPage = lazy(() => import("./pages/MarketAlertsPage"));
const SharedReportPage = lazy(() => import("./pages/SharedReportPage"));
const SharedComparisonPage = lazy(() => import("./pages/SharedComparisonPage"));
const OpportunityFinder = lazy(() => import("./pages/OpportunityFinder"));
const SavedItemsPage = lazy(() => import("./pages/SavedItemsPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Contact = lazy(() => import("./pages/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const SavedRegulations = lazy(() => import("./pages/SavedRegulations"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const BugReportPage = lazy(() => import("./pages/BugReportPage"));
const InvestmentCalculator = lazy(() => import("./pages/InvestmentCalculator"));
const ShareableReport = lazy(() => import("./pages/ShareableReport"));
const ShareableReportViewer = lazy(() => import("./pages/ShareableReportViewer"));
const ShareRedirect = lazy(() => import("./pages/ShareRedirect"));
const NotificationAnalytics = lazy(() => import("./pages/NotificationAnalytics"));
const NewsletterDashboard = lazy(() => import("./pages/admin/NewsletterDashboard"));
const ApiUsageDashboard = lazy(() => import("./pages/ApiUsage"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const UnifiedAdmin = lazy(() => import("./pages/UnifiedAdmin"));
const FullReportGenerator = lazy(() => import("./pages/FullReportGenerator"));
const DealAlertsPage = lazy(() => import("./pages/DealAlertsPage"));
const MarketEvaluationPage = lazy(() => import("./pages/MarketEvaluationPage"));
const MyReportsPage = lazy(() => import("./pages/MyReportsPage"));
const ContentStudioPage = lazy(() => import("./pages/ContentStudioPage"));
const WebinarCampaignManager = lazy(() => import("./pages/WebinarCampaignManager"));

// Minimal loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Main lead magnet page - lazy loaded */}
        <Route path={"/"} component={LeadMagnet} />
        
        {/* Map View - Step 7 */}
        <Route path={"/map"} component={MapViewPage} />
        
        {/* Market Advisor - Standalone market analysis */}
        <Route path={"/market-advisor"} component={MarketAdvisor} />
        
        {/* Market Comparison */}
        <Route path={"/compare-markets"} component={MarketComparisonPage} />
        
        {/* US Market Discovery */}
        <Route path={"/discover-markets"} component={MarketDiscoveryPage} />
        
        {/* My Favorites - Markets */}
        <Route path={"/my-favorites"} component={MyFavoritesPage} />
        
        {/* My Saved Properties - Listings from map view */}
        <Route path={"/saved-properties"} component={MyFavorites} />
        
        {/* Market Alerts */}
        <Route path={"/market-alerts"} component={MarketAlertsPage} />
        
        {/* My Saved Items */}
        <Route path={"/saved-items"} component={SavedItemsPage} />
        
        {/* Saved Regulations */}
        <Route path={"/saved-regulations"} component={SavedRegulations} />
        
        {/* My Reports */}
        <Route path={"/my-reports"} component={MyReportsPage} />
        
        {/* My Account */}
        <Route path={"/account"} component={AccountPage} />
        
        {/* Policy Pages (Affirm Compliance) */}
        <Route path={"/refund-policy"} component={RefundPolicy} />
        <Route path={"/contact"} component={Contact} />
        <Route path={"/privacy-policy"} component={PrivacyPolicy} />
        
        {/* Shared Reports */}
        <Route path="/report/:shareId" component={SharedReportPage} />
        <Route path="/share/compare/:data" component={SharedComparisonPage} />
        
        {/* Shareable Regulation Reports */}
        <Route path="/regulation/:shareCode" component={ShareableReport} />
        
        {/* Universal Shareable Reports - Public report viewer */}
        <Route path="/share/:shareCode" component={ShareableReportViewer} />
        
        {/* Legacy: Direct report viewer (for backwards compatibility) */}
        <Route path="/view-report/:shareCode" component={ShareableReportViewer} />
        
        {/* Bug Reports */}
        <Route path="/bug/:shareCode" component={BugReportPage} />
        
        {/* Opportunity Finder - Browse Zillow listings */}
        <Route path="/opportunity-finder" component={OpportunityFinder} />
        
        {/* Investment Calculator - For property buyers */}
        <Route path="/investment-calculator" component={InvestmentCalculator} />
        
        {/* Full Report Generator - Standalone report from address */}
        <Route path="/full-report" component={FullReportGenerator} />
        
        {/* Deal Alert Agent - Automated deal scanning */}
        <Route path="/deal-alerts" component={DealAlertsPage} />
        
        {/* One-Click Market Evaluation */}
        <Route path="/evaluate-market" component={MarketEvaluationPage} />
        
        {/* Content Studio - Script Generator */}
        {/* Content Studio is now in admin portal at /admin/dashboard?tab=content-studio */}
        
        {/* Webinar Campaign Manager - Standalone SMS hub */}
        <Route path="/webinar-campaigns" component={WebinarCampaignManager} />
        
        {/* Analysis routes */}
        <Route path={"/full-analysis"} component={PropertyAnalyzer} />
        <Route path={"/deep-analysis/:reportId"} component={DeepAnalysis} />
        
        {/* Unified Admin Dashboard - all admin functionality in one place */}
        <Route path={"/admin/dashboard"} component={UnifiedAdmin} />
        <Route path={"/admin"}>{() => { window.location.replace('/admin/dashboard'); return null; }}</Route>
        <Route path={"/admin/:rest*"}>{() => { window.location.replace('/admin/dashboard'); return null; }}</Route>
        
        {/* 404 */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <PropertyProvider>
          <ReportModeProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <PageTracker />
              <TrustBanner />
              <MockModeBadge />
              <ReportModeToggle />
              <ReportModeOnboarding />
              <GlobalLanguageSelector />
              <GlobalAutoTranslator />
            </TooltipProvider>
          </ReportModeProvider>
        </PropertyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
