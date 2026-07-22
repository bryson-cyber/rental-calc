-- llc_registrations.isTest is added at boot by server/llc/ensure-tables.ts
-- (idempotent-by-catch ALTER TABLE, "deploy-proof schema"). Intentionally a
-- no-op for the same reason as 0023 — see that file's comment.
SELECT 1;
