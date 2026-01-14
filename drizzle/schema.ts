import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

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
});

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
});

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
  
  // User notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  
  // User tracking (optional)
  userIp: varchar("userIp", { length: 45 }),
  userAgent: text("userAgent"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
});

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
});

export type MarketResearchReport = typeof marketResearchReports.$inferSelect;
export type InsertMarketResearchReport = typeof marketResearchReports.$inferInsert;


/**
 * Opportunity Searches table for storing arbitrage deal finder results
 * Generated by Browser Use automation scraping Zillow + Coach Inayah + AirDNA
 */
export const opportunitySearches = mysqlTable("opportunity_searches", {
  id: int("id").autoincrement().primaryKey(),
  
  // Search identifier
  searchId: varchar("searchId", { length: 100 }).notNull().unique(),
  
  // Search parameters
  city: varchar("city", { length: 255 }).notNull(),
  minRent: int("minRent"),
  maxRent: int("maxRent"),
  
  // Status tracking
  status: mysqlEnum("status", ["pending", "running", "completed", "error"]).default("pending").notNull(),
  progress: int("progress").default(0),
  currentStep: varchar("currentStep", { length: 255 }),
  errorMessage: text("errorMessage"),
  
  // Browser Use task tracking
  zillowTaskId: varchar("zillowTaskId", { length: 100 }),
  amenityTaskId: varchar("amenityTaskId", { length: 100 }),
  
  // Results (JSON blobs)
  marketSnapshot: json("marketSnapshot"),
  winningAmenities: json("winningAmenities"),
  opportunities: json("opportunities"),
  
  // User tracking (optional)
  userId: int("userId"),
  sessionToken: varchar("sessionToken", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type OpportunitySearch = typeof opportunitySearches.$inferSelect;
export type InsertOpportunitySearch = typeof opportunitySearches.$inferInsert;


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
});

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
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
