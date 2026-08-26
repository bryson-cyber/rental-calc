# Doola Required Actions API — Verified Notes

Source reviewed: https://docs.doola.com/api/required-actions and https://docs.doola.com/api/required-actions/name-options on 2026-08-26.

## Core model

- Required actions are blocking work items. The affected formation does not progress until the action is resolved.
- Actions must be keyed by `requiredActionId`, not by company plus action code. Closed actions never reopen; repeated problems produce a new action ID.
- Known action codes:
  - `FORMATION_NAME_OPTIONS_EXHAUSTED`, announced by `company_name_options_required`.
  - `FORMATION_SIGNATURE_SS4_RESET`, announced by `signature_ss4_reset`.
- Statuses include at least `open`, `submitted`, `resolved`, and `rejected`.
- Doola exposes reads for all open partner actions, a company's actions, and one action with history. The global open list should be used for reconciliation after missed webhooks/outages.

## Name replacement resolution

- Endpoint: `POST /v1/partner/companies/{companyId}/required-actions/{requiredActionId}/resolution`.
- Body contains `actionCode: "FORMATION_NAME_OPTIONS_EXHAUSTED"` and one to three `nameOptions`.
- Each name option includes `name`, case-sensitive `entityTypeEnding` such as `LLC`, and optional preference `position`.
- The response is the updated action in `submitted` state with history.
- This endpoint has no idempotency key. On a network timeout, read the action back before deciding whether to retry; do not retry blindly.
- A successful submission immediately replaces the company's cached name options, and the first preference becomes the company's current name/ending.
- If all replacement names are rejected, the existing action closes as rejected and Doola raises a new action with a new `requiredActionId`.
- A name change can invalidate a previously signed SS-4 and produce a separate SS-4 reset action.

## Resolution errors

- `400 E_VALIDATION_FAILED`: invalid body or name-option structure.
- `400 E_REQUIRED_ACTION_CODE_MISMATCH`: submitted action code does not match the action.
- `400 E_NAME_OPTIONS_INVALID`: recognized ending is invalid for the company's entity type.
- `404 E_REQUIRED_ACTION_NOT_FOUND` or `E_COMPANY_NOT_FOUND`: action/company not in the partner tenant.
- `409 E_REQUIRED_ACTION_CLOSED`: action is already resolved/rejected.
- `422 E_REQUIRED_ACTION_NOT_RESOLVABLE`: action must be resolved through another flow, including an SS-4 re-signature.

## Implementation implications

- Webhook handling must be idempotent and acknowledge quickly.
- Required actions need first-class persistence and must block a formation locally.
- Reconciliation must periodically call the partner-wide open-action endpoint.
- Name-option submission requires a read-after-timeout strategy rather than blind retries.
- SS-4 reset must use the signature-session flow rather than the generic resolution endpoint.

## Live case observed

The provider identifier supplied as customer `3HpjnN1GwP5aihDUlFiXfXtcNVw` is the Doola company ID for local registration `270004` (`Diipa Spaces LLC`, New Mexico). The live company record currently reports `signatureRequirements: [{ documentType: "SS4", status: "PENDING" }]`, and the local app already normalizes that to `action_required`. However, both the per-company Required Actions endpoint and the partner-wide open list currently return no actions (`payload: []`, tenant `total: 0`). This means the integration must support the new Required Actions API while preserving a fallback path that synthesizes an actionable SS-4 work item from the company-level `signatureRequirements` array for legacy or not-backfilled cases.
