# Doola Required Actions — Implementation Design

## Objective

Required actions become first-class filing blockers rather than generic provider notes. The app must ingest them from webhooks, recover missed actions through reconciliation, notify the client and operations team once, display an actionable customer workflow, and keep the local record synchronized until Doola closes the action.[1]

## Architecture decision

| Approach | Tradeoffs | Runtime cost | Setup complexity |
| --- | --- | --- | --- |
| Webhooks plus scheduled reconciliation | Fast customer notification, while the open-action list heals missed/failed webhook deliveries. This matches Doola’s recommended contract and existing app architecture. | Existing site and heartbeat only | Moderate |
| Polling company records only | Simpler and supports legacy pending signatures, but cannot represent action IDs/history reliably and reacts more slowly to name-option events. | Existing heartbeat only | Low |

The implementation uses **webhooks plus scheduled reconciliation**, with company-level signature requirements retained as a compatibility fallback. The live company `3HpjnN1GwP5aihDUlFiXfXtcNVw` demonstrates why both are necessary: its company record reports a pending SS-4, while the new Required Actions endpoints currently return no rows.

## Persistence

Create `llc_required_actions`, keyed by Doola `requiredActionId`. The table stores the local registration, provider company, action code/name/reason, provider status/open flag, source, provider timestamp, optional history/submitted payload, notification timestamps, and local created/updated timestamps. Provider status remains a string rather than a database enum so future Doola statuses do not break writes.

A legacy pending signature without a provider action is represented by a stable synthetic key, `legacy:{doolaCompanyId}:SS4`. If a real `FORMATION_SIGNATURE_SS4_RESET` action later appears, reconciliation closes the synthetic row and the real action becomes the active source of truth.

## Lifecycle rules

| Condition | Local effect | Customer action |
| --- | --- | --- |
| Open `FORMATION_NAME_OPTIONS_EXHAUSTED` | Persist action, transition registration to `action_required`, notify client/ops | Submit one to three replacement names |
| Name action `submitted` | Keep `action_required`; show “received and being refiled” | None while Doola/state processes it |
| Name action `resolved` or `rejected` | Close local row; refresh company. A repeated rejection arrives as a new action ID | New action if raised |
| Open `FORMATION_SIGNATURE_SS4_RESET` | Persist action, transition registration to `action_required`, notify client/ops | Generate a short-lived SS-4 signing session and open it |
| Pending SS-4 in company record with no API action | Persist/update synthetic compatibility action | Same signing-session flow |
| Signature no longer pending | Close matching real/synthetic SS-4 actions and refresh formation status | None |

The Doola `reason` is stored and shown as customer-safe text, but the UI adds plain-language context for SS-4 resets so customers understand that a name correction invalidated the prior form.[2]

## API and idempotency rules

Webhook deliveries are deduplicated by `eventId` using the existing `llc_webhook_events` unique key. Required-action upserts are separately idempotent by `requiredActionId`.

Name submissions call `POST /v1/partner/companies/{companyId}/required-actions/{requiredActionId}/resolution`. The endpoint has no idempotency key; after any timeout or network error, the app must read the action back and treat an observed `submitted` state as success instead of retrying blindly.[3]

SS-4 actions are never posted to the generic resolution endpoint. The customer calls the existing signature-session endpoint, receives a short-lived URL, and the action closes only after signing is completed.[2]

## Notifications

Each action has one client notification claim keyed as `required_action:{requiredActionId}` in `llc_email_log`. A failed send releases the claim, allowing the heartbeat rescue sweep to retry. The email links to the tokenized filing status page, not to a provider-branded URL. An operations alert fires when an action opens and again if the client email cannot be delivered.

## Reconciliation

The existing `/api/scheduled/llc-status-poll` heartbeat will call the partner-wide open-action list (`size=100`, paging when needed) every run. Returned actions are upserted and notified. Locally open provider-backed actions missing from the latest complete provider list are refreshed individually before being closed, preventing a partial page or temporary inconsistency from clearing valid work. The existing per-company status refresh also synthesizes/clears legacy SS-4 work from `signatureRequirements`.

### Production scheduling

- Heartbeat name: `llc-status-sync`
- Task UID: `Kw8hcSzvxAAdzFBcKfoLr2`
- Callback: `POST /api/scheduled/llc-status-poll`
- Cron: `0 * * * * *` (every minute, UTC)
- `POLL_INTERVAL_MINUTES=10` remains active as fallback coverage. Production timestamps confirmed this fallback is currently reconciling the affected SS-4 action. The Heartbeat record is enabled, but its execution-history service returned no runs during deployment verification, so operations should monitor that task in the Schedules panel while the fallback remains active.

## Client and operations surfaces

The client status page receives a provider-neutral `requiredActions` array. Name actions render three inputs with one required name and a submit button. SS-4 actions render a “Sign updated SS-4” button that generates a fresh signing session at click time. Submitted name actions are read-only.

The operations view receives the same action fields plus provider IDs, history, source, notification timestamps, and a manual “Sync required actions” control. No Doola brand or raw provider payload appears in the client response.

## References

[1]: https://docs.doola.com/api/required-actions "Doola Developers — Required actions"
[2]: https://docs.doola.com/api/required-actions/ss4-reset "Doola Developers — SS-4 signature needed again"
[3]: https://docs.doola.com/api/required-actions/name-options "Doola Developers — New company names needed"
