# Coach Inayah Rental Revenue Calculator — Complete Developer Guide

**Last Updated:** March 10, 2026
**Live URL:** https://coachinayahturnkeytool.com
**GitHub:** Connected via `user_github` remote
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL (TiDB)

---

## Table of Contents

1. [How This App Works (Plain English)](#1-how-this-app-works-plain-english)
2. [Project Architecture](#2-project-architecture)
3. [Every Folder and What It Does](#3-every-folder-and-what-it-does)
4. [Every Backend File and What It Does](#4-every-backend-file-and-what-it-does)
5. [Every Frontend File and What It Does](#5-every-frontend-file-and-what-it-does)
6. [Database Tables](#6-database-tables)
7. [External API Integrations](#7-external-api-integrations)
8. [Background Jobs (Crons)](#8-background-jobs-crons)
9. [Environment Variables](#9-environment-variables)
10. [How tRPC Works (The API Layer)](#10-how-trpc-works-the-api-layer)
11. [Safe Editing Rules](#11-safe-editing-rules)
12. [How to Push Changes Without Breaking Anything](#12-how-to-push-changes-without-breaking-anything)
13. [Common Bugs and How to Fix Them](#13-common-bugs-and-how-to-fix-them)

---

## 1. How This App Works (Plain English)

This is a **lead generation tool** for Coach Inayah's Airbnb rental arbitrage business. A visitor enters a property address, the app pulls real market data (AirDNA, Rentometer, Zillow, Redfin), runs an AI analysis, and shows projected rental revenue. Before seeing results, the visitor enters their name/email/phone — that's the lead capture. The lead goes to HubSpot CRM and gets enrolled in SMS sequences via SimpleTexting.

There is also an **admin portal** where you (the owner) can:
- View all leads and their reports
- Manage WebinarJam SMS campaigns (auto-import registrants, send SMS sequences, send Google Calendar invites)
- Send newsletters
- Manage deal alerts
- View API usage and analytics
- Generate content for social media

The app is hosted on Manus infrastructure. The database is TiDB (MySQL-compatible). Files are stored on S3.

---

## 2. Project Architecture

```
Browser (React SPA)
    ↓ tRPC calls over HTTP
Express Server (Node.js)
    ↓ Drizzle ORM queries
TiDB Database (MySQL)
    ↓
S3 Storage (file uploads)
```

**How requests flow:**

1. User clicks something in the browser (React frontend)
2. Frontend calls `trpc.someRouter.someMethod.useQuery()` or `.useMutation()`
3. This hits the Express server at `/api/trpc`
4. The server runs the tRPC procedure defined in `server/routers/*.ts`
5. The procedure calls a service file (e.g., `server/airdna.ts`) or queries the DB directly
6. Result flows back to the frontend

**Key concept:** There are NO REST endpoints. Everything goes through tRPC. The only exceptions are OAuth callbacks and webhook endpoints.

---

## 3. Every Folder and What It Does

| Folder | What It Is | Safe to Edit? |
|--------|-----------|---------------|
| `client/` | The entire frontend (React app) | YES |
| `client/public/` | Static files served at root (favicon, images) | YES |
| `client/public/images/` | Hero images, backgrounds | YES |
| `client/src/pages/` | One file per page/route | YES |
| `client/src/pages/admin/` | Admin-only pages | YES |
| `client/src/components/` | Reusable UI components | YES |
| `client/src/components/ui/` | shadcn/ui primitives (Button, Card, Dialog, etc.) | CAREFUL — these are from a library |
| `client/src/contexts/` | React context providers (theme, translation, property state) | YES |
| `client/src/hooks/` | Custom React hooks | YES |
| `client/src/utils/` | Utility functions (PDF export) | YES |
| `client/src/lib/` | tRPC client setup | DO NOT EDIT |
| `client/src/_core/` | Auth hook (`useAuth`) | DO NOT EDIT |
| `client/src/data/` | Static data files | YES |
| `server/` | The entire backend | YES (with care) |
| `server/_core/` | Framework plumbing (OAuth, tRPC setup, LLM helpers) | DO NOT EDIT |
| `server/routers/` | tRPC router files (API endpoints) | YES — this is where you add features |
| `drizzle/` | Database schema and migrations | YES — but run `pnpm db:push` after changes |
| `drizzle/migrations/` | Auto-generated migration SQL files | DO NOT EDIT manually |
| `shared/` | Types and constants shared between frontend and backend | YES |
| `shared/_core/` | Framework-level shared types | DO NOT EDIT |
| `docs/` | Documentation files | YES |
| `notes/` | Development notes | YES |
| `research/` | Research files | YES |
| `patches/` | npm package patches | DO NOT EDIT unless you know what you're doing |

---

## 4. Every Backend File and What It Does

### 4A. Server Core Files (DO NOT EDIT)

These files are framework-level. Editing them can break authentication, database connections, or the entire server.

| File | What It Does |
|------|-------------|
| `server/_core/index.ts` | Server entry point. Starts Express, mounts tRPC, starts Vite dev server. |
| `server/_core/context.ts` | Creates tRPC context for each request (injects `ctx.user`, `ctx.req`). |
| `server/_core/trpc.ts` | Defines `publicProcedure`, `protectedProcedure`, `router`. |
| `server/_core/oauth.ts` | Handles Manus OAuth login/callback. |
| `server/_core/cookies.ts` | Session cookie configuration. |
| `server/_core/env.ts` | All environment variables. If you need a new env var, add it here AND in Manus secrets. |
| `server/_core/sdk.ts` | Internal SDK for Manus platform APIs. |
| `server/_core/llm.ts` | `invokeLLM()` helper — calls AI models. Use this for any AI feature. |
| `server/_core/imageGeneration.ts` | `generateImage()` helper. |
| `server/_core/voiceTranscription.ts` | `transcribeAudio()` helper. |
| `server/_core/map.ts` | `makeRequest()` for Google Maps API (geocoding, etc.). |
| `server/_core/notification.ts` | `notifyOwner()` — sends push notifications to you. |
| `server/_core/dataApi.ts` | Manus Data API helpers. |
| `server/_core/vite.ts` | Vite dev server integration. |
| `server/_core/systemRouter.ts` | System-level tRPC routes (health check, notify owner). |

### 4B. Main Router File

| File | What It Does |
|------|-------------|
| `server/routers.ts` | **The master router.** Imports ALL sub-routers and combines them into `appRouter`. Also defines `auth.me`, `auth.logout`, and `usage` procedures. If you create a new router file, you MUST register it here. |

### 4C. Feature Router Files (server/routers/)

Each file defines tRPC procedures (API endpoints) for one feature. These are the files you edit to change backend behavior.

| File | What It Does | Key Procedures |
|------|-------------|----------------|
| `rental.ts` | Core rental analysis — takes an address, calls AirDNA, returns revenue estimate | `analyze`, `getEstimate` |
| `advanced.ts` | Advanced analysis features (AI narrative, deep comps) | `getAdvancedAnalysis` |
| `ai.ts` | AI advisor chat, property Q&A | `chat`, `getAdvisorResponse` |
| `webinar-sms.ts` | **BIGGEST FILE (~3700 lines).** WebinarJam integration, SMS campaigns, Google Calendar invites, cron jobs. | `importRegistrants`, `sendBulkSms`, `sendCalendarInvite`, `saveWebinarSelection`, `saveCronConfig`, `saveCalendarSettings` |
| `webinar-env.ts` | WebinarJam environment/credential management | `getCredentials`, `saveCredentials` |
| `shareable-reports.ts` | Create/view/update shareable report links | `create`, `get`, `updateRevenueOverride` |
| `shared-reports.ts` | Legacy shared reports (older format) | `getSharedReport` |
| `my-reports.ts` | User's saved reports list | `list`, `delete` |
| `export.ts` | PDF and Excel export | `generatePdf`, `generateExcel` |
| `deep-analysis.ts` | Deep property analysis with AI | `startDeepAnalysis` |
| `comp-data.ts` | Comparable property data | `getComps` |
| `bulk-summary.ts` | Bulk property analysis | `analyzeBulk` |
| `listings-by-area.ts` | Zillow/Redfin listings in an area | `getListings` |
| `zillow.ts` | Zillow data fetching | `getProperty`, `searchListings` |
| `redfin.ts` | Redfin data fetching | `getProperty` |
| `rentometer.ts` | Rentometer rent estimates | `getRentEstimate` |
| `market-explorer.ts` | Market-level data browsing | `getMarketData` |
| `market-comparison.ts` | Compare multiple markets side by side | `compareMarkets` |
| `market-discovery.ts` | Discover top US markets | `discoverMarkets` |
| `market-alerts.ts` | Automated market alerts | `createAlert`, `getAlerts` |
| `deal-alerts.ts` | Automated deal scanning agent | `createCriteria`, `getMatches` |
| `favorites.ts` | Saved favorite properties | `add`, `remove`, `list` |
| `favorite-listings.ts` | Saved listings from map view | `save`, `list` |
| `favorite-markets.ts` | Saved favorite markets | `add`, `remove`, `list` |
| `saved-searches.ts` | Saved search history | `save`, `list` |
| `regulation-tracker.ts` | STR regulation lookup by city | `getRegulations` |
| `email-optin.ts` | Email opt-in / lead capture | `submit` |
| `notifications.ts` | In-app notifications | `list`, `markRead` |
| `admin-tracking.ts` | Admin analytics and tracking | `getStats`, `getEvents` |
| `bug-reports.ts` | User bug reports | `submit`, `list` |
| `voice-bug-report.ts` | Voice-recorded bug reports | `submit` |
| `translation.ts` | Multi-language translation | `translate`, `getTranslation` |
| `content-studio.ts` | AI content generation for social media | `generatePost` |
| `lease-reader.ts` | AI lease document analysis | `analyzeLeaseDocument` |
| `behavior-engine.ts` | User behavior tracking for personalization | `trackEvent`, `getProfile` |
| `webhook.ts` | Incoming webhook handlers (Zapier, etc.) | `handleWebhook` |
| `tos.ts` | Terms of service acceptance | `accept`, `getStatus` |

### 4D. Service Files (server/*.ts — NOT in routers/)

These are helper/service files that routers call. They contain the actual business logic.

| File | What It Does |
|------|-------------|
| `airdna.ts` | **LARGEST FILE (~7700 lines).** All AirDNA API calls — market data, property estimates, comps, trends, forecasts. |
| `airdna-hierarchy.ts` | AirDNA market hierarchy (country → state → city → submarket) |
| `airdna-rate-limiter.ts` | Rate limiting for AirDNA API calls |
| `ai-analyzer.ts` | AI-powered property analysis (generates the narrative report) |
| `ai-analyzer-enhanced.ts` | Enhanced version of AI analyzer with more data points |
| `ai-advisor.ts` | AI advisor chatbot logic |
| `ai-advisor-enhanced.ts` | Enhanced AI advisor with market context |
| `ai-fallback.ts` | Fallback when AI calls fail |
| `ai-streaming.ts` | Streaming AI responses |
| `rentometer.ts` | Rentometer API integration (long-term rent estimates) |
| `hasdata.ts` | HasData API — Zillow scraping proxy |
| `hasdata-zillow.ts` | Zillow-specific HasData queries |
| `hasdata-redfin.ts` | Redfin-specific HasData queries |
| `hubspot.ts` | HubSpot CRM integration — create/update contacts, deals |
| `hubspot-email.ts` | HubSpot email sending |
| `google-calendar.ts` | Google Calendar API — send calendar invites, update events |
| `gmail-reminders.ts` | Gmail API — send reminder emails |
| `shareable-reports.ts` | Create/read/update shareable report records in DB |
| `report-generator.ts` | Full report generation (combines all data sources) |
| `deep-analysis.ts` | Deep analysis logic |
| `opportunity-finder.ts` | Opportunity finder (browse Zillow listings with revenue estimates) |
| `market-research.ts` | Market research logic (v1) |
| `market-research-v2.ts` | Market research logic (v2 — current) |
| `market-research-simple.ts` | Simplified market research for quick lookups |
| `regulation-tracker.ts` | STR regulation data fetching and caching |
| `behavior-engine.ts` | User behavior tracking engine |
| `deal-alert-agent.ts` | Automated deal scanning agent |
| `notification-service.ts` | Notification delivery service |
| `sms-email-notifications.ts` | SMS and email notification helpers |
| `newsletter-orchestrator.ts` | Newsletter generation orchestrator |
| `newsletter-content-generator.ts` | AI content for newsletters |
| `newsletter-deal-finder.ts` | Find deals for newsletter |
| `newsletter-email-sender.ts` | Send newsletter emails |
| `newsletter-market-data.ts` | Market data for newsletters |
| `newsletter-router.ts` | Newsletter tRPC router |
| `newsletter-sms.ts` | Newsletter SMS notifications |
| `nurture-sequence-service.ts` | Lead nurture SMS sequences |
| `content-studio.ts` | Content generation service |
| `video-generation.ts` | Video generation service |
| `translation-service.ts` | Translation service |
| `translation-cache-db.ts` | Translation cache in DB |
| `lease-reader.ts` | Lease document AI reader |
| `property-chat.ts` | Property chatbot logic |
| `sop-reports.ts` | Standard operating procedure reports |
| `export-pdf.ts` | PDF export logic |
| `export-excel.ts` | Excel export logic |
| `location-quality.ts` | Location quality scoring |
| `webinar-cache.ts` | WebinarJam data caching |
| `model-router.ts` | AI model selection/routing |
| `llm-provider.ts` | LLM provider abstraction |
| `gemini-provider.ts` | Google Gemini API provider |
| `opus-provider.ts` | Anthropic Claude Opus provider |
| `admin-router.ts` | Admin panel tRPC router |
| `slack-admin-router.ts` | Slack integration for admin |
| `reminder-scheduler.ts` | Webinar reminder scheduling |
| `pro-mode-prompts.ts` | Pro mode AI prompts |
| `progress-tracker.ts` | Analysis progress tracking |
| `request-context.ts` | Request context helpers |
| `cache.ts` | In-memory cache with TTL |
| `rate-limiter.ts` | Rate limiting for user actions |
| `usage-limits.ts` | Usage limit tracking (free tier limits) |
| `api-logger.ts` | API call logging |
| `activity.ts` | User activity tracking |
| `airbnb-scraper.ts` | Airbnb listing scraper |
| `content-data-pipeline.ts` | Content data pipeline |
| `storage.ts` | S3 storage helpers (`storagePut`, `storageGet`) |
| `db.ts` | Database connection and query helpers |

### 4E. Other Backend Files

| File | What It Does |
|------|-------------|
| `server/index.ts` | Re-exports from `_core/index.ts` |
| `server/seed-translations.mjs` | Script to seed translation data |
| `server/test-deal-alert.ts` | Test script for deal alerts |
| `server/fixtures/` | Test fixture data |
| `server/__tests__/` | Integration test directory |

---

## 5. Every Frontend File and What It Does

### 5A. Pages (client/src/pages/)

Each page maps to a URL route defined in `App.tsx`.

| File | Route | What It Does |
|------|-------|-------------|
| `LeadMagnet.tsx` | `/` | **THE MAIN PAGE.** The 7-step property analysis flow. This is where leads enter their address, provide contact info, and see results. ~6000 lines. |
| `MapViewPage.tsx` | `/map` | Interactive map with Zillow/Redfin listings and revenue overlays |
| `MarketAdvisor.tsx` | `/market-advisor` | AI-powered market analysis chat |
| `MarketComparisonPage.tsx` | `/compare-markets` | Side-by-side market comparison |
| `MarketDiscoveryPage.tsx` | `/discover-markets` | Browse top US markets |
| `MyFavoritesPage.tsx` | `/my-favorites` | Saved favorite markets |
| `MyFavorites.tsx` | `/saved-properties` | Saved favorite listings |
| `MarketAlertsPage.tsx` | `/market-alerts` | Market alert subscriptions |
| `SavedItemsPage.tsx` | `/saved-items` | All saved items in one place |
| `SavedRegulations.tsx` | `/saved-regulations` | Saved STR regulations |
| `MyReportsPage.tsx` | `/my-reports` | User's report history |
| `AccountPage.tsx` | `/account` | User account settings |
| `RefundPolicy.tsx` | `/refund-policy` | Refund policy page |
| `Contact.tsx` | `/contact` | Contact page |
| `PrivacyPolicy.tsx` | `/privacy-policy` | Privacy policy |
| `TermsOfService.tsx` | `/terms-of-service` | Terms of service |
| `SharedReportPage.tsx` | `/report/:shareId` | View a shared report (legacy) |
| `SharedComparisonPage.tsx` | `/share/compare/:data` | View a shared market comparison |
| `ShareableReport.tsx` | `/regulation/:shareCode` | View a shared regulation report |
| `ShareableReportViewer.tsx` | `/share/:shareCode` | **View a shared property report.** This is what your clients see when you share a link. |
| `ShareRedirect.tsx` | (redirect logic) | Handles share URL redirects |
| `BugReportPage.tsx` | `/bug/:shareCode` | View a bug report |
| `OpportunityFinder.tsx` | `/opportunity-finder` | Browse Zillow listings with revenue estimates |
| `InvestmentCalculator.tsx` | `/investment-calculator` | Property purchase investment calculator |
| `FullReportGenerator.tsx` | `/full-report` | Generate a full report from an address |
| `DealAlertsPage.tsx` | `/deal-alerts` | Automated deal scanning |
| `MarketEvaluationPage.tsx` | `/evaluate-market` | One-click market evaluation |
| `PropertyAnalyzer.tsx` | `/full-analysis` | Full property analysis page |
| `DeepAnalysis.tsx` | `/deep-analysis/:reportId` | Deep AI analysis of a property |
| `WebinarCampaignManager.tsx` | `/webinar-campaigns` | **Admin: WebinarJam SMS campaigns, calendar invites, sequences** |
| `WebinarSmsTab.tsx` | (tab component) | SMS tab within webinar manager |
| `WebinarEnvTab.tsx` | (tab component) | Environment/credentials tab |
| `ContentStudioPage.tsx` | (admin) | AI content generation studio |
| `UnifiedAdmin.tsx` | `/admin/dashboard` | **Admin: Unified admin dashboard** |
| `AdminViewReport.tsx` | `/admin/report/:id` | Admin: View a specific report |
| `AdminUsers.tsx` | (admin) | Admin: User management |
| `ApiUsage.tsx` | (admin) | Admin: API usage dashboard |
| `NotificationAnalytics.tsx` | (admin) | Admin: Notification analytics |
| `ComponentShowcase.tsx` | (dev) | Component showcase for development |
| `NotFound.tsx` | `/404` | 404 page |
| `admin/NewsletterDashboard.tsx` | (admin) | Admin: Newsletter management |

### 5B. Key Components (client/src/components/)

| Component | What It Does |
|-----------|-------------|
| `TeslaDashboard.tsx` | **THE RESULTS DASHBOARD.** Shows projected revenue, comps, charts, profit projections. Has the revenue override feature. Used in both the main flow and shared reports. |
| `StartWithProperty.tsx` | Step 1-4 of the lead magnet flow (address input, property details) |
| `UniversalShareButton.tsx` | Creates shareable report links. Passes `revenueOverride` to the share. |
| `FullPropertyReport.tsx` | Complete property report with all sections |
| `GooglePlacesAutocomplete.tsx` | Address autocomplete using Google Places API |
| `AddressAutocomplete.tsx` | Alternative address autocomplete |
| `SmartAddressInput.tsx` | Smart address input with validation |
| `Map.tsx` | Google Maps integration component |
| `MapViewContent.tsx` | Map view with listings overlay |
| `MapFirstLayoutV2.tsx` | Map-first layout for property browsing |
| `CompsMapView.tsx` | Map showing comparable properties |
| `CompDataTable.tsx` | Table of comparable property data |
| `RevenueCharts.tsx` | Revenue projection charts |
| `HistoricalCharts.tsx` | Historical trend charts |
| `MultiYearTrends.tsx` | Multi-year trend visualization |
| `ForwardDemandCard.tsx` | Forward demand metrics card |
| `EnhancedInsights.tsx` | Enhanced AI insights display |
| `RentometerSection.tsx` | Rentometer data display |
| `STRvsLTRComparison.tsx` | Short-term vs long-term rental comparison |
| `LoanCalculator.tsx` | Mortgage/loan calculator |
| `BreakEvenCalculator.tsx` | Break-even analysis calculator |
| `AmortizationSchedule.tsx` | Loan amortization schedule |
| `MaxPurchasePriceCalculator.tsx` | Maximum purchase price calculator |
| `OfferPriceSuggester.tsx` | AI offer price suggestion |
| `AIAdvisorStep.tsx` | AI advisor chat step |
| `ContextualAIChat.tsx` | Contextual AI chat component |
| `PropertyChatBot.tsx` | Property-specific chatbot |
| `StandaloneMarketAdvisor.tsx` | Standalone market advisor |
| `OpportunityFinderStep.tsx` | Opportunity finder step in flow |
| `RegulationTrackerStep.tsx` | Regulation tracker step |
| `LeaseReaderStep.tsx` | Lease reader step |
| `SubmarketExplorer.tsx` | Submarket browsing component |
| `MarketInsightsPanel.tsx` | Market insights side panel |
| `MarketComparison.tsx` | Market comparison component |
| `HierarchicalLocationSelector.tsx` | Location picker (country → state → city) |
| `CityAutocomplete.tsx` | City autocomplete input |
| `MarketAutocomplete.tsx` | Market autocomplete input |
| `DashboardLayout.tsx` | Admin dashboard sidebar layout |
| `AuthButton.tsx` | Login/logout button |
| `LoginGate.tsx` | Requires login to view content |
| `TermsAcceptanceModal.tsx` | Terms of service acceptance modal |
| `NotificationBell.tsx` | Notification bell icon with count |
| `BugReportButton.tsx` | Bug report floating button |
| `VoiceBugReportButton.tsx` | Voice bug report button |
| `GlobalAutoTranslator.tsx` | Auto-translation wrapper |
| `GlobalLanguageSelector.tsx` | Language picker |
| `LanguageSelector.tsx` | Language selector component |
| `TranslatableText.tsx` | Text that can be translated |
| `TranslatePageBanner.tsx` | Banner offering page translation |
| `ReportTranslateButton.tsx` | Translate report button |
| `ShareReportButton.tsx` | Share report button |
| `SharePageButton.tsx` | Share page button |
| `ShareToolButton.tsx` | Share tool button |
| `SendToSlack.tsx` | Send report to Slack |
| `SendToSlackModal.tsx` | Slack send modal |
| `BuildFullReportButton.tsx` | Generate full report button |
| `SavedSearches.tsx` | Saved searches list |
| `SavedItemsPanel.tsx` | Saved items panel |
| `CompareFavoritesSection.tsx` | Compare favorite properties |
| `ComparisonDashboard.tsx` | Comparison dashboard |
| `SaveLoginPrompt.tsx` | Prompt to save/login |
| `PropertyCard.tsx` | Property listing card |
| `ImageCarousel.tsx` | Image carousel |
| `StreetViewPanorama.tsx` | Google Street View |
| `EbookViewer.tsx` | E-book viewer |
| `InlineEbook.tsx` | Inline e-book display |
| `InteractiveTour.tsx` | Interactive product tour |
| `OnboardingTour.tsx` | New user onboarding |
| `TourSpotlight.tsx` | Tour spotlight overlay |
| `TypeformOverlay.tsx` | Typeform survey overlay |
| `SEOHead.tsx` | SEO meta tags |
| `ReportDisclaimer.tsx` | Report disclaimer text |
| `TrustBanner.tsx` | Trust/credibility banner |
| `DataScopeIndicator.tsx` | Data scope indicator |
| `UpgradeBanner.tsx` | Upgrade prompt banner |
| `UsageLimitBadge.tsx` | Usage limit indicator |
| `MockModeBadge.tsx` | Mock mode indicator (dev) |
| `ReportModeToggle.tsx` | Toggle between report modes |
| `ReportModeOnboarding.tsx` | Report mode onboarding |
| `AnalysisProgress.tsx` | Analysis progress indicator |
| `LoadingProgress.tsx` | Loading progress bar |
| `NarrativeSkeleton.tsx` | Loading skeleton for narrative |
| `PullToRefreshIndicator.tsx` | Pull-to-refresh on mobile |
| `ScrollToTopButton.tsx` | Scroll to top button |
| `BackToPropertyButton.tsx` | Back to property button |
| `PageTracker.tsx` | Page view tracking |
| `ErrorBoundary.tsx` | React error boundary |
| `StepErrorBoundary.tsx` | Step-level error boundary |
| `InfoTooltip.tsx` | Info tooltip component |
| `HelpSection.tsx` | Help section |
| `LightMarkdown.tsx` | Lightweight markdown renderer |
| `ExportListings.tsx` | Export listings to file |
| `ChapterMarketReport.tsx` | Chapter-style market report |
| `ChapterPropertyReport.tsx` | Chapter-style property report |
| `SharedAIAdvisorDisplay.tsx` | Shared AI advisor display |
| `SharedMarketReport.tsx` | Shared market report display |
| `SharedRegulationDisplay.tsx` | Shared regulation display |
| `ManusDialog.tsx` | Manus-branded dialog |
| `AIChatBox.tsx` | AI chat interface (pre-built) |

### 5C. Hooks (client/src/hooks/)

| Hook | What It Does |
|------|-------------|
| `useAnalysisProgress.ts` | Tracks multi-step analysis progress |
| `useComposition.ts` | Composition/layout helpers |
| `useMobile.tsx` | Detects mobile viewport |
| `usePersistFn.ts` | Persists function reference across renders |
| `useSavedItems.ts` | Manages saved items state |
| `useStreamingChat.ts` | Handles streaming AI chat responses |
| `useStreamingReport.ts` | Handles streaming report generation |
| `useSwipeGesture.ts` | Mobile swipe gesture detection |
| `useToolTracking.ts` | Tool usage analytics tracking |

### 5D. Contexts (client/src/contexts/)

| Context | What It Does |
|---------|-------------|
| `PropertyContext.tsx` | Global property state (current address, analysis results, step progress) |
| `ReportModeContext.tsx` | Report mode state (guided vs pro) |
| `ThemeContext.tsx` | Dark/light theme state |
| `ToastContext.tsx` | Toast notification state |
| `TranslationContext.tsx` | Translation/language state |

### 5E. Core Frontend Files

| File | What It Does | Safe to Edit? |
|------|-------------|---------------|
| `client/src/App.tsx` | Route definitions and layout. Add new routes here. | YES |
| `client/src/main.tsx` | React app bootstrap, tRPC client setup, QueryClient | DO NOT EDIT |
| `client/src/index.css` | Global CSS, Tailwind theme, CSS variables | YES — for theming |
| `client/src/const.ts` | Frontend constants (login URL, etc.) | YES |
| `client/src/lib/trpc.ts` | tRPC client type binding | DO NOT EDIT |
| `client/src/_core/hooks/useAuth.ts` | Auth hook (`useAuth()`) | DO NOT EDIT |

---

## 6. Database Tables

The database schema is defined in `drizzle/schema.ts`. There are **56 tables**. Here are the most important ones grouped by feature:

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (from Manus OAuth). Has `role` field (admin/user). |
| `leads` | Lead capture data (name, email, phone, address, status) |
| `analysisReports` | All property analysis results |
| `savedSearches` | User's saved market/property searches |
| `favoriteProperties` | User's saved favorite properties |
| `favoriteListings` | Saved Zillow/Redfin listings |
| `favoriteMarkets` | Saved favorite markets |

### Sharing Tables

| Table | Purpose |
|-------|---------|
| `universalShareableReports` | Shareable report links (the `/share/:code` URLs). Has `revenueOverride` column. |
| `sharedReports` | Legacy shared reports |
| `shareableRegulationReports` | Shared regulation reports |
| `personalizedLinks` | Personalized tracking links |
| `linkClicks` | Click tracking for personalized links |

### WebinarJam / SMS Tables

| Table | Purpose |
|-------|---------|
| `webinarRegistrants` | Imported WebinarJam registrants (name, email, phone, attended, calendarInviteSent) |
| `webinarSmsTemplates` | SMS message templates |
| `webinarSmsCampaigns` | SMS campaign records |
| `webinarSmsDeliveries` | Individual SMS delivery records |
| `webinarSmsSettings` | Key-value settings (selected webinar, cron config, calendar settings) |
| `scheduledSmsMessages` | Scheduled SMS messages (sequences) |
| `webinarCredentials` | WebinarJam API credentials per webinar |
| `webinarTranscripts` | Webinar transcript storage |
| `webinarSettings` | General webinar settings |
| `webinarReminderSchedule` | Reminder scheduling |
| `emailSendLog` | Email send tracking |

### Other Tables

| Table | Purpose |
|-------|---------|
| `emailOptins` | Email opt-in records |
| `notifications` | In-app notifications |
| `ownerNotificationLog` | Owner notification history |
| `bugReports` | User bug reports |
| `toolUsageEvents` | Tool usage analytics |
| `marketAlerts` | Market alert subscriptions |
| `dealAlertCriteria` | Deal alert search criteria |
| `dealAlertMatches` | Deal alert matches found |
| `marketEvaluations` | Market evaluation results |
| `regulationCache` | Cached STR regulations |
| `savedRegulations` | User-saved regulations |
| `regulationComments` | Comments on regulations |
| `commentVotes` | Votes on comments |
| `aiConversations` | AI chat conversation records |
| `aiMessages` | Individual AI chat messages |
| `aiAdvisorCache` | Cached AI advisor responses |
| `newsletterCities` | Newsletter city list |
| `newsletterDeals` | Newsletter deal data |
| `newsletterSends` | Newsletter send records |
| `newsletterPreferences` | User newsletter preferences |
| `newsletterJobs` | Newsletter generation jobs |
| `apiCallLogs` | API call logging |
| `apiCache` | API response cache |
| `apiUsageSummary` | API usage summaries |
| `userUsage` | User usage tracking (free tier) |
| `usageLimitsConfig` | Usage limit configuration |
| `promotions` | Promotion campaigns |
| `promotionRecipients` | Promotion recipients |
| `notificationAnalytics` | Notification analytics |
| `slackReportDeliveries` | Slack report delivery records |
| `translationCache` | Translation cache |
| `contentScripts` | Content studio scripts |
| `videoJobs` | Video generation jobs |
| `tosAcceptances` | Terms of service acceptances |

---

## 7. External API Integrations

| Service | Env Variable | What It Does | Files |
|---------|-------------|-------------|-------|
| **AirDNA** | `AIRDNA_API_KEY` | Property revenue estimates, market data, comps, trends | `server/airdna.ts` |
| **Rentometer** | `RENTOMETER_API_KEY` | Long-term rent estimates | `server/rentometer.ts` |
| **HasData** | `HASDATA_API_KEY` | Zillow/Redfin scraping proxy | `server/hasdata.ts`, `hasdata-zillow.ts`, `hasdata-redfin.ts` |
| **HubSpot** | `HUBSPOT_API_KEY` | CRM — create contacts, track deals | `server/hubspot.ts`, `hubspot-email.ts` |
| **SimpleTexting** | `SIMPLETEXTING_API_KEY` | SMS sending | `server/routers/webinar-sms.ts` |
| **WebinarJam** | `WEBINARJAM_API_KEY` | Webinar registrant import | `server/routers/webinar-sms.ts` |
| **Google Calendar** | `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` | Calendar invites | `server/google-calendar.ts` |
| **Gmail** | (same service account) | Reminder emails | `server/gmail-reminders.ts` |
| **Google Maps** | `VITE_GOOGLE_PLACES_API_KEY` | Address autocomplete, geocoding, maps | `server/_core/map.ts`, `client/src/components/Map.tsx` |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | AI analysis, chat | `server/llm-provider.ts` |
| **Google Gemini** | `GEMINI_API_KEY` | AI analysis (alternative) | `server/gemini-provider.ts` |
| **Zapier** | `ZAPIER_WEBHOOK_URL` | Webhook automation | `server/routers/webhook.ts` |
| **Golpo AI** | (via env) | Video generation | `server/video-generation.ts` |
| **Manus LLM** | `BUILT_IN_FORGE_API_KEY` | Built-in AI (default) | `server/_core/llm.ts` |

---

## 8. Background Jobs (Crons)

These run automatically when the server starts. They are defined in `server/routers/webinar-sms.ts`.

| Job | Interval | What It Does |
|-----|----------|-------------|
| **WebinarJam Import Cron** | Configurable (default 30 min) | Fetches new registrants from WebinarJam API, inserts into `webinarRegistrants` table, auto-sends calendar invites to new registrants with email addresses |
| **SMS Dispatcher** | Every 30 seconds | Checks `scheduledSmsMessages` table for messages due to send, processes them one at a time (with mutex to prevent duplicates), sends via SimpleTexting |

Other background processes (not crons, but periodic cleanup):

| Process | File | What It Does |
|---------|------|-------------|
| AirDNA rate limiter cleanup | `server/airdna-rate-limiter.ts` | Cleans up expired rate limit entries |
| API logger flush | `server/api-logger.ts` | Flushes API call logs to DB |
| Cache cleanup | `server/cache.ts` | Evicts expired cache entries |
| Rate limiter cleanup | `server/rate-limiter.ts` | Cleans up expired rate limit entries |

---

## 9. Environment Variables

These are set in Manus Secrets (Settings → Secrets in the Management UI). Do NOT hardcode them.

| Variable | What It's For |
|----------|-------------|
| `AIRDNA_API_KEY` | AirDNA property/market data |
| `ANTHROPIC_API_KEY` | Claude AI |
| `GEMINI_API_KEY` | Google Gemini AI |
| `HASDATA_API_KEY` | Zillow/Redfin scraping |
| `RENTOMETER_API_KEY` | Rent estimates |
| `SIMPLETEXTING_API_KEY` | SMS sending |
| `WEBINARJAM_API_KEY` | WebinarJam API |
| `HUBSPOT_API_KEY` | HubSpot CRM |
| `ZAPIER_WEBHOOK_URL` | Zapier automation |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` | Google Calendar service account |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Email to impersonate for calendar |
| `VITE_GOOGLE_PLACES_API_KEY` | Google Maps (frontend) |
| `JWT_SECRET` | Session cookie signing |
| `DATABASE_URL` | MySQL/TiDB connection |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in AI |
| `BUILT_IN_FORGE_API_URL` | Manus API URL |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus API (frontend) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus API URL (frontend) |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth server |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal |
| `OWNER_OPEN_ID` | Owner's Manus user ID |
| `OWNER_NAME` | Owner's display name |
| `VITE_APP_TITLE` | App title |
| `VITE_APP_LOGO` | App logo URL |
| `FORCE_CRON` | Force cron jobs to run (even in dev) |

---

## 10. How tRPC Works (The API Layer)

**tRPC replaces REST APIs.** Instead of `GET /api/reports` and `POST /api/reports`, you define typed procedures.

### Backend (defining a procedure)

In `server/routers/some-feature.ts`:
```typescript
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const myRouter = router({
  // Public — anyone can call this
  getStuff: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      // input.id is typed as number
      // ctx.user is null or the logged-in user
      return { data: "hello" };
    }),

  // Protected — requires login
  doThing: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.user is guaranteed to exist
      return { success: true };
    }),
});
```

Then register it in `server/routers.ts`:
```typescript
import { myRouter } from "./routers/my-feature";

export const appRouter = router({
  // ... existing routers
  myFeature: myRouter,
});
```

### Frontend (calling a procedure)

```typescript
// Query (GET-like, auto-fetches)
const { data, isLoading } = trpc.myFeature.getStuff.useQuery({ id: 123 });

// Mutation (POST-like, manual trigger)
const mutation = trpc.myFeature.doThing.useMutation();
mutation.mutate({ name: "test" });
```

### Key Rules

1. **Queries** are for reading data. They auto-fetch and cache.
2. **Mutations** are for writing data. You call `.mutate()` manually.
3. **Input validation** uses Zod schemas. If the input doesn't match, tRPC returns an error.
4. **`publicProcedure`** = anyone can call. **`protectedProcedure`** = must be logged in.
5. **`ctx.user`** gives you the current user (id, email, role, openId).

---

## 11. Safe Editing Rules

### Files You Can Freely Edit

- Any file in `client/src/pages/` — these are page components
- Any file in `client/src/components/` (except `ui/` — be careful there)
- Any file in `server/routers/` — these are API endpoints
- Any service file in `server/*.ts` (not in `_core/`)
- `drizzle/schema.ts` — but run `pnpm db:push` after
- `client/src/App.tsx` — for adding routes
- `client/src/index.css` — for theming
- `shared/const.ts` — for shared constants
- `shared/types.ts` — for shared types
- `todo.md` — task tracking

### Files You Must NEVER Edit

- Anything in `server/_core/` — this is framework plumbing
- Anything in `shared/_core/` — framework types
- `client/src/main.tsx` — tRPC/React bootstrap
- `client/src/lib/trpc.ts` — tRPC client binding
- `client/src/_core/` — auth hook
- `drizzle/migrations/` — auto-generated
- `vite.config.ts` — build config (unless you really know what you're doing)
- `tsconfig.json` — TypeScript config
- `vitest.config.ts` — test config

### Rules for Making Changes

1. **Always edit the schema FIRST.** If your feature needs a new table or column, add it to `drizzle/schema.ts` and run `pnpm db:push`.
2. **Then write the backend.** Add/edit procedures in `server/routers/*.ts`.
3. **Then write the frontend.** Add/edit pages in `client/src/pages/*.tsx`.
4. **Register new routes.** If you made a new page, add the route in `client/src/App.tsx`.
5. **Register new routers.** If you made a new router file, import it in `server/routers/index.ts` AND wire it in `server/routers.ts`.

---

## 12. How to Push Changes Without Breaking Anything

### If You're Editing in Google AI Studio / Anti-Gravity

1. **Clone the repo** from the GitHub remote
2. **Make your changes** to the files listed in "Safe to Edit" above
3. **Push to the `main` branch** on GitHub
4. **Go to Manus** and tell it to sync from GitHub (or it auto-syncs on checkpoint)

### What Happens When You Push to GitHub

- Manus pulls from `main` on every `webdev_save_checkpoint`
- If there's a conflict, Manus will show the conflict and ask how to resolve
- Your changes on GitHub take priority if there's no conflict

### Testing Your Changes

Before pushing, make sure:
1. **No TypeScript errors:** Run `npx tsc --noEmit` locally
2. **Tests pass:** Run `npx vitest run` (or at least the tests for files you changed)
3. **No import errors:** If you added a new file, make sure it's imported correctly

### Database Changes

If you changed `drizzle/schema.ts`:
1. Push your code to GitHub
2. Tell Manus to run `pnpm db:push`
3. Manus will generate and run the migration

**NEVER** delete columns or tables without checking if they're used. Always ADD, never REMOVE.

---

## 13. Common Bugs and How to Fix Them

### "Rate Limit" errors on calendar invites
**Cause:** Google Calendar API has a 60 requests/minute limit. The code now has 1500ms delays + exponential backoff. If you see this, the backoff should handle it automatically.

### Shared link shows wrong revenue
**Cause:** The `revenueOverride` wasn't being saved to the DB when creating shares. Fixed — now passes explicitly to the create mutation AND auto-syncs via useEffect.

### Cron importing 0 registrants
**Cause:** Wrong `schedule_id` stored in settings. The code now has a fallback — if schedule_id returns 0, it retries without schedule_id.

### SMS sending twice
**Cause:** Race condition in SMS dispatcher startup. Fixed — startup recovery now awaits before first dispatch, and there's a mutex preventing concurrent runs.

### Calendar invite shows wrong time
**Cause:** `new Date()` parsed schedule time as UTC, and `.toISOString()` appended `Z` suffix. Fixed — now passes raw date strings without `Z` so Google respects the timezone field.

### TypeScript memory crash (TSC)
**Cause:** The project is very large. The build script already has `NODE_OPTIONS='--max-old-space-size=2048'`. If TSC crashes, it's a memory issue, not a code issue.

---

## Quick Reference: Adding a New Feature

1. **Schema:** Add table to `drizzle/schema.ts` → run `pnpm db:push`
2. **Backend:** Create `server/routers/my-feature.ts` with tRPC procedures
3. **Register:** Export from `server/routers/index.ts`, wire in `server/routers.ts`
4. **Frontend:** Create `client/src/pages/MyFeature.tsx`
5. **Route:** Add `<Route path="/my-feature" component={MyFeature} />` in `App.tsx`
6. **Test:** Add `server/my-feature.test.ts` with vitest tests
7. **Todo:** Add to `todo.md`
