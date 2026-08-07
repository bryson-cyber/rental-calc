import { and, eq, isNull, sql } from "drizzle-orm";
import { llcRegistrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { seedStatePricing } from "./pricing";
import { generateStatusToken } from "./store";

/**
 * Boot-time idempotent creation of the LLC tables (mirrors migrations
 * 0023/0024). The hosting platform pulls main and redeploys but cannot be
 * relied on to run drizzle migrations, so — like the sibling member app —
 * the LLC feature creates its own schema at startup. CREATE TABLE IF NOT
 * EXISTS plus catch-guarded ADD COLUMN statements only; never drops or
 * rewrites anything.
 */
export async function ensureLlcTables(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[LLC] Skipping schema check: database not available");
    return;
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_registrations\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`status\` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed') NOT NULL DEFAULT 'draft',
        \`currentStep\` int NOT NULL DEFAULT 1,
        \`legalName\` varchar(160),
        \`entitySuffix\` enum('LLC','L.L.C','L.L.C.','Limited Liability Company') NOT NULL DEFAULT 'LLC',
        \`formationState\` varchar(2),
        \`businessType\` varchar(128),
        \`industryGroup\` varchar(128),
        \`industryType\` varchar(128),
        \`businessPhone\` varchar(32),
        \`website\` text,
        \`useRegisteredAgent\` boolean NOT NULL DEFAULT false,
        \`companyAddressLine1\` varchar(255),
        \`companyAddressLine2\` varchar(255),
        \`companyAddressCity\` varchar(120),
        \`companyAddressState\` varchar(64),
        \`companyAddressPostalCode\` varchar(24),
        \`companyAddressCountry\` varchar(2) NOT NULL DEFAULT 'US',
        \`expediteEin\` boolean NOT NULL DEFAULT false,
        \`accuracyAttested\` boolean NOT NULL DEFAULT false,
        \`whopAccountId\` varchar(64),
        \`accountEmailAlias\` varchar(320),
        \`checkoutSessionId\` varchar(64),
        \`checkoutUrl\` text,
        \`checkoutTotal\` int,
        \`checkoutCurrency\` varchar(3),
        \`retailPriceCents\` int,
        \`retailPaidAt\` timestamp,
        \`opsNotifiedAt\` timestamp,
        \`providerStatus\` json,
        \`lastProviderSyncAt\` timestamp,
        \`lastErrorType\` varchar(128),
        \`lastErrorMessage\` varchar(500),
        \`retryable\` boolean NOT NULL DEFAULT false,
        \`submissionKey\` varchar(64),
        \`submittedAt\` timestamp,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`llc_registrations_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`llc_registration_whop_account_unique\` UNIQUE(\`whopAccountId\`),
        CONSTRAINT \`llc_registration_checkout_unique\` UNIQUE(\`checkoutSessionId\`),
        INDEX \`llc_registration_user_idx\` (\`userId\`),
        INDEX \`llc_registration_status_idx\` (\`status\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_founders\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`registrationId\` int NOT NULL,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        \`isPrimary\` boolean NOT NULL DEFAULT false,
        \`firstName\` varchar(100),
        \`lastName\` varchar(100),
        \`email\` varchar(320),
        \`phone\` varchar(32),
        \`ssnEncrypted\` varchar(512),
        \`ownershipBasisPoints\` int,
        \`addressLine1\` varchar(255),
        \`addressLine2\` varchar(255),
        \`addressCity\` varchar(120),
        \`addressState\` varchar(64),
        \`addressPostalCode\` varchar(24),
        \`addressCountry\` varchar(2) NOT NULL DEFAULT 'US',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`llc_founders_id\` PRIMARY KEY(\`id\`),
        INDEX \`llc_founder_registration_idx\` (\`registrationId\`),
        INDEX \`llc_founder_primary_idx\` (\`registrationId\`,\`isPrimary\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_submission_attempts\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`registrationId\` int NOT NULL,
        \`attemptNumber\` int NOT NULL,
        \`submissionKey\` varchar(64) NOT NULL,
        \`phase\` enum('account_creation','llc_registration','status_refresh') NOT NULL,
        \`outcome\` enum('started','succeeded','retryable_failure','action_required','uncertain') NOT NULL DEFAULT 'started',
        \`httpStatus\` int,
        \`whopRequestId\` varchar(128),
        \`providerObjectId\` varchar(128),
        \`errorType\` varchar(128),
        \`safeMessage\` varchar(500),
        \`retryable\` boolean NOT NULL DEFAULT false,
        \`startedAt\` timestamp NOT NULL DEFAULT (now()),
        \`finishedAt\` timestamp,
        CONSTRAINT \`llc_submission_attempts_id\` PRIMARY KEY(\`id\`),
        INDEX \`llc_attempt_registration_idx\` (\`registrationId\`),
        CONSTRAINT \`llc_attempt_number_unique\` UNIQUE(\`registrationId\`,\`attemptNumber\`,\`phase\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_status_history\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`registrationId\` int NOT NULL,
        \`fromStatus\` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed'),
        \`toStatus\` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed') NOT NULL,
        \`source\` enum('user','system','whop') NOT NULL,
        \`note\` varchar(500),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`llc_status_history_id\` PRIMARY KEY(\`id\`),
        INDEX \`llc_status_history_registration_idx\` (\`registrationId\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_documents\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`registrationId\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`name\` varchar(200),
        \`documentType\` varchar(128),
        \`label\` varchar(200),
        \`source\` enum('provider','ops_upload') NOT NULL DEFAULT 'provider',
        \`storageKey\` varchar(512) NOT NULL,
        \`releasedAt\` timestamp,
        \`opsHeldAt\` timestamp,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`llc_documents_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`llc_document_mirror_unique\` UNIQUE(\`registrationId\`,\`documentType\`,\`name\`),
        INDEX \`llc_document_registration_idx\` (\`registrationId\`),
        INDEX \`llc_document_user_idx\` (\`userId\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_state_pricing\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`state\` varchar(2) NOT NULL,
        \`retailPriceCents\` int,
        \`stateFeeCents\` int NOT NULL,
        \`paymentLinkUrl\` varchar(1000),
        \`active\` boolean NOT NULL DEFAULT true,
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`llc_state_pricing_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`llc_state_pricing_state_unique\` UNIQUE(\`state\`)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_email_log\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`registrationId\` int NOT NULL,
        \`emailType\` varchar(64) NOT NULL,
        \`sentAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`llc_email_log_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`llc_email_log_once_unique\` UNIQUE(\`registrationId\`,\`emailType\`),
        INDEX \`llc_email_log_registration_idx\` (\`registrationId\`)
      )
    `);

    // Column additions for tables that already exist on deployed databases
    // (CREATE TABLE IF NOT EXISTS cannot add columns). Each ALTER is
    // idempotent-by-catch: it fails harmlessly with a duplicate-column error
    // once applied. Mirrors migration 0026.
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `retailPaidAt` timestamp"))
      .catch(() => undefined);
    await db
      .execute(
        sql.raw(
          "ALTER TABLE `llc_registrations` ADD `isTest` boolean NOT NULL DEFAULT false",
        ),
      )
      .catch(() => undefined);
    await db
      .execute(
        sql.raw(
          "ALTER TABLE `llc_registrations` ADD `provider` varchar(16) NOT NULL DEFAULT 'whop'",
        ),
      )
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `doolaCustomerId` varchar(64)"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `doolaCompanyId` varchar(64)"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `doolaEnv` varchar(16)"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `ein` varchar(16)"))
      .catch(() => undefined);
    await db
      .execute(
        sql.raw(
          "CREATE INDEX `llc_registration_doola_company_idx` ON `llc_registrations` (`doolaCompanyId`)",
        ),
      )
      .catch(() => undefined);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`llc_webhook_events\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`eventId\` varchar(128) NOT NULL,
        \`eventName\` varchar(64) NOT NULL,
        \`registrationId\` int,
        \`receivedAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`llc_webhook_events_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`llc_webhook_event_unique\` UNIQUE(\`eventId\`)
      )
    `);
    // Durable ops hold (2026-08-06): a manual unrelease stamps opsHeldAt and
    // the auto-release sweep skips the row from then on, so ops can pull a
    // document back without the next Doola poll re-releasing it.
    await db
      .execute(sql.raw("ALTER TABLE `llc_documents` ADD `opsHeldAt` timestamp"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_state_pricing` ADD `paymentLinkUrl` varchar(1000)"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_state_pricing` ADD `expediteEinPriceCents` int"))
      .catch(() => undefined);
    await db
      .execute(sql.raw("ALTER TABLE `llc_registrations` ADD `statusToken` varchar(64)"))
      .catch(() => undefined);

    // statusToken backfill (2026-07-28): rows created before the column each
    // get their own unguessable token at boot so tokenized email links work
    // for existing filings too. First-write-wins via the IS NULL guard in the
    // UPDATE; the row cap is harmless because any remainder is picked up on
    // the next boot (and ensureStatusToken covers stragglers at send time).
    try {
      const missing = await db
        .select({ id: llcRegistrations.id })
        .from(llcRegistrations)
        .where(isNull(llcRegistrations.statusToken))
        .limit(500);
      for (const row of missing) {
        await db
          .update(llcRegistrations)
          .set({ statusToken: generateStatusToken() })
          .where(
            and(
              eq(llcRegistrations.id, row.id),
              isNull(llcRegistrations.statusToken),
            ),
          );
      }
      if (missing.length > 0) {
        // Count only — the tokens themselves are never logged.
        console.log(
          `[LLC] Backfilled status tokens for ${missing.length} registrations`,
        );
      }
    } catch (error) {
      console.warn("[LLC] statusToken backfill failed:", error);
    }

    // Idempotent reference seed (INSERT IGNORE per state): fills state filing
    // fees on first boot, never overwrites owner-set retail prices or flags.
    await seedStatePricing(db);

    console.log("[LLC] Schema ensured");
  } catch (error) {
    console.error("[LLC] ensureLlcTables failed:", error);
  }
}
