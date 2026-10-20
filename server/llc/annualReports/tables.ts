/**
 * Annual report filing (the owner, 2026-10-20): the two side tables, created at boot by ensureLlcTables
 * (server/llc/ensure-tables.ts, right after llc_webhook_events),
 * one statement at a time (a failure is logged and skipped). Neither is in drizzle/schema.ts; every read is raw SQL
 * (annualReports/store.ts). Only real filings get rows: completed, not test or demo, with a provider company id.
 *
 * - llc_compliance: one row per filing. The provider's compliance calendar (next due date, last filed date, status),
 *   the state fee quote (isFilingRequired, priceInCents, isMinimum) and when it was last read.
 * - llc_annual_reports: one row per filing and fiscal year. The provider's report id, status and fixed price, her
 *   answers as sent, the checkout made for that exact price, the verified payment, and when it was submitted,
 *   confirmed and filed, and the calendar due date it was submitted for. No card data; the payment reference is the
 *   processor's payment id.
 *
 * Dates from the provider ("yyyy-MM-dd") are kept as text so no time zone ever shifts a due date.
 */
import { sql, type SQL } from "drizzle-orm";

export const ANNUAL_REPORT_TABLES: readonly SQL[] = [
  sql`CREATE TABLE IF NOT EXISTS \`llc_compliance\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`registrationId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`state\` varchar(8) NULL,
    \`nextDueDate\` varchar(10) NULL,
    \`lastFiledDate\` varchar(10) NULL,
    \`status\` varchar(32) NULL,
    \`filingRequired\` tinyint NULL,
    \`quotePriceCents\` int NULL,
    \`quoteIsMinimum\` tinyint NOT NULL DEFAULT 0,
    \`syncedAt\` timestamp NULL,
    \`lastError\` varchar(255) NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE INDEX \`llc_compliance_registration_uq\` (\`registrationId\`),
    INDEX \`llc_compliance_due_idx\` (\`nextDueDate\`),
    INDEX \`llc_compliance_synced_idx\` (\`syncedAt\`)
  )`,
  sql`CREATE TABLE IF NOT EXISTS \`llc_annual_reports\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`registrationId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`fiscalYear\` int NOT NULL,
    \`dueDate\` varchar(10) NULL,
    \`annualReportId\` varchar(128) NULL,
    \`status\` varchar(32) NULL,
    \`priceInCents\` int NULL,
    \`answers\` json NULL,
    \`checkoutSessionId\` varchar(128) NULL,
    \`checkoutUrl\` varchar(1000) NULL,
    \`checkoutPlanId\` varchar(128) NULL,
    \`checkoutQuoteHash\` varchar(64) NULL,
    \`checkoutPriceCents\` int NULL,
    \`checkoutExpiresAt\` timestamp NULL,
    \`paymentReference\` varchar(128) NULL,
    \`paidCents\` int NULL,
    \`paidAt\` timestamp NULL,
    \`submittedAt\` timestamp NULL,
    \`confirmedAt\` timestamp NULL,
    \`completedAt\` timestamp NULL,
    \`filedDocumentId\` varchar(128) NULL,
    \`lastError\` varchar(255) NULL,
    \`lastErrorAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE INDEX \`llc_annual_reports_year_uq\` (\`registrationId\`, \`fiscalYear\`),
    INDEX \`llc_annual_reports_provider_idx\` (\`annualReportId\`),
    INDEX \`llc_annual_reports_plan_idx\` (\`checkoutPlanId\`),
    INDEX \`llc_annual_reports_paid_idx\` (\`paidAt\`, \`confirmedAt\`)
  )`,
];

/**
 * Columns added after the tables' first version (2026-10-20 review), ensured at boot by ensureLlcTables with this
 * app's catch-guarded ALTER TABLE ... ADD (a duplicate-column error once applied is the no-op). dueDate: the calendar due date a report was submitted for,
 * which the card, the reminders and the wrong-year check match on before the fiscal year.
 */
export const ANNUAL_REPORT_COLUMN_SETS: ReadonlyArray<{ table: string; columns: ReadonlyArray<readonly [string, string]> }> = [
  { table: "llc_annual_reports", columns: [["dueDate", "varchar(10) NULL"]] },
];
