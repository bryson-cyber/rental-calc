# LLC address choices (2026-10-14)

Where to find it: **LLC formation wizard → Step 3 · Address** (`client/src/components/llc-formation/AddressChoiceFields.tsx`), the review step, the order's status page (`/llc/status/:id`, signed in or from an email link), and the ops page (`/admin/llc`).

This is the rental-calc (Coach Inayah turnkey tool) port of the same fix made first in Her First Order. The four apps share one filing engine (`server/llc/`), so the rules, wording versions and payload mapping are the same in each app; each app holds and checks only its own orders.

## The case

On 2026-10-14 the owner reported a client's Oklahoma LLC, filed through a sibling app on this same engine. The state filing listed the registered agent's office as the company's principal place of business. The IRS EIN letter showed the same office. Banks and lenders compare the principal address on the Articles and the EIN letter address with the owner's real business address, so the mismatch cost the client. He asked: "this issue needs to be fixed for the future so this doesn't happen again", and for the sibling apps: "yes fix those too".

The filing provider told him: "A simple fix on your side is to let the client choose between their own address and [our] registered agent address at checkout, and send the order accordingly. Some states, like Illinois, don't even allow the registered agent address as the principal address, so asking for the client's own address is the safest default."

## The cause (same code in this app)

Step 3 asked one question, "Who receives legal mail for your LLC?", and stored one switch, `useRegisteredAgent`. That one switch decided three different things:

| Switch | Business address sent | Mailing address sent | What the client read |
|---|---|---|---|
| On ("Professional registered agent") | The agent's office | The agent's office | "A professional address receives state mail, not your home" |
| Off ("Use my own address") | The client's address | The client's address | "You handle legal mail yourself" |

So choosing the professional agent (for privacy) also made the agent's office the principal place of business and the mailing address. The "off" copy was also false: the filing service attaches its registered agent to every company in every mode, so the client never "handled legal mail" alone. The review said "Company mailing address" for the agent, the order sidebar listed "Your own registered-agent address" as not included, and the status page said "Company-provided address".

## What changed

Three separate facts now, each said plainly:

1. **Registered agent: always the included professional agent.** No toggle. One line on Step 3 says what it does. The order's registered agent service is unchanged (the provider attaches it to every company). The review, the status page and the order sidebar all say "Professional registered agent (included)".
2. **Your business address (principal place of business).** Default: **the client's own street address** (required, with a business phone). Option: "Use the registered agent's address instead", an explicit privacy opt-in. It needs a checkbox: "I understand my company's principal place of business on my state filing will be the registered agent's address, not mine. Banks may ask for proof of my own address, and changing it later is a paid state amendment." Not offered where the state refuses it (one-line reason shown, the option is a disabled button).
3. **Where should mail and your EIN letter go?** Default: **the client's business address**. Option: "Send it to the registered agent and show it to me in my account" (the old digital-mail behaviour). It tells the client the IRS EIN letter will then show the agent's address, and needs its own checkbox.

The review step shows "Principal place of business" and "Mail and EIN letter go to" right above the accuracy confirmation, with a "Fix address" button when final validation flags a Step 3 field. The status page shows the same lines. "You handle legal mail yourself", "Company mailing address", "Your own registered-agent address" and "Company-provided address" are gone. Step 1's phone help now says "Needed with your own address in Step 3." On a held order (below), the status page heading says "One quick choice before we file." and the banner after a card payment is headed "Payment received" and asks for the choice, instead of "You don't need to do anything else right now" and "you're all set".

Two more places said the old thing and were fixed with it:

- **The LLC tab's included list** (`client/src/components/LLCFormationStep.tsx`, where the client starts) said "Registered agent service: A professional address receives state and legal mail, not your home." That is no longer true by default (the client's own address is on the filing and her mail comes to her). It now reads "Professional registered agent: Included with every filing. It accepts official legal papers for your company, and you choose the address on your state filing and where your mail goes."
- **The two payment emails** (`server/llc/clientEmails.ts`). For a held order, "Payment received" no longer says "Your filing is now underway" and the payment reminder no longer says "your filing starts the moment it goes through" and "You're all set". Both say the one step left (confirm the business address and where mail goes on the filing page), that nothing is filed until it is saved, and link to the page with the confirm card. The wording switches on the same rule as the card (`addressChoiceNeeded`); every other order gets the same emails as before. An order already paid before this deploy has already had its "underway" email (send-once), so it gets no new email: ops sees the one-time hold alert and should reach out.

Details that keep it working:

- Step 3 merges the choices through `withAddressChoices` (`shared/llcAddress.ts`), which derives the old switch the way the server stores it, so the wizard's autosave settles instead of saving again and again.
- Picking Illinois or Idaho in Step 1 after choosing the agent's address moves the business address back to the client's own street address and clears that checkbox (`withFormationState`).
- A phone typed wrong in Step 3 says how to fix it, not "A business phone is required".
- The review shows "Not entered yet" where the client's own address is needed but empty (an old draft resumed past Step 3), never a label that looks filled in.
- This app's UI kit has no radio group, so the option cards are native buttons with `role="radio"`, 44px or taller, like the wizard's other choice cards.

