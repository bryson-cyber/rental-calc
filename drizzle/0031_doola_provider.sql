-- provider/doolaCustomerId/doolaCompanyId/ein columns and llc_webhook_events
-- are created at boot by server/llc/ensure-tables.ts (idempotent ALTERs and
-- CREATE TABLE IF NOT EXISTS, "deploy-proof schema"). Intentionally a no-op
-- for the same reason as 0023 — see that file's comment.
SELECT 1;
