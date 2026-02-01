import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PropertyProvider } from "./contexts/PropertyContext";
import LeadMagnet from "./pages/LeadMagnet";
import PropertyAnalyzer from "./pages/PropertyAnalyzer";
import DeepAnalysis from "./pages/DeepAnalysis";
import AdminReports from "./pages/AdminReports";
import AdminDashboard from "./pages/Admin";
import MapViewPage from "./pages/MapViewPage";
import MarketAdvisor from "./pages/MarketAdvisor";
import MarketComparisonPage from "./pages/MarketComparisonPage";
import MarketDiscoveryPage from "./pages/MarketDiscoveryPage";
import MyFavoritesPage from "./pages/MyFavoritesPage";
import MyFavorites from "./pages/MyFavorites";
import MarketAlertsPage from "./pages/MarketAlertsPage";
import SharedReportPage from "./pages/SharedReportPage";
import SharedComparisonPage from "./pages/SharedComparisonPage";
import OpportunityFinder from "./pages/OpportunityFinder";
import { TrustBanner } from "./components/TrustBanner";
import SavedItemsPage from "./pages/SavedItemsPage";
import AccountPage from "./pages/AccountPage";
import RefundPolicy from "./pages/RefundPolicy";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import SavedRegulations from "./pages/SavedRegulations";
import AdminPortal from "./pages/AdminPortal";
import BugReportPage from "./pages/BugReportPage";
import InvestmentCalculator from "./pages/InvestmentCalculator";
import ShareableReport from "./pages/ShareableReport";
import ShareableReportViewer from "./pages/ShareableReportViewer";
import NotificationAnalytics from "./pages/NotificationAnalytics";

function Router() {
  return (
    <Switch>
      {/* Main lead magnet page */}
      <Route path={"/"} component={LeadMagnet} />
      
      {/* Map View - Step 5 */}
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
      
      {/* Universal Shareable Reports (all tools) */}
      <Route path="/share/:shareCode" component={ShareableReportViewer} />
      
      {/* Bug Reports */}
      <Route path="/bug/:shareCode" component={BugReportPage} />
      
      {/* Opportunity Finder - Browse Zillow listings */}
      <Route path="/opportunity-finder" component={OpportunityFinder} />
      
      {/* Investment Calculator - For property buyers */}
      <Route path="/investment-calculator" component={InvestmentCalculator} />
      
      {/* Legacy/admin routes */}
      <Route path={"/full-analysis"} component={PropertyAnalyzer} />
      <Route path={"/deep-analysis/:reportId"} component={DeepAnalysis} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/reports"} component={AdminReports} />
      <Route path={"/admin/hubspot"} component={AdminPortal} />
      <Route path={"/admin/notifications"} component={NotificationAnalytics} />
      
      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <PropertyProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <TrustBanner />
          </TooltipProvider>
        </PropertyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
