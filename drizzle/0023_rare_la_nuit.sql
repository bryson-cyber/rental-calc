-- LLC tables (llc_registrations, llc_founders, llc_submission_attempts,
-- llc_status_history) are created at boot by server/llc/ensure-tables.ts
-- (CREATE TABLE IF NOT EXISTS, "deploy-proof schema"), including all
-- indexes and unique constraints. The DDL originally generated here
-- duplicated that boot script non-idempotently, so `drizzle-kit migrate`
-- failed on any database the app had already booted against. This
-- migration is intentionally a no-op; the drizzle snapshot for this index
-- still tracks the tables so future schema diffs stay correct.
SELECT 1;
