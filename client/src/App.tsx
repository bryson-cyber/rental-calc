import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SmartHome from "./pages/SmartHome";
import MarketReport from "./pages/MarketReport";
import MarketComparison from "./pages/MarketComparison";
import PropertyComparison from "./pages/PropertyComparison";
import SavedSearchesPage from "./pages/SavedSearchesPage";
import MarketScorecard from "./pages/MarketScorecard";
import MarketMap from "./pages/MarketMap";
import RadiusSearch from "./pages/RadiusSearch";
import SeasonalityCalendar from "./pages/SeasonalityCalendar";
import AIAdvisor from "./pages/AIAdvisor";
import PropertyAnalyzer from "./pages/PropertyAnalyzer";

import TopPerformers from "./pages/TopPerformers";
import AdminReports from "./pages/AdminReports";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={PropertyAnalyzer} />
      <Route path={"/smart"} component={SmartHome} />
      <Route path={"/property"} component={Home} />
      <Route path={"/market"} component={MarketReport} />
      <Route path={"/compare"} component={MarketComparison} />
      <Route path={"/compare-properties"} component={PropertyComparison} />
      <Route path={"/saved"} component={SavedSearchesPage} />
      <Route path={"/scorecard"} component={MarketScorecard} />
      <Route path={"/map"} component={MarketMap} />
      <Route path={"/radius"} component={RadiusSearch} />
      <Route path={"/seasonality"} component={SeasonalityCalendar} />
      <Route path={"/advisor"} component={AIAdvisor} />

      <Route path={"/top-performers"} component={TopPerformers} />
      <Route path={"/admin"} component={AdminReports} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
