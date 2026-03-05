import { int, tinyint, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Report mode preference: 'pro' for investor-grade language, 'guided' for beginner-friendly */
  reportMode: mysqlEnum("reportMode", ["pro", "guided"]),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_role_idx").on(table.role),
  index("users_created_at_idx").on(table.createdAt),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table for storing rental calculator inquiries
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  
  // Contact information
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  
  // Property information
  address: text("address").notNull(),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  accommodates: int("accommodates"),
  zillowUrl: text("zillowUrl"),
  
  // Estimate results (stored for reference)
  annualRevenue: int("annualRevenue"),
  averageDailyRate: int("averageDailyRate"),
  occupancyRate: decimal("occupancyRate", { precision: 5, scale: 2 }),
  
  // Market information
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Status tracking
  status: mysqlEnum("status", ["new", "contacted", "qualified", "converted", "closed"]).default("new").notNull(),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("leads_email_idx").on(table.email),
  index("leads_status_idx").on(table.status),
  index("leads_created_at_idx").on(table.createdAt),
]);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Saved searches table for storing user's favorite markets and properties
 */
export const savedSearches = mysqlTable("saved_searches", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous saves via cookie)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Search type: 'market' for market analysis, 'property' for property estimates
  searchType: mysqlEnum("searchType", ["market", "property"]).notNull(),
  
  // For market searches
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  submarketId: varchar("submarketId", { length: 64 }),
  submarketName: varchar("submarketName", { length: 255 }),
  
  // For property searches
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  
  // Cached results (to show in saved list without re-fetching)
  cachedRevenue: int("cachedRevenue"),
  cachedOccupancy: decimal("cachedOccupancy", { precision: 5, scale: 2 }),
  cachedAdr: int("cachedAdr"),
  
  // User-defined label/notes
  label: varchar("label", { length: 255 }),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("saved_searches_user_id_idx").on(table.userId),
  index("saved_searches_session_id_idx").on(table.sessionId),
  index("saved_searches_search_type_idx").on(table.searchType),
]);

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;

/**
 * Favorite properties table for storing properties users want to track
 */
export const favoriteProperties = mysqlTable("favorite_properties", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous saves via cookie)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Property information
  address: text("address").notNull(),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  zillowUrl: text("zillowUrl"), // URL to the Zillow listing
  imageUrl: text("imageUrl"), // Property thumbnail image URL
  
  // Property details
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  propertyType: varchar("propertyType", { length: 100 }),
  
  // Market information
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Cached analysis results
  annualRevenue: int("annualRevenue"),
  monthlyRevenue: int("monthlyRevenue"),
  occupancyRate: decimal("occupancyRate", { precision: 5, scale: 2 }),
  averageDailyRate: int("averageDailyRate"),
  
  // User input for arbitrage calculation
  monthlyRent: int("monthlyRent"),
  estimatedProfit: int("estimatedProfit"),
  
  // Purchase price for For Sale properties
  purchasePrice: int("purchasePrice"),
  
  // User notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("fav_props_user_id_idx").on(table.userId),
  index("fav_props_session_id_idx").on(table.sessionId),
  index("fav_props_market_id_idx").on(table.marketId),
]);

export type FavoriteProperty = typeof favoriteProperties.$inferSelect;
export type InsertFavoriteProperty = typeof favoriteProperties.$inferInsert;


/**
 * Analysis reports table for storing complete property analysis results
 * This allows admins to view all reports generated by users
 */
export const analysisReports = mysqlTable("analysis_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Property information
  address: text("address").notNull(),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // Property details
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  monthlyRent: int("monthlyRent"),
  
  // Market information
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Analysis results - key metrics
  annualRevenueConservative: int("annualRevenueConservative"),
  annualRevenueRealistic: int("annualRevenueRealistic"),
  annualRevenueOptimistic: int("annualRevenueOptimistic"),
  occupancyRate: decimal("occupancyRate", { precision: 5, scale: 2 }),
  averageDailyRate: int("averageDailyRate"),
  revpar: int("revpar"),
  
  // Profitability
  annualProfitConservative: int("annualProfitConservative"),
  annualProfitRealistic: int("annualProfitRealistic"),
  annualProfitOptimistic: int("annualProfitOptimistic"),
  breakEvenOccupancy: decimal("breakEvenOccupancy", { precision: 5, scale: 2 }),
  startupCostsMin: int("startupCostsMin"),
  startupCostsMax: int("startupCostsMax"),
  
  // AI verdict
  verdict: varchar("verdict", { length: 50 }), // GO, CAUTION, NO-GO
  confidenceScore: int("confidenceScore"),
  
  // Full analysis data (JSON blob for complete report)
  fullAnalysisData: json("fullAnalysisData"),
  
  // AI narrative report (JSON blob)
  narrativeReport: json("narrativeReport"),
  
  // Competitor data (JSON blob)
  competitorData: json("competitorData"),
  
  // Lead capture information
  leadName: varchar("leadName", { length: 255 }),
  leadEmail: varchar("leadEmail", { length: 320 }),
  leadPhone: varchar("leadPhone", { length: 50 }),
  
  // User tracking (optional)
  userIp: varchar("userIp", { length: 45 }),
  userAgent: text("userAgent"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("analysis_reports_session_id_idx").on(table.sessionId),
  index("analysis_reports_market_id_idx").on(table.marketId),
  index("analysis_reports_created_at_idx").on(table.createdAt),
]);

export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = typeof analysisReports.$inferInsert;


/**
 * Deep Analysis table for storing AI-heavy analysis results
 * This is separate from the main analysis to allow async generation
 */
export const deepAnalysis = mysqlTable("deep_analysis", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link to main analysis report
  reportId: int("reportId").notNull(),
  
  // Status tracking
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  currentStep: varchar("currentStep", { length: 100 }), // Current section being generated
  completedSteps: json("completedSteps"), // Array of completed step names
  errorMessage: text("errorMessage"),
  
  // AI-generated content
  historicalContext: json("historicalContext"), // 5-year market trends with AI interpretation
  investmentThesis: json("investmentThesis"), // Full investment thesis
  riskNarrative: json("riskNarrative"), // Detailed risk assessment
  pricingStrategy: json("pricingStrategy"), // Pricing recommendations
  competitorPhotoAnalysis: json("competitorPhotoAnalysis"), // Photo analysis of competitors
  executiveSummaryEnhanced: text("executiveSummaryEnhanced"), // Enhanced AI executive summary
  marketNarrative: text("marketNarrative"), // Full market narrative
  actionPlan: json("actionPlan"), // Detailed action plan
  
  // Processing metadata
  processingTimeMs: int("processingTimeMs"),
  aiProvider: varchar("aiProvider", { length: 50 }), // Which AI provider was used
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("deep_analysis_report_id_idx").on(table.reportId),
  index("deep_analysis_status_idx").on(table.status),
]);

export type DeepAnalysis = typeof deepAnalysis.$inferSelect;
export type InsertDeepAnalysis = typeof deepAnalysis.$inferInsert;


/**
 * Browser Use settings table for storing persistent configuration
 * This includes profile IDs and authentication state that should survive server restarts
 */
export const browserUseSettings = mysqlTable("browser_use_settings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Setting key (e.g., 'coachinayah_profile_id', 'coachinayah_auth_status')
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  
  // Setting value (stored as string, can be JSON for complex values)
  settingValue: text("settingValue").notNull(),
  
  // Expiration time (optional, for time-limited settings like auth status)
  expiresAt: timestamp("expiresAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrowserUseSetting = typeof browserUseSettings.$inferSelect;
export type InsertBrowserUseSetting = typeof browserUseSettings.$inferInsert;


/**
 * Market Research Reports table for storing comprehensive market analysis
 * Generated by Browser Use automation scraping coachinayah.com
 */
export const marketResearchReports = mysqlTable("market_research_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Research identifier
  researchId: varchar("researchId", { length: 100 }).notNull().unique(),
  
  // Market information
  market: varchar("market", { length: 255 }).notNull(),
  
  // Status tracking
  status: mysqlEnum("status", ["pending", "running", "completed", "error"]).default("pending").notNull(),
  progress: int("progress").default(0),
  currentStep: varchar("currentStep", { length: 255 }),
  errorMessage: text("errorMessage"),
  
  // Browser Use task tracking
  sessionId: varchar("sessionId", { length: 100 }),
  taskId: varchar("taskId", { length: 100 }),
  
  // Full research result (JSON blob)
  result: json("result"),
  
  // User tracking (optional)
  userId: int("userId"),
  sessionToken: varchar("sessionToken", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("market_research_status_idx").on(table.status),
  index("market_research_user_id_idx").on(table.userId),
  index("market_research_created_at_idx").on(table.createdAt),
]);

export type MarketResearchReport = typeof marketResearchReports.$inferSelect;
export type InsertMarketResearchReport = typeof marketResearchReports.$inferInsert;


// NOTE: opportunitySearches table removed (deprecated, unused) — Feb 2026


/**
 * Activity Logs table for tracking user actions
 * Used by admin portal to monitor user behavior and usage patterns
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous users)
  userId: int("userId"),
  
  // Session tracking for anonymous users
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Action details
  action: varchar("action", { length: 100 }).notNull(), // e.g., 'market_search', 'property_analysis', 'report_generated'
  actionCategory: varchar("actionCategory", { length: 50 }).notNull(), // e.g., 'search', 'analysis', 'navigation', 'auth'
  
  // Additional context (JSON blob for flexible data)
  details: json("details"), // e.g., { marketId: 'xxx', bedrooms: 3, etc. }
  
  // Request metadata
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  referrer: text("referrer"),
  
  // Page/route information
  pagePath: varchar("pagePath", { length: 255 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("activity_logs_user_id_idx").on(table.userId),
  index("activity_logs_session_id_idx").on(table.sessionId),
  index("activity_logs_action_idx").on(table.action),
  index("activity_logs_created_at_idx").on(table.createdAt),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * User Sessions table for tracking active sessions
 * Helps understand user engagement and session duration
 */
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous users)
  userId: int("userId"),
  
  // Session identifier
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  
  // Session metadata
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Location info (derived from IP if available)
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 255 }),
  
  // Session activity
  pageViews: int("pageViews").default(0),
  actionsCount: int("actionsCount").default(0),
  
  // Timestamps
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
}, (table) => [
  index("user_sessions_user_id_idx").on(table.userId),
  index("user_sessions_last_activity_idx").on(table.lastActivityAt),
]);

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;