### What is sent to the filing service

`server/llc/doola.ts` maps each entry on its own: `customer` sends the client's address (with the business phone), `registeredAgent` sends no address.

| Business | Mail | `addresses` |
|---|---|---|
| Client's (default) | Client's (default) | `customer` mailing + `customer` business |
| Client's | Agent | `registeredAgent` mailing + `customer` business |
| Agent (opt-in) | Client's | `customer` mailing + `registeredAgent` business |
| Agent (opt-in) | Agent (opt-in) | `registeredAgent` mailing + `registeredAgent` business |

Responsible party, members and requested services do not change. The mapper refuses (error `E_ADDRESS_CHOICE`, not retryable) any plan that breaks a rule, as the last line of defense behind the filing gate.

The legacy filing leg (`LLC_PROVIDER=whop`, opt-in only) has one switch for both addresses. Its switch now follows the business-address choice (`server/llc/whop.ts`), and submit refuses a split choice on that leg before the lock.

### Rules the server enforces

One rule set (`llcAddressPlanIssues` in `shared/llc.ts`) runs in Step 3, in final validation, in the filing gate, in the status-page confirmation and in the payload builder:

- The agent's address as the business address in a state that refuses it.
- Either opt-in without its acknowledgment (new orders need the current wording version).
- The client's own address used anywhere without a full street address: no PO box, no "c/o", plus a business phone.

**The filing gate** (`fileDoolaRegistration` in `server/llc/doolaSubmission.ts`, before the lock and before any provider call) holds an order that breaks a rule. In this app the filing starts from three places (the card payment webhook in `stripeCheckout.ts`, ops "Mark paid", and a client retry), so the gate alerts ops once per order through a send-once claim in `llc_email_log` (type `ops_address_choice_hold`), released when no channel delivered. The alert carries issue codes only, never address text. An order placed before this fix with the old switch on and nothing acknowledged is held this way, which is the case above.

The client then sees **"Confirm your business address and where mail goes"** on the status page (`ConfirmAddressCard.tsx`). It works signed in (`llc.confirmAddressChoices`) and from a tokenized email link without signing in (`llc.confirmAddressChoicesByToken`, the same pattern as the required-action cards; the status token is the credential, every failure answers the same NOT_FOUND, founder SSNs are blanked in the answer). The formation state is read from the order, never from the client. Nothing else on the order can change there. The submission key is cleared so the company is created with a fresh idempotency key (safe: no company exists yet). Once saved, the filing starts by itself if the payment is in; the card says so only in that case (`filingStartsOnAddressConfirm`, the same rule the route uses).

**Ops (`/admin/llc`)**: a held order shows an "Address choice needed" badge in the order list, and the order panel shows "Address choices" (principal place of business, mail and EIN letter, whether the order predates the split). Modes only, never address text. `llcOps.get` also returns `addressChoiceEvidence`.

### Data

New columns on `llc_registrations`, added at boot by `ensureLlcTables` (`server/llc/ensure-tables.ts`) from the list in `LLC_ADDRESS_COLUMN_SETS` (`server/llc/addressChoices.ts`), one `ADD` per column (`ensureAddressColumns`). A duplicate-column error is the quiet "already applied" on every boot after the first; any other failure (no ALTER privilege, a DDL timeout) is logged by column name, because every order read selects these columns and a quietly failed `ADD` would break the LLC pages while the boot still said "Schema ensured". All are NULL-able, so there is no backfill:

| Column | Meaning |
|---|---|
| `businessAddressMode`, `mailingAddressMode` | `customer` or `registered_agent` |
| `businessAgentAckAt`, `businessAgentAckVersion` | When, and under which wording, the client opted in to the agent's address as business address |
| `mailingAgentAckAt`, `mailingAgentAckVersion` | The same for mail at the agent |
| `addressChoiceEvidence` | JSON: `submitted` (submit lock), `sent` (filing lock), `confirmed` (status-page fix): modes, wording versions, times. Never address text |

`useRegisteredAgent` stays, readable by old clients and reports. Every save derives it: on only when both addresses are the agent's. A client's value is ignored, so an old browser tab can no longer send the agent's address by leaving the switch on.

How older orders read:

