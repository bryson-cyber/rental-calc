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
      
      {/* Legacy/admin routes */}
      <Route path={"/full-analysis"} component={PropertyAnalyzer} />
      <Route path={"/deep-analysis/:reportId"} component={DeepAnalysis} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/reports"} component={AdminReports} />
      
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
          </TooltipProvider>
        </PropertyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