/**
 * Property images cache table for storing fetched images from AirDNA API
 * This reduces API calls by caching images for properties we've already looked up
 */
export const propertyImages = mysqlTable("property_images", {
  id: int("id").autoincrement().primaryKey(),
  
  // Property identifier (e.g., "abnb_24017637" or "vrbo_12345")
  propertyId: varchar("propertyId", { length: 100 }).notNull().unique(),
  
  // Platform (airbnb, vrbo, etc.)
  platform: varchar("platform", { length: 50 }),
  
  // Array of image URLs stored as JSON
  images: json("images").$type<string[]>().notNull(),
  
  // Number of images (for quick reference without parsing JSON)
  imageCount: int("imageCount").notNull(),
  
  // Cache metadata
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // When this cache entry should be refreshed
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("property_images_platform_idx").on(table.platform),
  index("property_images_expires_at_idx").on(table.expiresAt),
]);

export type PropertyImage = typeof propertyImages.$inferSelect;
export type InsertPropertyImage = typeof propertyImages.$inferInsert;


/**
 * Favorite Markets table for storing user's starred/favorited markets
 * Allows quick access to markets of interest from the Market Discovery page
 */
export const favoriteMarkets = mysqlTable("favorite_markets", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous saves via cookie)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Market information
  marketId: varchar("marketId", { length: 64 }).notNull(),
  marketName: varchar("marketName", { length: 255 }).notNull(),
  marketType: varchar("marketType", { length: 100 }),
  
  // Location info
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  
  // Cached metrics at time of favoriting
  marketScore: decimal("marketScore", { precision: 5, scale: 2 }),
  listingCount: int("listingCount"),
  averageRevenue: int("averageRevenue"),
  averageOccupancy: decimal("averageOccupancy", { precision: 5, scale: 2 }),
  averageAdr: int("averageAdr"),
  
  // User notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("fav_markets_user_id_idx").on(table.userId),
  index("fav_markets_session_id_idx").on(table.sessionId),
  index("fav_markets_market_id_idx").on(table.marketId),
]);

export type FavoriteMarket = typeof favoriteMarkets.$inferSelect;
export type InsertFavoriteMarket = typeof favoriteMarkets.$inferInsert;


/**
 * Market Alerts table for storing email alert subscriptions
 * Users can subscribe to receive notifications when market metrics change significantly
 */
export const marketAlerts = mysqlTable("market_alerts", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous saves via cookie)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Contact information for alerts
  email: varchar("email", { length: 320 }).notNull(),
  
  // Market information
  marketId: varchar("marketId", { length: 64 }).notNull(),
  marketName: varchar("marketName", { length: 255 }).notNull(),
  
  // Alert configuration
  alertType: mysqlEnum("alertType", ["revenue_change", "occupancy_change", "adr_change", "all_changes"]).default("all_changes").notNull(),
  thresholdPercent: int("thresholdPercent").default(10).notNull(), // Minimum % change to trigger alert
  
  // Baseline metrics (to compare against for changes)
  baselineRevenue: int("baselineRevenue"),
  baselineOccupancy: decimal("baselineOccupancy", { precision: 5, scale: 2 }),
  baselineAdr: int("baselineAdr"),
  
  // Alert status
  isActive: mysqlEnum("isActive", ["true", "false"]).default("true").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  lastAlertSentAt: timestamp("lastAlertSentAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("market_alerts_user_id_idx").on(table.userId),
  index("market_alerts_market_id_idx").on(table.marketId),
  index("market_alerts_is_active_idx").on(table.isActive),
]);

export type MarketAlert = typeof marketAlerts.$inferSelect;
export type InsertMarketAlert = typeof marketAlerts.$inferInsert;


/**
 * Shared Reports table for creating shareable links to property/market reports
 * Allows users to share reports with clients or colleagues via unique URLs
 * 
 * NOTE: Schema matches actual database structure
 */
export const sharedReports = mysqlTable("shared_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Unique share ID for URL (e.g., /report/abc123)
  shareId: varchar("shareId", { length: 32 }).notNull().unique(),
  
  // Report type and reference
  reportType: mysqlEnum("reportType", ["property", "market", "full"]).notNull(),
  
  // For property reports
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  accommodates: int("accommodates"),
  
  // For market reports
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  submarketId: varchar("submarketId", { length: 64 }),
  submarketName: varchar("submarketName", { length: 255 }),
  
  // Cached report data (stored as text in actual DB)
  reportData: text("reportData"),
  
  // Creator tracking
  createdByUserId: int("createdByUserId"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  // Access controls
  expiresAt: timestamp("expiresAt"), // Optional expiration
  viewCount: int("viewCount").default(0).notNull(),
  maxViews: int("maxViews"), // Optional view limit
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("shared_reports_user_id_idx").on(table.createdByUserId),
  index("shared_reports_report_type_idx").on(table.reportType),
  index("shared_reports_created_at_idx").on(table.createdAt),
]);

export type SharedReport = typeof sharedReports.$inferSelect;
export type InsertSharedReport = typeof sharedReports.$inferInsert;


/**
 * AI Advisor Cache table for storing generated AI analysis results
 * This allows users to revisit their analysis without regenerating it each time
 * Cache key is based on property address + bedrooms + bathrooms for property advisor
 * Cache key is based on market name + state for market advisor
 */
export const aiAdvisorCache = mysqlTable("ai_advisor_cache", {
  id: int("id").autoincrement().primaryKey(),
  
  // Cache type: 'property' or 'market'
  cacheType: mysqlEnum("cacheType", ["property", "market"]).notNull(),
  
  // Cache key (unique identifier for the analysis)
  // For property: normalized address + bedrooms + bathrooms
  // For market: market name + state
  cacheKey: varchar("cacheKey", { length: 255 }).notNull(),
  
  // Property information (for property advisor)
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  
  // Market information (for market advisor)
  marketName: varchar("marketName", { length: 255 }),
  
  // Input data hash (to detect if input data has changed significantly)
  inputHash: varchar("inputHash", { length: 64 }),
  
  // Cached AI response (the full advice text)
  advice: text("advice").notNull(),
  
  // Metadata
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // Cache expiration (e.g., 7 days)
  hitCount: int("hitCount").default(0).notNull(), // Number of times this cache was used
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("ai_advisor_cache_key_idx").on(table.cacheKey),
  index("ai_advisor_cache_type_idx").on(table.cacheType),
  index("ai_advisor_cache_expires_idx").on(table.expiresAt),
]);

export type AiAdvisorCache = typeof aiAdvisorCache.$inferSelect;
export type InsertAiAdvisorCache = typeof aiAdvisorCache.$inferInsert;


/**
 * Notifications table for storing in-app notifications
 * Supports both user-specific and broadcast notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  
  // Target user (null for broadcast notifications)
  userId: int("userId"),
  
  // Notification type
  type: mysqlEnum("type", ["report_generated", "system", "alert", "info"]).notNull(),
  
  // Notification content
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  
  // Optional metadata (JSON for flexible data like report IDs, links, etc.)
  metadata: json("metadata"),
  
  // Read status
  isRead: int("isRead").default(0).notNull(), // 0 = unread, 1 = read
  readAt: timestamp("readAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_is_read_idx").on(table.isRead),
  index("notifications_created_at_idx").on(table.createdAt),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Owner notification log for tracking emails sent to the owner
 * This helps avoid duplicate notifications and provides audit trail
 */