- **Drafts from before the fix** open with the new defaults: the client's own address, required. If the old switch was on, final validation and submit ask the client to save Step 3 first (`unsavedLegacyAddressChoiceErrors`), so the order on file, the `submitted` evidence and the filing gate all match what was confirmed.
- **Submitted and completed orders** are read through the old switch: on means the agent for both, off means the client's for both. Completed orders are unchanged. "Submitted" includes any order the filing service already has a company for, even in a status the store calls editable (a filed company in `action_required` that was paid offline has no checkout session), so its page says the agent's address it was filed with, never "Not entered yet" (`draftAddressChoices` in `server/llc/domain.ts`).
- **Test runs and demo filings** never reach the provider and are never held. The demo filing now shows the new defaults (the client's own street address).

Wording versions live in `shared/llcAddress.ts`. Change the text only with a new version. Keep old versions in the accepted lists so orders acknowledged under them still file.

Not applicable in this app: Her First Order also writes the member's business profile at completion ("Professional registered agent" in every mode). This app has no completion profile, so there is nothing to change there.

## States

The agent's address cannot be the business address:

| State | Rule | Source |
|---|---|---|
| Illinois | The Secretary of State refuses a registered agent service's address, a PO box or "c/o" for the principal place of business | G&G Law Offices (2025-01-13); Form LLC-5.5 ("P.O. Box alone or c/o is unacceptable"); the filing provider. Bills HB 4341 / SB 2816 stalled in 2026 |
| Idaho | Allowed only with an attestation that the only physical location is residential AND the agent's consent; this flow collects neither | Idaho Certificate of Organization form rev. 04/2026 (via ezel.ai survey) |

Checked and **not** blocked:

- **Delaware:** the bar applies only to corporations' annual reports (8 Del. C. § 502(a)(3)). A Delaware LLC certificate has no principal-office field.
- **North Carolina:** N.C.G.S. 57D-2-21 makes the principal office optional and states no bar.
- **Virginia:** Va. Code § 13.1-1011(A)(3) says the principal office "may be the same as the registered office".

Street address required (no PO box) for the principal office: Illinois, Oklahoma (form 0074 item 2), California, Tennessee, Maryland, Florida (§ 605.0201(2)(b)), and the IRS SS-4 line 5a in every state. The app applies the street-address rule in every state.

No principal-office field on the formation document: DE, NY, PA, TX, NV, MI, MS, NJ, SC, OH, ME, AL, KS. There, the business entry affects the provider's record and the EIN path.

## The EIN letter (not promised)

The provider's docs (changelog 2026-10-13) say the EIN letter does not follow the `mailing` entry. On the SS-4 path the SS-4 gives the agent's address for the letter. On the online path the provider retrieves the letter digitally. Either way a copy reaches the client's account.

So the client copy promises only two things:

- With mail at the agent, the letter **will** show the agent's address.
- Either way, a copy is in the client's account, and IRS Form 8822-B (free) updates the address the IRS has.

## Tests

`server/llc/addressChoices.test.ts`, `addressChoices.clarity.test.ts`, `addressChoices.filing.test.ts`, `addressChoices.router.test.ts`, `addressChoices.store.test.ts`, `addressChoices.filed.test.ts` (a filed company in an editable status still shows what was filed), `addressChoices.schemaGuard.test.ts` (the boot guard logs a column that could not be added), `addressChoices.held.test.ts` (what a held order's emails, banner and the LLC tab say), plus new cases in `submission.unit.test.ts` and `whop.test.ts`. Moved pins carry `// Pin moved (2026-10-14)` in `doola.test.ts`, `llc.validation.test.ts`, `whop.test.ts` and `demo.test.ts`. The provider's API is never called (fetch is stubbed, the key is fake).

## Before go-live in this app (owner action)

1. Deploy, then confirm the boot log shows "[LLC] Schema ensured" (the new columns are added by the same boot check as every other LLC column).
2. Count this app's held orders (live database, counts only). Common filters: `isTest = 0`, `provider = 'doola'`, no `doolaCompanyId`, status `payment_required`, `failed` or `action_required`, and not an `uncertain_` error. Then two groups: (a) `useRegisteredAgent = 1` and no `businessAddressMode` (the old switch, the case above); (b) `useRegisteredAgent = 0` whose own address would now be refused: no `businessPhone`, or a street line containing "box" or "c/o". Both groups show the confirm card and ring ops once when the order next heads to filing. Not checked from this session (no live database access here).
3. An order with an `uncertain_` error and the old switch on (a filing that may have reached the provider before this fix) is held at filing but gets no confirm card, because it must not be edited. Ops resolves it by hand from the order page; there is no client step for it.

## Open questions for the provider (owner action, shared with the other apps)

1. Please confirm in sandbox that the reverse mix is accepted: `customer` business with `registeredAgent` mailing. The docs show only the opposite example, though their per-entry rule allows it.
2. On the online EIN path, which address goes on the IRS application as the physical location, and which as the mailing address? On the SS-4 path, can line 4a/5a carry the client's own business address instead of the agent's?
3. When both entries are `customer`, does the RegisteredAgent service stay attached? The docs and the OpenAPI example say yes. Please confirm for production orders.
4. Is a PO box ever accepted for a `customer` mailing entry? The app refuses one today, to be safe.
