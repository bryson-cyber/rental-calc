/**
 * Barrel exports for all feature-based routers.
 * Import from this file instead of individual router files.
 */

export { rentalRouter } from "./rental";
// export { advancedRouter } from "./advanced"; // Removed - AirDNA market features
export { sharedReportsRouter } from "./shared-reports";
export { regulationTrackerRouter } from "./regulation-tracker";
export { savedSearchesRouter } from "./saved-searches";
export { favoritesRouter } from "./favorites";
export { favoriteListingsRouter } from "./favorite-listings";
export { exportRouter } from "./export";
export { deepAnalysisRouter } from "./deep-analysis";
// REMOVED: export { listingsByAreaRouter } from "./listings-by-area";
// export { compDataRouter } from "./comp-data"; // Removed - AirDNA market features
export { bulkSummaryRouter } from "./bulk-summary";
// REMOVED: export { marketComparisonRouter } from "./market-comparison";
// REMOVED: export { marketDiscoveryRouter } from "./market-discovery";
// REMOVED: export { favoriteMarketsRouter } from "./favorite-markets";
// REMOVED: export { marketAlertsRouter } from "./market-alerts";
export { notificationsRouter } from "./notifications";
export { rentometerRouter } from "./rentometer";
// REMOVED: export { marketExplorerRouter } from "./market-explorer";
export { zillowRouter } from "./zillow";
export { redfinRouter } from "./redfin";
export { webhookRouter } from "./webhook";
export { emailOptinRouter } from "./email-optin";
export { adminTrackingRouter } from "./admin-tracking";
export { bugReportsRouter } from "./bug-reports";
export { shareableReportsRouter } from "./shareable-reports";
export { aiRouter } from "./ai";
export { dealAlertsRouter } from "./deal-alerts";
export { behaviorEngineRouter } from "./behavior-engine";
export { myReportsRouter } from "./my-reports";
export { voiceBugReportRouter } from "./voice-bug-report";
export { translationRouter } from "./translation";
export { contentStudioRouter } from "./content-studio";
export { contentHubRouter } from "./content-hub";
export { webinarSmsRouter } from "./webinar-sms";
export { leaseReaderRouter } from "./lease-reader";
export { webinarEnvRouter } from "./webinar-env";
export { tosRouter } from "./tos";
// export { publicExploreRouter } from "./public-explore"; // Removed - market features