export const ownerNotificationLog = mysqlTable("owner_notification_log", {
  id: int("id").autoincrement().primaryKey(),
  
  // Notification type
  notificationType: mysqlEnum("notificationType", ["property_report", "market_report", "lead_capture", "system"]).notNull(),
  
  // Report/entity reference
  reportId: int("reportId"),
  
  // Notification content summary
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  
  // User who triggered the notification (if applicable)
  triggeredByIp: varchar("triggeredByIp", { length: 45 }),
  triggeredByUserId: int("triggeredByUserId"),
  
  // Delivery status
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  deliveredAt: timestamp("deliveredAt"),
  errorMessage: text("errorMessage"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OwnerNotificationLog = typeof ownerNotificationLog.$inferSelect;
export type InsertOwnerNotificationLog = typeof ownerNotificationLog.$inferInsert;


/**
 * Favorite Listings table for storing user's favorited listings from the map view
 * This is a lightweight table that just stores the listing ID for quick lookup
 */
export const favoriteListings = mysqlTable("favorite_listings", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous saves via cookie)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Listing identifier from AirDNA (e.g., "abnb_24017637")
  listingId: varchar("listingId", { length: 100 }).notNull(),
  
  // Basic listing info for display without re-fetching
  title: varchar("title", { length: 500 }),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  revenue: int("revenue"),
  occupancy: decimal("occupancy", { precision: 5, scale: 2 }),
  adr: int("adr"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  airbnbUrl: text("airbnbUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  
  // Context - which property search this favorite is associated with
  searchAddress: text("searchAddress"),
  searchSubmarketId: varchar("searchSubmarketId", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("fav_listings_user_id_idx").on(table.userId),
  index("fav_listings_session_id_idx").on(table.sessionId),
  index("fav_listings_listing_id_idx").on(table.listingId),
]);

export type FavoriteListing = typeof favoriteListings.$inferSelect;
export type InsertFavoriteListing = typeof favoriteListings.$inferInsert;


/**
 * Regulation Cache table for storing STR regulation lookup results
 * Caches AI API responses to reduce API calls and improve response time
 * TTL: 7 days (regulations don't change frequently)
 */
export const regulationCache = mysqlTable("regulation_cache", {
  id: int("id").autoincrement().primaryKey(),
  
  // Location key (normalized city + state)
  locationKey: varchar("locationKey", { length: 255 }).notNull().unique(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  
  // Regulation status
  status: varchar("status", { length: 50 }).notNull(), // allowed, allowed_with_permit, restricted, etc.
  
  // Summaries
  yesNoSummary: text("yesNoSummary"),
  summary: text("summary"),
  simplifiedSummary: text("simplifiedSummary"),
  
  // Key requirements (JSON array)
  keyRequirements: json("keyRequirements"),
  
  // Regulation details
  permitRequired: int("permitRequired").default(0), // 0 = false, 1 = true
  primaryResidenceOnly: int("primaryResidenceOnly").default(0),
  maxNightsPerYear: int("maxNightsPerYear"),
  registrationFee: varchar("registrationFee", { length: 100 }),
  occupancyTax: varchar("occupancyTax", { length: 100 }),
  zoningRestrictions: text("zoningRestrictions"),
  
  // Sources (JSON array)
  sources: json("sources"),
  
  // Confidence and warnings
  confidence: varchar("confidence", { length: 20 }),
  warnings: json("warnings"),
  
  // Cache metadata
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("regulation_cache_expires_idx").on(table.expiresAt),
  index("regulation_cache_status_idx").on(table.status),
]);

export type RegulationCacheEntry = typeof regulationCache.$inferSelect;
export type InsertRegulationCache = typeof regulationCache.$inferInsert;


/**
 * Saved Regulations table for storing user's saved regulation searches
 * Allows users to quickly access regulations for cities they're interested in
 */
export const savedRegulations = mysqlTable("saved_regulations", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (required - must be logged in to save)
  userId: int("userId").notNull(),
  
  // Location information
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  locationKey: varchar("locationKey", { length: 255 }).notNull(), // normalized city + state
  
  // Cached regulation summary for quick display
  status: varchar("status", { length: 50 }).notNull(), // allowed, allowed_with_permit, restricted, etc.
  permitRequired: int("permitRequired").default(0), // 0 = false, 1 = true
  primaryResidenceOnly: int("primaryResidenceOnly").default(0),
  registrationFee: varchar("registrationFee", { length: 100 }),
  
  // Official sources (JSON array of {title, url, type})
  sources: json("sources"),
  
  // User notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("saved_regs_user_id_idx").on(table.userId),
  index("saved_regs_location_key_idx").on(table.locationKey),
]);

export type SavedRegulation = typeof savedRegulations.$inferSelect;
export type InsertSavedRegulation = typeof savedRegulations.$inferInsert;


/**
 * Regulation Comments table for community discussion on regulation pages
 * Allows users to share insights and tips about specific city regulations
 */
export const regulationComments = mysqlTable("regulation_comments", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (required - must be logged in to comment)
  userId: int("userId").notNull(),
  
  // Location reference
  locationKey: varchar("locationKey", { length: 255 }).notNull(), // normalized city + state
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  
  // Comment content
  content: text("content").notNull(),
  
  // Voting
  upvotes: int("upvotes").default(0).notNull(),
  downvotes: int("downvotes").default(0).notNull(),
  
  // Moderation
  isApproved: int("isApproved").default(1).notNull(), // 1 = approved, 0 = hidden
  isFlagged: int("isFlagged").default(0).notNull(), // 1 = flagged for review
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("reg_comments_user_id_idx").on(table.userId),
  index("reg_comments_location_key_idx").on(table.locationKey),
]);

export type RegulationComment = typeof regulationComments.$inferSelect;
export type InsertRegulationComment = typeof regulationComments.$inferInsert;


/**
 * Comment Votes table to track which users have voted on which comments
 * Prevents duplicate voting and enables vote toggling
 */
export const commentVotes = mysqlTable("comment_votes", {
  id: int("id").autoincrement().primaryKey(),
  
  // References
  commentId: int("commentId").notNull(),
  userId: int("userId").notNull(),
  
  // Vote type: 1 = upvote, -1 = downvote
  voteType: int("voteType").notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("comment_votes_user_comment_idx").on(table.userId, table.commentId),
]);

export type CommentVote = typeof commentVotes.$inferSelect;
export type InsertCommentVote = typeof commentVotes.$inferInsert;


/**
 * Email Opt-ins table for storing users who want personalized market updates
 * This data syncs to HubSpot via Zapier webhook
 */
export const emailOptins = mysqlTable("email_optins", {
  id: int("id").autoincrement().primaryKey(),
  
  // Contact information
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  
  // Location preferences (for personalized content)
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  
  // Opt-in preferences
  wantsMarketUpdates: int("wantsMarketUpdates").default(1).notNull(), // Daily property emails
  wantsRegulationAlerts: int("wantsRegulationAlerts").default(1).notNull(), // Regulation change alerts
  wantsSmsAlerts: int("wantsSmsAlerts").default(0).notNull(), // SMS via SimpleTexting
  
  // Source tracking
  source: varchar("source", { length: 100 }), // Which tool they opted in from
  utmSource: varchar("utmSource", { length: 100 }),
  utmMedium: varchar("utmMedium", { length: 100 }),
  utmCampaign: varchar("utmCampaign", { length: 100 }),
  
  // HubSpot sync status
  hubspotContactId: varchar("hubspotContactId", { length: 100 }),
  hubspotSyncedAt: timestamp("hubspotSyncedAt"),
  
  // Status
  isActive: int("isActive").default(1).notNull(),
  unsubscribedAt: timestamp("unsubscribedAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("email_optins_email_idx").on(table.email),
  index("email_optins_is_active_idx").on(table.isActive),
  index("email_optins_city_state_idx").on(table.city, table.state),
]);

export type EmailOptin = typeof emailOptins.$inferSelect;
export type InsertEmailOptin = typeof emailOptins.$inferInsert;


/**
 * Personalized Links table for tracking all generated personalized links
 * Used by admin portal to see what links were created for each user
 */
export const personalizedLinks = mysqlTable("personalized_links", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link recipient
  email: varchar("email", { length: 320 }),
  hubspotContactId: varchar("hubspotContactId", { length: 100 }),
  
  // Link details
  linkUrl: text("linkUrl").notNull(),
  shortCode: varchar("shortCode", { length: 20 }), // Optional short code for tracking
  
  // Personalization parameters
  targetCity: varchar("targetCity", { length: 255 }),
  targetState: varchar("targetState", { length: 100 }),
  targetZip: varchar("targetZip", { length: 20 }),
  targetTab: varchar("targetTab", { length: 50 }), // Which tool tab the link opens
  
  // Campaign info
  campaignName: varchar("campaignName", { length: 255 }),
  campaignType: varchar("campaignType", { length: 100 }), // welcome, daily_properties, regulation_alert, etc.
  
  // Tracking metrics
  clickCount: int("clickCount").default(0).notNull(),
  lastClickedAt: timestamp("lastClickedAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("personalized_links_email_idx").on(table.email),
  index("personalized_links_short_code_idx").on(table.shortCode),
  index("personalized_links_campaign_idx").on(table.campaignType),
]);

export type PersonalizedLink = typeof personalizedLinks.$inferSelect;
export type InsertPersonalizedLink = typeof personalizedLinks.$inferInsert;


/**
 * Link Clicks table for detailed click tracking
 * Records every click on a personalized link
 */
export const linkClicks = mysqlTable("link_clicks", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link reference
  linkId: int("linkId").notNull(),
  
  // Click metadata
  clickedAt: timestamp("clickedAt").defaultNow().notNull(),
  userIp: varchar("userIp", { length: 45 }),
  userAgent: text("userAgent"),
  referer: text("referer"),
  
  // Geo data (if available)
  clickCity: varchar("clickCity", { length: 255 }),
  clickState: varchar("clickState", { length: 100 }),
  clickCountry: varchar("clickCountry", { length: 100 }),
}, (table) => [
  index("link_clicks_link_id_idx").on(table.linkId),
]);

export type LinkClick = typeof linkClicks.$inferSelect;
export type InsertLinkClick = typeof linkClicks.$inferInsert;


/**
 * Promotions table for tracking all promotional campaigns sent
 * Admin can see history of all promotions and their performance
 */
export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Campaign details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["email", "sms", "both"]).default("email").notNull(),
  
  // Target audience
  targetCity: varchar("targetCity", { length: 255 }), // null = all cities
  targetState: varchar("targetState", { length: 100 }), // null = all states
  targetSegment: varchar("targetSegment", { length: 100 }), // e.g., "credit_approved", "new_leads"
  
  // Content
  emailSubject: varchar("emailSubject", { length: 255 }),
  emailPreviewText: varchar("emailPreviewText", { length: 255 }),
  smsMessage: text("smsMessage"),
  
  // Personalized link template
  linkTemplate: text("linkTemplate"), // e.g., "/?tab=prove&city={{city}}&state={{state}}"
  
  // Performance metrics
  totalSent: int("totalSent").default(0).notNull(),
  totalOpened: int("totalOpened").default(0).notNull(),
  totalClicked: int("totalClicked").default(0).notNull(),
  totalUnsubscribed: int("totalUnsubscribed").default(0).notNull(),
  
  // Status
  status: mysqlEnum("status", ["draft", "scheduled", "sent", "cancelled"]).default("draft").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  sentAt: timestamp("sentAt"),
  
  // Created by
  createdBy: int("createdBy"), // Admin user ID
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = typeof promotions.$inferInsert;


/**
 * Promotion Recipients table for tracking who received each promotion
 */
export const promotionRecipients = mysqlTable("promotion_recipients", {
  id: int("id").autoincrement().primaryKey(),
  
  // References
  promotionId: int("promotionId").notNull(),
  optinId: int("optinId"), // Reference to emailOptins
  email: varchar("email", { length: 320 }).notNull(),
  
  // Personalized link for this recipient
  personalizedLinkId: int("personalizedLinkId"),
  
  // Delivery status
  emailSentAt: timestamp("emailSentAt"),
  emailOpenedAt: timestamp("emailOpenedAt"),
  smsSentAt: timestamp("smsSentAt"),
  
  // Engagement
  clicked: int("clicked").default(0).notNull(),
  unsubscribed: int("unsubscribed").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("promo_recipients_promo_id_idx").on(table.promotionId),
  index("promo_recipients_email_idx").on(table.email),
]);

export type PromotionRecipient = typeof promotionRecipients.$inferSelect;
export type InsertPromotionRecipient = typeof promotionRecipients.$inferInsert;


/**
 * Tool Usage Events table for tracking how users interact with tools
 * This data is sent to HubSpot via Zapier to update contact properties
 */
export const toolUsageEvents = mysqlTable("tool_usage_events", {
  id: int("id").autoincrement().primaryKey(),
  
  // User identification
  email: varchar("email", { length: 320 }),
  sessionId: varchar("sessionId", { length: 64 }),
  userId: int("userId"),
  
  // Event details
  eventType: varchar("eventType", { length: 100 }).notNull(), // regulation_search, revenue_calc, market_advisor, etc.
  toolName: varchar("toolName", { length: 100 }).notNull(),
  
  // Location searched
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  address: text("address"),
  
  // Results (if applicable)
  revenueEstimate: int("revenueEstimate"),
  regulationStatus: varchar("regulationStatus", { length: 50 }),
  
  // Source tracking
  utmSource: varchar("utmSource", { length: 100 }),
  utmMedium: varchar("utmMedium", { length: 100 }),
  utmCampaign: varchar("utmCampaign", { length: 100 }),
  personalizedLinkId: int("personalizedLinkId"), // If they came from a personalized link
  
  // Webhook sync status
  webhookSentAt: timestamp("webhookSentAt"),
  webhookSuccess: int("webhookSuccess"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("tool_usage_email_idx").on(table.email),
  index("tool_usage_session_id_idx").on(table.sessionId),
  index("tool_usage_user_id_idx").on(table.userId),
  index("tool_usage_event_type_idx").on(table.eventType),
  index("tool_usage_created_at_idx").on(table.createdAt),
  index("tool_usage_city_state_idx").on(table.city, table.state),
]);

export type ToolUsageEvent = typeof toolUsageEvents.$inferSelect;
export type InsertToolUsageEvent = typeof toolUsageEvents.$inferInsert;


/**
 * Bug Reports table for tracking user-reported issues
 * Generates shareable links for easy bug reporting and tracking
 */
export const bugReports = mysqlTable("bug_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Unique shareable ID (short code for URLs)
  shareCode: varchar("shareCode", { length: 20 }).notNull().unique(),
  
  // Reporter information (optional)
  reporterEmail: varchar("reporterEmail", { length: 320 }),
  reporterName: varchar("reporterName", { length: 255 }),
  sessionId: varchar("sessionId", { length: 64 }),
  userId: int("userId"),
  
  // Bug details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  stepsToReproduce: text("stepsToReproduce"),
  expectedBehavior: text("expectedBehavior"),
  actualBehavior: text("actualBehavior"),
  
  // Context - what they were doing
  toolName: varchar("toolName", { length: 100 }), // Step 8, Step 9, etc.
  pagePath: varchar("pagePath", { length: 255 }),
  
  // Property/Market context (if applicable)
  propertyAddress: text("propertyAddress"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  marketId: varchar("marketId", { length: 64 }),
  
  // Technical context
  browserInfo: text("browserInfo"),
  screenSize: varchar("screenSize", { length: 50 }),
  errorMessage: text("errorMessage"),
  consoleErrors: text("consoleErrors"),
  
  // Screenshot (stored as S3 URL)
  screenshotUrl: text("screenshotUrl"),
  
  // Status tracking
  status: mysqlEnum("status", ["new", "investigating", "in_progress", "resolved", "wont_fix", "duplicate"]).default("new").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  
  // Resolution
  resolvedAt: timestamp("resolvedAt"),
  resolution: text("resolution"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("bug_reports_status_idx").on(table.status),
  index("bug_reports_priority_idx").on(table.priority),
]);

export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = typeof bugReports.$inferInsert;


/**
 * Shareable Regulation Reports table for generating unique links to regulation reports
 * When a user completes a regulation check, they can share the results via SMS/email
 */
export const shareableRegulationReports = mysqlTable("shareable_regulation_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Unique shareable code for URLs (e.g., "abc123xyz")
  shareCode: varchar("shareCode", { length: 20 }).notNull().unique(),
  
  // Location information
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  locationKey: varchar("locationKey", { length: 255 }).notNull(),
  
  // Regulation status and summary
  status: varchar("status", { length: 50 }).notNull(), // allowed, allowed_with_permit, restricted, banned
  yesNoSummary: text("yesNoSummary"),
  summary: text("summary"),
  
  // Key details for display
  permitRequired: int("permitRequired").default(0), // 0 = false, 1 = true
  primaryResidenceOnly: int("primaryResidenceOnly").default(0),
  maxNightsPerYear: int("maxNightsPerYear"),
  registrationFee: varchar("registrationFee", { length: 255 }),
  occupancyTax: varchar("occupancyTax", { length: 100 }),
  confidence: varchar("confidence", { length: 20 }),
  
  // Full regulation data (JSON blob)
  fullRegulationData: json("fullRegulationData"),
  
  // Key requirements (JSON array)
  keyRequirements: json("keyRequirements"),
  
  // Sources (JSON array)
  sources: json("sources"),
  
  // Creator information (optional)
  creatorEmail: varchar("creatorEmail", { length: 320 }),
  creatorPhone: varchar("creatorPhone", { length: 50 }),
  creatorUserId: int("creatorUserId"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Sharing tracking
  viewCount: int("viewCount").default(0).notNull(),
  lastViewedAt: timestamp("lastViewedAt"),
  
  // SMS/Email notification tracking
  smsSentTo: varchar("smsSentTo", { length: 50 }),
  smsSentAt: timestamp("smsSentAt"),
  emailSentTo: varchar("emailSentTo", { length: 320 }),
  emailSentAt: timestamp("emailSentAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Optional expiration for temporary links
}, (table) => [
  index("shareable_reg_location_idx").on(table.locationKey),
  index("shareable_reg_creator_idx").on(table.creatorUserId),
  index("shareable_reg_created_at_idx").on(table.createdAt),
]);

export type ShareableRegulationReport = typeof shareableRegulationReports.$inferSelect;
export type InsertShareableRegulationReport = typeof shareableRegulationReports.$inferInsert;



/**
 * Universal Shareable Reports table for creating shareable links to any tool's output
 * This unified table supports all tool types: revenue calculator, property validator,
 * market advisor, AI advisor, etc.
 */
export const universalShareableReports = mysqlTable("universal_shareable_reports", {
  id: int("id").autoincrement().primaryKey(),
  
  // Unique shareable code for URLs (e.g., /share/abc123xyz)
  shareCode: varchar("shareCode", { length: 20 }).notNull().unique(),
  
  // Report type to determine which viewer to use
  reportType: mysqlEnum("reportType", [
    "revenue",      // Revenue Calculator (Step 3)
    "validator",    // Property Validator (Step 5)
    "market",       // Market Advisor (Step 8)
    "ai_advisor",   // AI Advisor (Step 9)
    "listings",     // Explore Listings (Step 4)
    "comparison",   // Compare Favorites (Step 6)
    "map",          // Map View (Step 7)
    "regulation"    // Regulation Tracker (Step 1)
  ]).notNull(),
  
  // Property information (for property-based reports)
  address: text("address"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zipCode", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  monthlyRent: int("monthlyRent"),
  
  // Market information (for market-based reports)
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Full report data (JSON blob containing all the analysis data)
  reportData: json("reportData"),
  
  // Summary for preview/sharing
  title: varchar("title", { length: 500 }),
  summary: text("summary"),
  
  // Key metrics for quick display
  annualRevenue: int("annualRevenue"),
  occupancyRate: decimal("occupancyRate", { precision: 5, scale: 2 }),
  averageDailyRate: int("averageDailyRate"),
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }),
  verdict: varchar("verdict", { length: 50 }), // GO, CAUTION, NO-GO
  
  // Creator information
  creatorEmail: varchar("creatorEmail", { length: 320 }),
  creatorPhone: varchar("creatorPhone", { length: 50 }),
  creatorName: varchar("creatorName", { length: 255 }),
  creatorUserId: int("creatorUserId"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // View tracking
  viewCount: int("viewCount").default(0).notNull(),
  lastViewedAt: timestamp("lastViewedAt"),
  
  // Admin revenue override (persisted so shared reports show adjusted number)
  revenueOverride: int("revenueOverride"),
  
  // Notification tracking
  smsSentTo: varchar("smsSentTo", { length: 50 }),
  smsSentAt: timestamp("smsSentAt"),
  emailSentTo: varchar("emailSentTo", { length: 320 }),
  emailSentAt: timestamp("emailSentAt"),
  autoNotificationSent: int("autoNotificationSent").default(0), // 0 = false, 1 = true
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => [
  index("universal_reports_type_idx").on(table.reportType),
  index("universal_reports_created_at_idx").on(table.createdAt),
]);

export type UniversalShareableReport = typeof universalShareableReports.$inferSelect;
export type InsertUniversalShareableReport = typeof universalShareableReports.$inferInsert;


/**
 * Notification Analytics table for tracking all notifications sent
 * This enables analytics dashboard showing notification performance
 */
export const notificationAnalytics = mysqlTable("notification_analytics", {
  id: int("id").autoincrement().primaryKey(),
  
  // Notification details
  notificationType: mysqlEnum("notificationType", ["sms", "email"]).notNull(),
  reportType: mysqlEnum("reportType", [
    "regulation",
    "revenue",
    "validator",
    "market",
    "ai_advisor",
    "listings",
    "comparison",
    "map"
  ]).notNull(),
  
  // Reference to the shared report
  shareCode: varchar("shareCode", { length: 20 }).notNull(),
  
  // Recipient information
  recipientPhone: varchar("recipientPhone", { length: 50 }),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  recipientName: varchar("recipientName", { length: 255 }),
  
  // Location/property context
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  address: text("address"),
  
  // Delivery status
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "opened", "clicked"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  
  // Tracking (for email opens/clicks)
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  
  // Source tracking
  isAutoNotification: int("isAutoNotification").default(0), // 0 = manual, 1 = auto
  triggeredBy: varchar("triggeredBy", { length: 100 }), // Which tool triggered this
  
  // Creator/sender information
  senderUserId: int("senderUserId"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
}, (table) => [
  index("notif_analytics_share_code_idx").on(table.shareCode),
  index("notif_analytics_status_idx").on(table.status),
  index("notif_analytics_created_at_idx").on(table.createdAt),
]);

export type NotificationAnalytic = typeof notificationAnalytics.$inferSelect;
export type InsertNotificationAnalytic = typeof notificationAnalytics.$inferInsert;


/**
 * AI Conversations table for storing chat conversation sessions
 * Allows users to continue previous conversations with the AI assistant
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (optional - can be null for anonymous users)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }), // For anonymous users
  
  // Conversation metadata
  title: varchar("title", { length: 255 }), // Auto-generated from first message
  
  // Context at time of conversation (what tool/data was being viewed)
  contextTool: varchar("contextTool", { length: 64 }), // e.g., "revenue", "market", "validator"
  contextAddress: text("contextAddress"),
  contextMarket: varchar("contextMarket", { length: 255 }),
  
  // Message count for quick display
  messageCount: int("messageCount").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
}, (table) => [
  index("ai_conv_user_id_idx").on(table.userId),
  index("ai_conv_session_id_idx").on(table.sessionId),
]);

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;

/**
 * AI Messages table for storing individual chat messages
 * Each message belongs to a conversation
 */
export const aiMessages = mysqlTable("ai_messages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Reference to conversation
  conversationId: int("conversationId").notNull(),
  
  // Message content
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  
  // For tracking streaming status
  isComplete: int("isComplete").default(1).notNull(), // 1 = complete, 0 = still streaming
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ai_messages_conversation_id_idx").on(table.conversationId),
]);

export type AIMessage = typeof aiMessages.$inferSelect;
export type InsertAIMessage = typeof aiMessages.$inferInsert;


/**
 * Newsletter Cities table for tracking unique cities from HubSpot contacts
 * Used to batch market data fetching and deal scanning
 */
export const newsletterCities = mysqlTable("newsletter_cities", {
  id: int("id").autoincrement().primaryKey(),
  
  // Location data (from HubSpot Data Perfection fields)
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  postalCode: varchar("postalCode", { length: 20 }),
  
  // AirDNA market mapping
  airdnaMarketId: varchar("airdnaMarketId", { length: 64 }),
  airdnaMarketName: varchar("airdnaMarketName", { length: 255 }),
  
  // Contact count in this city
  contactCount: int("contactCount").default(0).notNull(),
  
  // Last sync timestamps
  lastMarketDataSync: timestamp("lastMarketDataSync"),
  lastDealScan: timestamp("lastDealScan"),
  
  // Cached market data (refreshed weekly)
  cachedAdr: int("cachedAdr"),
  cachedOccupancy: decimal("cachedOccupancy", { precision: 5, scale: 2 }),
  cachedRevenue: int("cachedRevenue"),
  cachedMarketScore: int("cachedMarketScore"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("newsletter_cities_city_state_idx").on(table.city, table.state),
]);

export type NewsletterCity = typeof newsletterCities.$inferSelect;
export type InsertNewsletterCity = typeof newsletterCities.$inferInsert;

/**
 * Newsletter Deals table for storing discovered rental opportunities
 * Populated by automated deal scanning using Step 5 logic
 */
export const newsletterDeals = mysqlTable("newsletter_deals", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link to city
  cityId: int("cityId").notNull(),
  
  // Property information
  address: text("address").notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  zipCode: varchar("zipCode", { length: 20 }),
  
  // Property details
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  monthlyRent: int("monthlyRent"),
  propertyType: varchar("propertyType", { length: 100 }),
  
  // Source information
  sourceUrl: text("sourceUrl"), // Zillow/Apartments.com link
  sourcePlatform: varchar("sourcePlatform", { length: 50 }), // zillow, apartments, trulia
  imageUrl: text("imageUrl"),
  
  // AirDNA projections
  projectedRevenue: int("projectedRevenue"),
  projectedAdr: int("projectedAdr"),
  projectedOccupancy: decimal("projectedOccupancy", { precision: 5, scale: 2 }),
  projectedProfit: int("projectedProfit"),
  
  // Deal scoring
  dealScore: int("dealScore"), // 1-100 score
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }),
  
  // Status
  status: mysqlEnum("status", ["active", "sent", "expired", "removed"]).default("active").notNull(),
  
  // Timestamps
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  expiresAt: timestamp("expiresAt"),
}, (table) => [
  index("newsletter_deals_city_id_idx").on(table.cityId),
  index("newsletter_deals_status_idx").on(table.status),
]);

export type NewsletterDeal = typeof newsletterDeals.$inferSelect;
export type InsertNewsletterDeal = typeof newsletterDeals.$inferInsert;

/**
 * Newsletter Sends table for tracking all email sends
 * Used for analytics and preventing duplicate sends
 */
export const newsletterSends = mysqlTable("newsletter_sends", {
  id: int("id").autoincrement().primaryKey(),
  
  // HubSpot contact info
  hubspotContactId: varchar("hubspotContactId", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  
  // Location
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  
  // Email type
  emailType: mysqlEnum("emailType", ["weekly_market", "deal_alert", "monthly_report"]).notNull(),
  
  // Content reference
  dealId: int("dealId"), // If deal alert, link to the deal
  cityId: int("cityId"), // Link to the city
  
  // HubSpot send details
  hubspotEmailId: varchar("hubspotEmailId", { length: 64 }),
  hubspotSendId: varchar("hubspotSendId", { length: 128 }),
  
  // Status
  status: mysqlEnum("status", ["queued", "sent", "delivered", "opened", "clicked", "bounced", "failed"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  
  // Engagement tracking
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
}, (table) => [
  index("newsletter_sends_contact_id_idx").on(table.hubspotContactId),
  index("newsletter_sends_email_idx").on(table.email),
  index("newsletter_sends_status_idx").on(table.status),
]);

export type NewsletterSend = typeof newsletterSends.$inferSelect;
export type InsertNewsletterSend = typeof newsletterSends.$inferInsert;

/**
 * Newsletter Preferences table for managing unsubscribes and preferences
 */
export const newsletterPreferences = mysqlTable("newsletter_preferences", {
  id: int("id").autoincrement().primaryKey(),
  
  // HubSpot contact info
  hubspotContactId: varchar("hubspotContactId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  
  // Preferences
  weeklyMarketEnabled: int("weeklyMarketEnabled").default(1).notNull(), // 1 = enabled
  dealAlertsEnabled: int("dealAlertsEnabled").default(1).notNull(),
  monthlyReportEnabled: int("monthlyReportEnabled").default(1).notNull(),
  smsAlertsEnabled: int("smsAlertsEnabled").default(0).notNull(),
  
  // Frequency preferences
  dealAlertFrequency: mysqlEnum("dealAlertFrequency", ["instant", "daily", "weekly"]).default("daily").notNull(),
  
  // Unsubscribe tracking
  unsubscribedAt: timestamp("unsubscribedAt"),
  unsubscribeReason: text("unsubscribeReason"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NewsletterPreference = typeof newsletterPreferences.$inferSelect;
export type InsertNewsletterPreference = typeof newsletterPreferences.$inferInsert;

/**
 * Newsletter Jobs table for tracking scheduled job runs
 * Provides audit trail and debugging for automation
 */
export const newsletterJobs = mysqlTable("newsletter_jobs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Job type
  jobType: mysqlEnum("jobType", ["sync_contacts", "scan_deals", "send_weekly", "send_deals"]).notNull(),
  
  // Status
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  
  // Metrics
  citiesProcessed: int("citiesProcessed").default(0),
  contactsProcessed: int("contactsProcessed").default(0),
  dealsFound: int("dealsFound").default(0),
  emailsSent: int("emailsSent").default(0),
  
  // Error tracking
  errorCount: int("errorCount").default(0),
  errors: json("errors"), // Array of error messages
  
  // Timing
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
});

export type NewsletterJob = typeof newsletterJobs.$inferSelect;
export type InsertNewsletterJob = typeof newsletterJobs.$inferInsert;


/**
 * API Call Logs table for tracking all external API calls
 * Critical for monitoring AirDNA usage and preventing overages
 */
export const apiCallLogs = mysqlTable("api_call_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // API provider (e.g., 'airdna', 'hubspot', 'simpletexting')
  provider: varchar("provider", { length: 50 }).notNull(),
  
  // Endpoint called (e.g., '/rentalizer', '/market/search')
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  
  // Request parameters (JSON blob)
  params: json("params"),
  
  // Response status
  statusCode: int("statusCode"),
  success: int("success").default(1).notNull(), // 1 = success, 0 = failure
  errorMessage: text("errorMessage"),
  
  // Performance
  responseTimeMs: int("responseTimeMs"),
  
  // Cache status
  cacheHit: int("cacheHit").default(0).notNull(), // 1 = served from cache, 0 = fresh API call
  
  // Source tracking (what triggered this call)
  source: varchar("source", { length: 100 }), // e.g., 'rentalizer', 'market_advisor', 'nurture_webhook'
  
  // User/session tracking
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  contactId: varchar("contactId", { length: 64 }), // For HubSpot contact-triggered calls
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("api_call_logs_provider_idx").on(table.provider),
  index("api_call_logs_created_at_idx").on(table.createdAt),
  index("api_call_logs_source_idx").on(table.source),
]);

export type ApiCallLog = typeof apiCallLogs.$inferSelect;
export type InsertApiCallLog = typeof apiCallLogs.$inferInsert;

/**
 * API Cache table for persistent caching across server restarts
 * Stores expensive API responses to reduce redundant calls
 */
export const apiCache = mysqlTable("api_cache", {
  id: int("id").autoincrement().primaryKey(),
  
  // Cache key (unique identifier for this cached data)
  cacheKey: varchar("cacheKey", { length: 500 }).notNull().unique(),
  
  // Cache type (e.g., 'market_details', 'rentalizer', 'search_markets')
  cacheType: varchar("cacheType", { length: 100 }).notNull(),
  
  // Cached data (JSON blob)
  data: json("data").notNull(),
  
  // TTL tracking
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("api_cache_type_idx").on(table.cacheType),
  index("api_cache_expires_idx").on(table.expiresAt),
]);

export type ApiCacheEntry = typeof apiCache.$inferSelect;
export type InsertApiCacheEntry = typeof apiCache.$inferInsert;

/**
 * API Usage Summary table for daily aggregated stats
 * Used for monitoring and alerting on API usage
 */
export const apiUsageSummary = mysqlTable("api_usage_summary", {
  id: int("id").autoincrement().primaryKey(),
  
  // Date for this summary (YYYY-MM-DD)
  date: varchar("date", { length: 10 }).notNull(),
  
  // Provider
  provider: varchar("provider", { length: 50 }).notNull(),
  
  // Daily counts
  totalCalls: int("totalCalls").default(0).notNull(),
  successfulCalls: int("successfulCalls").default(0).notNull(),
  failedCalls: int("failedCalls").default(0).notNull(),
  cacheHits: int("cacheHits").default(0).notNull(),
  
  // Unique counts
  uniqueEndpoints: int("uniqueEndpoints").default(0),
  uniqueUsers: int("uniqueUsers").default(0),
  
  // Cost tracking (if applicable)
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("api_usage_date_provider_idx").on(table.date, table.provider),
]);

export type ApiUsageSummary = typeof apiUsageSummary.$inferSelect;
export type InsertApiUsageSummary = typeof apiUsageSummary.$inferInsert;


/**
 * User Usage Tracking table for enforcing daily limits
 * Tracks property analyses, market research, and API calls per user per day
 * Admins bypass all limits
 */
export const userUsage = mysqlTable("user_usage", {
  id: int("id").autoincrement().primaryKey(),
  
  // User identification (can be userId for logged-in, or sessionId for anonymous)
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // Date for this usage record (YYYY-MM-DD)
  date: varchar("date", { length: 10 }).notNull(),
  
  // Usage counts
  propertyAnalyses: int("propertyAnalyses").default(0).notNull(),
  validateAnalyses: int("validateAnalyses").default(0).notNull(),
  marketResearches: int("marketResearches").default(0).notNull(),
  apiCallsCount: int("apiCallsCount").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("user_usage_user_id_date_idx").on(table.userId, table.date),
  index("user_usage_session_id_date_idx").on(table.sessionId, table.date),
  index("user_usage_ip_date_idx").on(table.ipAddress, table.date),
]);

export type UserUsage = typeof userUsage.$inferSelect;
export type InsertUserUsage = typeof userUsage.$inferInsert;

/**
 * Usage Limits Configuration table for storing configurable limits
 * Allows admins to adjust limits without code changes
 */
export const usageLimitsConfig = mysqlTable("usage_limits_config", {
  id: int("id").autoincrement().primaryKey(),
  
  // Limit type
  limitType: varchar("limitType", { length: 50 }).notNull().unique(),
  
  // Limit value
  dailyLimit: int("dailyLimit").notNull(),
  
  // Description
  description: text("description"),
  
  // Status
  isActive: int("isActive").default(1).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UsageLimitsConfig = typeof usageLimitsConfig.$inferSelect;
export type InsertUsageLimitsConfig = typeof usageLimitsConfig.$inferInsert;


/**
 * Deal Alert Criteria table for automated deal scanning
 * Users set criteria (city, min profit, max rent, bedrooms) and the system
 * automatically scans for matching properties and sends notifications.
 * This is the "agent that works while you sleep" feature.
 */
export const dealAlertCriteria = mysqlTable("deal_alert_criteria", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("firstName", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  
  // Target location
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  zipCode: varchar("zipCode", { length: 20 }),
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Analysis type
  analysisType: mysqlEnum("analysisType", ["arbitrage", "investment", "both"]).default("arbitrage").notNull(),
  
  // Property criteria
  minBedrooms: int("minBedrooms").default(1),
  maxBedrooms: int("maxBedrooms").default(5),
  minBathrooms: decimal("minBathrooms", { precision: 3, scale: 1 }).default("1"),
  maxRent: int("maxRent"), // Max monthly rent for arbitrage
  maxPurchasePrice: int("maxPurchasePrice"), // Max purchase price for investment
  propertyTypes: json("propertyTypes"), // ["apartment", "house", "condo", "townhouse"]
  
  // Profitability criteria
  minMonthlyProfit: int("minMonthlyProfit").default(500),
  minProfitMargin: decimal("minProfitMargin", { precision: 5, scale: 2 }).default("0.15"), // 15%
  minDealScore: int("minDealScore").default(50),
  minOccupancy: decimal("minOccupancy", { precision: 5, scale: 2 }),
  
  // Notification preferences
  notifyEmail: int("notifyEmail").default(1).notNull(), // 0 = off, 1 = on
  notifySms: int("notifySms").default(0).notNull(),
  notifyInApp: int("notifyInApp").default(1).notNull(),
  frequency: mysqlEnum("frequency", ["instant", "daily", "weekly"]).default("daily").notNull(),
  
  // Status
  isActive: int("isActive").default(1).notNull(),
  lastScannedAt: timestamp("lastScannedAt"),
  lastMatchFoundAt: timestamp("lastMatchFoundAt"),
  totalMatchesFound: int("totalMatchesFound").default(0).notNull(),
  totalAlertsSent: int("totalAlertsSent").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("deal_alert_user_id_idx").on(table.userId),
  index("deal_alert_email_idx").on(table.email),
  index("deal_alert_city_state_idx").on(table.city, table.state),
  index("deal_alert_is_active_idx").on(table.isActive),
]);
export type DealAlertCriteria = typeof dealAlertCriteria.$inferSelect;
export type InsertDealAlertCriteria = typeof dealAlertCriteria.$inferInsert;

/**
 * Deal Alert Matches table for storing properties that matched user criteria
 * Each match links a deal alert criteria to a specific property found
 */
export const dealAlertMatches = mysqlTable("deal_alert_matches", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link to criteria
  criteriaId: int("criteriaId").notNull(),
  
  // Property information
  address: text("address").notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  zipCode: varchar("zipCode", { length: 20 }),
  
  // Property details
  bedrooms: int("bedrooms"),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }),
  monthlyRent: int("monthlyRent"),
  purchasePrice: int("purchasePrice"),
  propertyType: varchar("propertyType", { length: 100 }),
  
  // Source
  sourceUrl: text("sourceUrl"),
  sourcePlatform: varchar("sourcePlatform", { length: 50 }),
  imageUrl: text("imageUrl"),
  
  // AirDNA projections
  projectedRevenue: int("projectedRevenue"),
  projectedAdr: int("projectedAdr"),
  projectedOccupancy: decimal("projectedOccupancy", { precision: 5, scale: 2 }),
  projectedMonthlyProfit: int("projectedMonthlyProfit"),
  projectedAnnualProfit: int("projectedAnnualProfit"),
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }),
  
  // Deal scoring
  dealScore: int("dealScore"),
  dealGrade: varchar("dealGrade", { length: 2 }),
  
  // Status
  status: mysqlEnum("status", ["new", "notified", "viewed", "saved", "dismissed"]).default("new").notNull(),
  notifiedAt: timestamp("notifiedAt"),
  viewedAt: timestamp("viewedAt"),
  
  // Timestamps
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
}, (table) => [
  index("deal_matches_criteria_id_idx").on(table.criteriaId),
  index("deal_matches_status_idx").on(table.status),
]);
export type DealAlertMatch = typeof dealAlertMatches.$inferSelect;
export type InsertDealAlertMatch = typeof dealAlertMatches.$inferInsert;

/**
 * Market Evaluations table for storing one-click market evaluation results
 * Each evaluation chains: regulations → comps → revenue → top properties → AI memo
 */
export const marketEvaluations = mysqlTable("market_evaluations", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  email: varchar("email", { length: 320 }),
  
  // Market information
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  marketId: varchar("marketId", { length: 64 }),
  marketName: varchar("marketName", { length: 255 }),
  
  // Evaluation parameters
  analysisType: mysqlEnum("analysisType", ["arbitrage", "investment", "both"]).default("both").notNull(),
  bedrooms: int("bedrooms").default(3),
  
  // Status tracking
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  currentStep: varchar("currentStep", { length: 100 }),
  progress: int("progress").default(0), // 0-100
  
  // Results (stored as JSON for flexibility)
  regulationsData: json("regulationsData"),
  marketOverviewData: json("marketOverviewData"),
  revenueData: json("revenueData"),
  compsData: json("compsData"),
  topPropertiesData: json("topPropertiesData"),
  aiMemo: text("aiMemo"), // AI-synthesized investment memo
  
  // Summary metrics
  marketScore: int("marketScore"),
  averageRevenue: int("averageRevenue"),
  averageOccupancy: decimal("averageOccupancy", { precision: 5, scale: 2 }),
  averageAdr: int("averageAdr"),
  regulationRisk: varchar("regulationRisk", { length: 20 }), // low, medium, high
  
  // Error handling
  errorMessage: text("errorMessage"),
  
  // Timestamps
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("market_eval_user_id_idx").on(table.userId),
  index("market_eval_session_id_idx").on(table.sessionId),
  index("market_eval_city_state_idx").on(table.city, table.state),
  index("market_eval_status_idx").on(table.status),
]);
export type MarketEvaluation = typeof marketEvaluations.$inferSelect;
export type InsertMarketEvaluation = typeof marketEvaluations.$inferInsert;


/**
 * Slack Report Deliveries — tracks every report sent to a Slack channel.
 * Used for delivery history in the admin dashboard and batch send tracking.
 */
export const slackReportDeliveries = mysqlTable("slack_report_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  
  // Who sent it
  sentByUserId: int("sentByUserId"),
  sentByName: varchar("sentByName", { length: 255 }),
  
  // Slack channel info
  channelId: varchar("channelId", { length: 50 }).notNull(),
  channelName: varchar("channelName", { length: 255 }),
  
  // Report info
  shareCode: varchar("shareCode", { length: 100 }).notNull(),
  reportSource: varchar("reportSource", { length: 20 }).notNull(), // "shared" | "universal"
  address: text("address"),
  reportType: varchar("reportType", { length: 50 }),
  
  // Message content
  dealSummary: text("dealSummary"),
  customMessage: text("customMessage"),
  
  // Delivery status
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  slackPermalink: text("slackPermalink"),
  errorMessage: text("errorMessage"),
  
  // Batch tracking (null if single send)
  batchId: varchar("batchId", { length: 50 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("slack_delivery_channel_idx").on(table.channelId),
  index("slack_delivery_status_idx").on(table.status),
  index("slack_delivery_batch_idx").on(table.batchId),
  index("slack_delivery_created_idx").on(table.createdAt),
]);
export type SlackReportDelivery = typeof slackReportDeliveries.$inferSelect;
export type InsertSlackReportDelivery = typeof slackReportDeliveries.$inferInsert;


/**
 * Translation cache table for persisting pre-translated UI strings.
 * Stores source English text → translated text for each target language.
 * Uses a hash of the source text for fast lookups.
 */
export const translationCache = mysqlTable("translation_cache", {
  id: int("id").autoincrement().primaryKey(),
  
  /** MD5-like hash of the source text for fast lookups */
  sourceHash: varchar("sourceHash", { length: 64 }).notNull(),
  
  /** Original English text */
  sourceText: text("sourceText").notNull(),
  
  /** Target language code (e.g., 'es', 'fr', 'ar') */
  targetLang: varchar("targetLang", { length: 10 }).notNull(),
  
  /** Translated text */
  translatedText: text("translatedText").notNull(),
  
  /** Context hint for the translation (e.g., 'button label', 'form placeholder') */
  context: varchar("context", { length: 255 }),
  
  /** Number of times this translation has been served from cache */
  hitCount: int("hitCount").default(0).notNull(),
  
  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("tc_hash_lang_idx").on(table.sourceHash, table.targetLang),
  index("tc_target_lang_idx").on(table.targetLang),
  index("tc_hit_count_idx").on(table.hitCount),
]);

export type TranslationCacheEntry = typeof translationCache.$inferSelect;
export type InsertTranslationCacheEntry = typeof translationCache.$inferInsert;

/**
 * Content Studio - Script generation table.
 * Stores AI-generated video narration scripts using Coach Inayah's persona.
 * Supports 4 formats: reel, short, lesson, deep_dive.
 */
export const contentScripts = mysqlTable("content_scripts", {
  id: int("id").autoincrement().primaryKey(),

  /** User who generated the script (null for anonymous/admin-generated) */
  userId: int("userId"),

  /** Video format: reel | short | lesson | deep_dive */
  format: varchar("format", { length: 20 }).notNull(),

  /** Topic / prompt the user entered */
  topic: text("topic").notNull(),

  /** Generated video title */
  title: varchar("title", { length: 500 }).notNull(),

  /** Opening hook line */
  hook: text("hook").notNull(),

  /** Full narration script */
  script: text("script").notNull(),

  /** Closing call-to-action */
  cta: text("cta").notNull(),

  /** Estimated duration in seconds */
  estimatedDurationSeconds: int("estimatedDurationSeconds"),

  /** JSON array of key data points used in the script */
  keyDataPoints: json("keyDataPoints").$type<string[]>(),

  /** One-sentence target audience description */
  targetAudience: varchar("targetAudience", { length: 500 }),

  /** Optional market data context injected into generation (JSON) */
  marketDataContext: json("marketDataContext").$type<Record<string, unknown>>(),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("cs_user_idx").on(table.userId),
  index("cs_format_idx").on(table.format),
  index("cs_created_idx").on(table.createdAt),
]);
export type ContentScript = typeof contentScripts.$inferSelect;
export type InsertContentScript = typeof contentScripts.$inferInsert;


/**
 * Video generation jobs table — persists Golpo AI video generation jobs
 * so they survive server restarts and can be polled/resumed.
 */
export const videoJobs = mysqlTable("video_jobs", {
  id: int("id").autoincrement().primaryKey(),

  /** Internal job UUID (used for client-side polling) */
  jobId: varchar("jobId", { length: 64 }).notNull().unique(),

  /** Golpo AI job ID (returned from /generate endpoint) */
  golpoJobId: varchar("golpoJobId", { length: 128 }),

  /** Reference to the content_scripts table */
  scriptId: int("scriptId").notNull(),

  /** Video title (copied from script for quick display) */
  title: varchar("title", { length: 500 }).notNull(),

  /** Job status */
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),

  /** Final video URL from Golpo */
  videoUrl: text("videoUrl"),

  /** Golpo-generated script (may differ from input) */
  videoScript: text("videoScript"),

  /** Error message if failed */
  error: text("error"),

  /** Timestamps */
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("vj_job_id_idx").on(table.jobId),
  index("vj_golpo_job_id_idx").on(table.golpoJobId),
  index("vj_script_id_idx").on(table.scriptId),
  index("vj_status_idx").on(table.status),
  index("vj_created_idx").on(table.createdAt),
]);
export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoJob = typeof videoJobs.$inferInsert;


// ============================================
// WEBINAR SMS SYSTEM (Isolated Module)
// These tables are completely self-contained.
// ============================================

/**
 * Webinar registrants imported from WebinarJam or Zapier webhook.
 * Each registrant has a phone number for SMS outreach.
 */
export const webinarRegistrants = mysqlTable("webinar_registrants", {
  id: int("id").autoincrement().primaryKey(),
  /** Source webinar ID from WebinarJam */
  webinarId: varchar("webinarId", { length: 100 }),
  /** Registrant's name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Registrant's email */
  email: varchar("email", { length: 320 }),
  /** Registrant's phone number (E.164 format preferred) */
  phone: varchar("phone", { length: 50 }).notNull(),
  /** Import source: 'webinarjam', 'zapier', 'manual', 'csv' */
  source: varchar("source", { length: 50 }).default("manual").notNull(),
  /** Webinar name/title for grouping */
  webinarName: varchar("webinarName", { length: 500 }),
  /** Webinar scheduled date */
  webinarDate: timestamp("webinarDate"),
  /** Whether registrant attended the webinar */
  attended: int("attended").default(0), // 0 = no, 1 = yes
  /** Whether registrant has opted out of SMS */
  optedOut: int("optedOut").default(0), // 0 = no, 1 = yes
  /** Tags for segmentation (JSON array of strings) */
  tags: json("tags").$type<string[]>(),
  /** Extra metadata from the import source */
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("wr_phone_idx").on(table.phone),
  index("wr_email_idx").on(table.email),
  index("wr_webinar_id_idx").on(table.webinarId),
  index("wr_source_idx").on(table.source),
  index("wr_created_idx").on(table.createdAt),
]);
export type WebinarRegistrant = typeof webinarRegistrants.$inferSelect;
export type InsertWebinarRegistrant = typeof webinarRegistrants.$inferInsert;

/**
 * SMS message templates for quick reuse.
 */
export const webinarSmsTemplates = mysqlTable("webinar_sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Template name for easy identification */
  name: varchar("name", { length: 255 }).notNull(),
  /** Message body with optional {{name}} placeholder */
  body: text("body").notNull(),
  /** Template category: 'reminder', 'followup', 'promo', 'custom' */
  category: varchar("category", { length: 50 }).default("custom").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarSmsTemplate = typeof webinarSmsTemplates.$inferSelect;
export type InsertWebinarSmsTemplate = typeof webinarSmsTemplates.$inferInsert;

/**
 * SMS campaigns — each send operation creates a campaign record.
 * Individual message delivery is tracked per-registrant.
 */
export const webinarSmsCampaigns = mysqlTable("webinar_sms_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  /** Campaign name/label */
  name: varchar("name", { length: 255 }).notNull(),
  /** The message body that was sent */
  messageBody: text("messageBody").notNull(),
  /** Template ID if sent from a template */
  templateId: int("templateId"),
  /** Filter criteria used to select recipients (JSON) */
  filterCriteria: json("filterCriteria").$type<Record<string, unknown>>(),
  /** Total recipients targeted */
  totalRecipients: int("totalRecipients").default(0).notNull(),
  /** Successfully sent count */
  sentCount: int("sentCount").default(0).notNull(),
  /** Failed count */
  failedCount: int("failedCount").default(0).notNull(),
  /** Campaign status */
  status: mysqlEnum("campaignStatus", ["draft", "sending", "completed", "failed"]).default("draft").notNull(),
  /** Who initiated the campaign (admin user ID) */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("wsc_status_idx").on(table.status),
  index("wsc_created_idx").on(table.createdAt),
]);
export type WebinarSmsCampaign = typeof webinarSmsCampaigns.$inferSelect;
export type InsertWebinarSmsCampaign = typeof webinarSmsCampaigns.$inferInsert;

/**
 * Individual SMS delivery records — one per message sent.
 */
export const webinarSmsDeliveries = mysqlTable("webinar_sms_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  /** Campaign this delivery belongs to */
  campaignId: int("campaignId").notNull(),
  /** Registrant who received the message */
  registrantId: int("registrantId").notNull(),
  /** Phone number the message was sent to */
  phone: varchar("phone", { length: 50 }).notNull(),
  /** Delivery status from SimpleTexting */
  deliveryStatus: varchar("deliveryStatus", { length: 50 }).default("pending").notNull(),
  /** SimpleTexting message ID for tracking */
  externalMessageId: varchar("externalMessageId", { length: 255 }),
  /** Error message if delivery failed */
  error: text("error"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (table) => [
  index("wsd_campaign_idx").on(table.campaignId),
  index("wsd_registrant_idx").on(table.registrantId),
  index("wsd_status_idx").on(table.deliveryStatus),
]);
export type WebinarSmsDelivery = typeof webinarSmsDeliveries.$inferSelect;
export type InsertWebinarSmsDelivery = typeof webinarSmsDeliveries.$inferInsert;

/**
 * Webinar SMS Settings — key-value store for configuration.
 * Uses key-value pattern for flexibility.
 */
export const webinarSmsSettings = mysqlTable("webinar_sms_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Setting key (e.g., 'selected_webinar_id', 'selected_schedule_id', 'cron_enabled', 'cron_interval_minutes') */
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  /** Setting value (stored as string, parsed by application) */
  settingValue: text("settingValue").notNull(),
  /** Optional description of the setting */
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarSmsSetting = typeof webinarSmsSettings.$inferSelect;
export type InsertWebinarSmsSetting = typeof webinarSmsSettings.$inferInsert;

/**
 * Scheduled SMS Messages — messages queued to send at a specific time.
 * Used for the webinar SMS sequence (reminders, follow-ups).
 */
export const scheduledSmsMessages = mysqlTable("scheduled_sms_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Which webinar this scheduled message belongs to */
  webinarId: varchar("webinarId", { length: 100 }).notNull(),
  /** Human-readable name for this message in the sequence (e.g., "1 Hour Before", "Going Live Now") */
  sequenceName: varchar("sequenceName", { length: 255 }).notNull(),
  /** Position in the sequence (1-9) for ordering */
  sequenceOrder: int("sequenceOrder").notNull(),
  /** The SMS message body (supports %FIRST_NAME% variable substitution) */
  messageBody: text("messageBody").notNull(),
  /** When this message should be sent (UTC timestamp) */
  scheduledAt: timestamp("scheduledAt").notNull(),
  /** Current status of this scheduled message */
  status: mysqlEnum("status", ["pending", "sending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  /** Target audience for this message */
  audience: mysqlEnum("audience", ["all", "attended", "not_attended"]).default("all").notNull(),
  /** How many messages were actually sent */
  sentCount: int("sentCount").default(0),
  /** How many messages failed */
  failedCount: int("failedCount").default(0),
  /** When the message was actually sent */
  sentAt: timestamp("sentAt"),
  /** Error message if sending failed */
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("ssm_webinar_idx").on(table.webinarId),
  index("ssm_status_idx").on(table.status),
  index("ssm_scheduled_at_idx").on(table.scheduledAt),
  index("ssm_sequence_order_idx").on(table.sequenceOrder),
]);
export type ScheduledSmsMessage = typeof scheduledSmsMessages.$inferSelect;
export type InsertScheduledSmsMessage = typeof scheduledSmsMessages.$inferInsert;

/**
 * Per-Webinar API Credentials — stores all 4 WebinarJam API fields per webinar.
 * Found in WebinarJam → Configuration → Advanced Integration → API custom integration.
 * Each webinar has its own set of credentials (API Key, Webinar Hash, Member ID, Webinar ID).
 */
export const webinarCredentials = mysqlTable("webinar_credentials", {
  id: int("id").autoincrement().primaryKey(),
  /** The WebinarJam webinar_id (from the webinar list API) — used as the lookup key */
  webinarId: varchar("webinarId", { length: 100 }).notNull().unique(),
  /** Human-readable webinar name for display */
  webinarName: varchar("webinarName", { length: 500 }),
  /** Per-webinar API Key from Advanced Integration */
  apiKey: text("apiKey"),
  /** Per-webinar Hash from Advanced Integration */
  webinarHash: varchar("webinarHash", { length: 100 }),
  /** Per-webinar Member ID from Advanced Integration */
  memberId: varchar("memberId", { length: 100 }),
  /** Per-webinar Webinar ID from Advanced Integration (may differ from the list API webinar_id) */
  integrationWebinarId: varchar("integrationWebinarId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarCredential = typeof webinarCredentials.$inferSelect;
export type InsertWebinarCredential = typeof webinarCredentials.$inferInsert;

// ─── Webinar Transcripts (per-webinar transcript storage for AI context) ───
export const webinarTranscripts = mysqlTable("webinar_transcripts", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: varchar("webinarId", { length: 100 }).notNull().unique(),
  webinarTitle: varchar("webinarTitle", { length: 500 }),
  keySummary: text("keySummary"),
  transcript: text("transcript").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarTranscript = typeof webinarTranscripts.$inferSelect;
export type InsertWebinarTranscript = typeof webinarTranscripts.$inferInsert;

// ─── Webinar Environment Settings (controls webinar/demo mode for live presentations) ───
export const webinarSettings = mysqlTable("webinar_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Whether webinar mode is currently active */
  isActive: tinyint("isActive").default(0).notNull(),
  /** User ID who last toggled the setting */
  toggledBy: int("toggledBy"),
  /** When the setting was last toggled */
  toggledAt: timestamp("toggledAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WebinarSetting = typeof webinarSettings.$inferSelect;
export type InsertWebinarSetting = typeof webinarSettings.$inferInsert;


/**
 * TOS Acceptance log — records when each user accepted the Terms of Service.
 * Provides legal proof of agreement with timestamp and version tracking.
 */
export const tosAcceptances = mysqlTable("tos_acceptances", {
  id: int("id").autoincrement().primaryKey(),
  
  /** User who accepted (null for anonymous/pre-login users) */
  userId: int("userId"),
  
  /** Session ID for anonymous users who haven't logged in yet */
  sessionId: varchar("sessionId", { length: 64 }),
  
  /** IP address at time of acceptance */
  userIp: varchar("userIp", { length: 45 }),
  
  /** User agent string at time of acceptance */
  userAgent: text("userAgent"),
  
  /** TOS version accepted (allows tracking when TOS changes) */
  tosVersion: varchar("tosVersion", { length: 20 }).notNull().default("1.0"),
  
  /** Timestamp of acceptance */
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
}, (table) => [
  index("tos_user_id_idx").on(table.userId),
  index("tos_session_id_idx").on(table.sessionId),
  index("tos_accepted_at_idx").on(table.acceptedAt),
]);

export type TosAcceptance = typeof tosAcceptances.$inferSelect;
export type InsertTosAcceptance = typeof tosAcceptances.$inferInsert;
