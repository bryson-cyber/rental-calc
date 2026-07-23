# Webinar Follow-Up Personalization Plan

Goal: raise master class show-up rate by using the soft-credit-pull results and the
tool's own research data (property runs, market metrics, regulations, deal scans) to
send each lead the message that matches their situation.

Everything in this plan maps to systems that already exist in this repo. New pieces
are marked **NEW**.

> **Status:** the market/property personalization layer (section 8) is implemented in
> this PR. The funding-segment layer (sections 2 and 4's segment-specific sequences)
> is designed here but not yet wired — it needs the consent-language review in
> section 7 first.

---

## 1. Short plan

1. When the funding partner (0percentfunded) returns a soft-pull report, compute a
   **funding segment** from the report fields and store only coarse, derived bands
   (never the raw report — same posture `fundingSystem.ts` already takes).
2. Enrich the lead with a **market overlay** from their zip: regulation status
   (`regulation_cache`), market metrics (cached AirDNA), and 2–3 live rentable
   properties (`newsletter_deals` / comps) with tracked links (`personalized_links`).
3. Route registrants into **segment-variant copy** inside the existing reminder
   machinery: `scheduled_sms_messages` + SMS Dispatcher V2 for texts,
   `reminder-scheduler.ts` + HubSpot SMTP for email. Same cadence skeleton for
   everyone; the hook, proof, and CTA change per segment.
4. Measure show-up rate per segment against a generic holdout, one A/B variable at a
   time.

Compliance posture (non-negotiable, details in section 7): credit data never appears
in a message, never in a subject line, never in an SMS. Messages reference "your
results" only in ways the lead already saw on their authenticated results screen.

---

## 2. Segmentation strategy

### Inputs we already get from the soft pull

From the partner report API (`server/_core/fundingSystem.ts`):

| Field | Notes |
|---|---|
| `fico` | Sanitized 300–850 |
| `fundingRange` low/mid/high | Partner's estimated business-funding range |
| `readiness` | Partner's readiness rating |
| `creditFactors.utilization` | Aggregate revolving utilization |
| `creditFactors.hardInquiries` | Last 6 months |
| `creditFactors.latePayments` | Last 2 years |
| `creditFactors.collections` | Open/closed counts |
| `creditFactors.creditAge` | Age of file |
| `creditFactors.totalAccounts`, `totalCreditLimit` | Depth + total open revolving limit |
| Report body | Open mortgage present, freeze/fraud flags, city/state/zip |
| `fundingTimeline` (self-reported at intake) | `30_days` / `60_90_days` / `just_exploring` (gated — no pull) |

### Primary segments

Rules run top-down; first match wins. Version them (`SEGMENT_RULES_V1`).

| Segment | Rule (v1) | Situation | Messaging angle |
|---|---|---|---|
| **Green Light** | fico ≥ 680 AND utilization < 30% AND no open collections AND no lates (2y) AND fundingRange.mid ≥ $25k | Capital access is basically solved | "You're closer than you think. The class shows you how to put funding to work on a first unit — here are real properties near you that pencil." Emphasis: speed, specific deals, deployment. |
| **Almost There** | fico 620–679 OR utilization 30–60% OR creditAge < 5y (thin file), AND no open collections | One or two fixable gaps | "There's a short path between you and funding-ready. The class covers the 30–60 day prep and how people start lean in the meantime." Emphasis: roadmap, momentum, what's possible now. |
| **Creative Start** | fico < 620 OR open collections OR utilization > 60% OR fundingRange.low < $10k | Traditional funding is not the move right now | "You don't need big startup capital to start. Co-hosting, partnering, and lease-option routes — the class covers the low-capital playbook." Emphasis: proof it works without funding. **Copy never references credit, debt, or 'fixing' anything.** |
| **Explorer** | Pull gated (`just_exploring`), failed, frozen, or no-hit | No credit signal | General value track: market data + property examples only. Curiosity angle. |

### Overlays (applied to every segment)

Overlays change tokens and one content block, not the sequence.

| Overlay | Source | Effect on messaging |
|---|---|---|
| **Market/regulation** | zip → market (cached AirDNA hierarchy) + `regulation_cache.status` | Green (`allowed`, `allowed_with_permit`): lead with their city + local properties. Yellow (`limited`/`pending`/`paused`): "here's what the rules actually say" angle. Red (`restricted`/`banned`): pivot to nearest friendly market — "45 min from {city}, {market} allows STR." |
| **Property module** | `newsletter_deals` for their city (else top cached comps) | 2–3 deal cards: beds, rent, projected revenue, margin. Tracked via `personalized_links`. This is the "run properties" hook. |
| **Homeowner** | Open mortgage on report | Adds rent-by-room / house-hack framing to Green Light and Almost There. |
| **Timeline** | `fundingTimeline` | `30_days`: tighter urgency, direct CTA. `60_90_days`: planning frame. `just_exploring`: no urgency language. |
| **Own report** | `analysis_reports` row exists for their email | Reference their own run: "your {city} report came back {verdict}." Strongest personalization we have — use it whenever present. |
| **Timezone** | zip → tz | All SMS sends in lead-local time, inside quiet hours. |

---

## 3. What to personalize in the funnel

| Funnel element | Personalize with | Example |
|---|---|---|
| **Email subject** | City + segment hook. Never credit terms. | "3 Airbnb-ready units near Henderson that fit the rules" |
| **Preview text** | Market stat or deal teaser | "One comps at $4,100/mo. Walkthrough Sunday." |
| **Email body** | Segment intro block + property module + regulation snippet (`yesNoSummary`) + segment CTA | See section 4 |
| **SMS copy** | First name + city + one segment hook per message | See section 4 |
| **Timing** | Lead-local timezone; identical relative cadence for all segments | 24h / morning-of / 2h / 30m / live |
| **CTA** | Segment-matched pre-class asset | Green Light: funding deployment checklist. Almost There: 60-day readiness checklist. Creative Start: $0-down co-hosting case study. Explorer: market report for their city. |
| **Landing/thank-you page** | Property teasers for their market + countdown + add-to-calendar | The LeadMagnet already renders property cards — reuse components on the confirmation screen |
| **Replay/no-show page** | Same segment framing carried through | "The part on {segment topic} starts at 12:40" |

Not worth personalizing (v1): send cadence per segment, email design, webinar content
itself. Keep one skeleton so results are comparable.

---

## 4. Message sequence drafts

Cadence skeleton (all segments, times relative to class start, SMS in lead-local time):

| Touch | Channel | When |
|---|---|---|
| T0 | SMS + email | At registration (confirmation — exists today, keep) |
| T0+15m | Email | "Your numbers + properties near you" (the personalization workhorse) |
| −48h | Email | Segment story / proof |
| −24h | Email + SMS | Reminder with segment hook |
| Morning of | SMS | Day-of nudge |
| −2h | Email | Join link, one line |
| −30m | SMS | Final nudge |
| 0 | SMS | "Doors open" (same for all) |
| Post | Existing attended / no-show branches | Carry segment framing into no-show copy |

Tokens: `%FIRST_NAME%` (SMS), HubSpot contact tokens (email), `{city}`, `{market}`,
`{deal_*}` from the property module, `{short_link}` from `personalized_links`.

All first-touch SMS keep the existing "Save this number! - Inayah" convention; STOP
language stays in the SimpleTexting opt-in flow. Revenue numbers in copy must be the
labeled, unboosted comp figures (see section 7).

### Segment: Green Light

**T0+15m email**
Subject: `3 units near {city} that fit the rules`
Body:

> Hey {firstname},
>
> Your funding readiness results are in — you can see them on your results page.
> Short version: you're in a strong position to start. So I pulled properties, not theory.
>
> [3 deal cards: "2BR · {city} · rent $1,850 · comps project $4,100/mo · margin 54%"]
>
> {Regulation snippet: "Short-term rentals are allowed in {city} with a permit. I'll cover what that means in class."}
>
> Sunday I'm walking through how to go from funded to first unit — including how I'd run
> the numbers on the first card above, live.
>
> [Add to calendar] · [Get the funding deployment checklist]
>
> — Inayah

**−48h email** — emphasis: cost of waiting. Subject: `The unit in {city} won't wait`.
Story of a student who had capital ready, sat on it 6 months, then moved — with the
before/after monthly numbers. CTA: add to calendar.

**−24h SMS**
`Hey %FIRST_NAME%, it's Inayah. Class is tomorrow at {time}. I'm breaking down a {city} unit that comps at {deal_monthly}/mo — bring your funding questions. {short_link}`

**Morning-of SMS**
`%FIRST_NAME%, tonight's the walkthrough. I'm showing exactly how to put startup capital to work on unit #1. See you at {time}. {short_link}`

**−2h email** — Subject: `Doors at {time} — your seat's saved`. Two lines + join link.

**−30m SMS**
`30 minutes. I open with the {city} property breakdown, so don't be late. Join: {short_link}`

**Live SMS** (all segments)
`We're LIVE %FIRST_NAME%. Grab your seat: {short_link}`

### Segment: Almost There

**T0+15m email**
Subject: `Your {city} numbers + the 60-day plan`
Body:

> Hey {firstname},
>
> Your results are on your results page. You're closer than most people who register —
> a couple of moves over the next 30–60 days and the funding conversation changes.
>
> While that clock runs, the market doesn't stop:
>
> [3 deal cards]
>
> {Regulation snippet}
>
> Sunday's class covers both tracks: what to do now with what you have, and how to be
> funding-ready by {month}. People start lean all the time — I'll show you how.
>
> [Add to calendar] · [Get the 60-day readiness checklist]
>
> — Inayah

**−48h email** — emphasis: someone like them. Subject: `She started before she was "ready"`.
Case study of a student who began co-hosting while prepping for funding, then scaled.
No credit language.

**−24h SMS**
`Hey %FIRST_NAME%, it's Inayah. Tomorrow at {time} I'm covering the exact 60-day plan I give students who want to start on Airbnb the right way. You're on the list. {short_link}`

**Morning-of SMS**
`%FIRST_NAME%, tonight I'll show you what to do in the next 60 days — and what you can start this week in {city}. {time}. {short_link}`

**−30m SMS**
`Starting in 30. The 60-day roadmap is the middle section — be there from the top so it lands. {short_link}`

### Segment: Creative Start

**T0+15m email**
Subject: `How people start on Airbnb in {city} with almost nothing down`
Body:

> Hey {firstname},
>
> Thanks for running your numbers. Here's what most people don't know: a big chunk of my
> students didn't start with funding. They started with someone else's property.
>
> Co-hosting. Partnering with owners. Lease-option deals. The class covers all three.
>
> And your market still matters, so here's what's near you:
>
> [3 deal cards]
>
> {Regulation snippet}
>
> Sunday I'll show the $0-down route first, step by step.
>
> [Add to calendar] · [Watch the co-hosting case study]
>
> — Inayah

**−48h email** — emphasis: proof without capital. Subject: `He managed 4 units before he owned a lease`.
Co-hosting case study with real monthly numbers and the exact first outreach message
the student used. CTA: add to calendar.

**−24h SMS**
`Hey %FIRST_NAME%, it's Inayah. Class is tomorrow at {time}. First section: how to earn from Airbnb without leasing or owning anything. That one's for you. {short_link}`

**Morning-of SMS**
`%FIRST_NAME%, tonight at {time}: the low-capital playbook, start to finish. Real students, real numbers, nothing to buy first. {short_link}`

**−30m SMS**
`30 min out. I open with the $0-down route — don't miss the first 15 minutes. {short_link}`

### Segment: Explorer (summary)

Same skeleton, no funding framing at all. Hooks are market data + properties only:
T0+15m subject `What Airbnbs actually earn in {city}` (market metrics + deal cards +
regulation snippet). Reminders tease "the {city} market breakdown." If the pull was
blocked by a credit freeze, one neutral line on the results page only — never in
email/SMS.

---

## 5. Technical outline

### Data to store (**NEW** table `lead_segments`)

Derived bands only. Raw report data stays with the partner (current
`funding_connections` posture — keep it).

```
lead_segments
  id, email (idx), phone, userId?
  segment            enum: green_light | almost_there | creative_start | explorer
  scoreBand          enum: A|B|C|D            -- band, not the score
  fundingBand        enum: high|mid|low|none  -- from fundingRange.mid
  utilizationBand    enum: low|mid|high
  hasMortgage        bool
  fundingTimeline    varchar
  city, state, zip, timezone
  marketId, marketName
  regStatus          varchar                   -- from regulation_cache
  dealIds            json                      -- up to 3 newsletter_deals refs
  ownReportId        int?                      -- analysis_reports match by email
  rulesVersion       varchar ('v1')
  computedAt, updatedAt
```

Mirror three fields to HubSpot contact properties via the existing sync
(`nurture-sequence-service.ts` path): `funding_segment`, `market_reg_status`,
`top_deal_url` — so HubSpot-side emails can token them too.

### Trigger flow

```
Soft pull completes (funding.ts poll → report ready)
  → computeSegment(report, intake)            **NEW** pure function, versioned
  → upsert lead_segments
  → enrichMarket(zip):                        all reads hit existing caches
      airdna-hierarchy zip→market (30d cache)
      regulation_cache city lookup (7d TTL, refresh via regulation-tracker if stale)
      top 2–3 newsletter_deals for city (else top cached comps)
      create personalized_links per lead (campaignType: webinar_deals)
  → tag webinar_registrants (match email/phone): tags += segment
  → sync HubSpot contact properties
Explorer path: registration without a completed pull gets segment=explorer immediately,
upgraded in place if a pull completes later.
```

### Routing into flows

One sequence skeleton, segment-variant copy — not four parallel automations:

- **SMS**: add nullable `segment` column to `scheduled_sms_messages` (null = everyone).
  Seed each slot with per-segment bodies; Dispatcher V2's claim query adds
  `AND (segment IS NULL OR segment = registrant.segment)`. Audience targeting
  (`all/attended/not_attended`) already works — this composes with it.
- **Email**: `reminder-scheduler.ts` selects the template variant by registrant tag;
  fall back to the generic template when no tag. The T0+15m and −48h emails are two
  **NEW** slots in `webinar_reminder_schedule` (or a small sibling table), same cron.
- **Quota**: no per-lead AirDNA calls at send time. Market enrichment reuses
  `newsletter_cities` cached metrics and the deal scanner's output; leads in the same
  market share one lookup. Nightly batch stays far under the 400/day non-admin gate.
- **Fallbacks**: pull failed/gated → explorer. Zip with no market coverage → national
  example deals. SMS opt-out or missing phone → email-only. STOP and unsubscribe
  suppression already handled by SimpleTexting + `email_optins.unsubscribedAt` — honor
  both before every send.

### A/B plumbing

Deterministic assignment at registration: `hash(email) % 100` → variant. Store
`variant` + `rulesVersion` in `webinar_registrants.metadata`. Log every send with
variant (SMS: `webinar_sms_deliveries`; email: `email_send_log`) so measurement is a
join, not a reconstruction.

---

## 6. Metrics + A/B test plan

### Metrics (all measurable with existing tables)

| Metric | Definition | Source |
|---|---|---|
| **Show-up rate** (primary) | attended / registered | `webinar_registrants.attended` |
| Stay-through | attended ≥ X min, if WebinarJam exposes it | registrant metadata |
| Email click rate | clicks / delivered (opens are unreliable — Apple MPP) | `link_clicks`, `email_send_log`, `newsletter_sends` |
| Deal-card CTR | property link clicks / delivered | `personalized_links.clickCount` |
| SMS delivery + reply rate | delivered, inbound replies | `webinar_sms_deliveries`, SimpleTexting |
| Add-to-calendar rate | invite accepts / sent | `webinar_reminder_schedule` results |
| Unsub / STOP rate (guardrail) | per message sent | `email_optins.unsubscribedAt`, SimpleTexting STOP |
| Downstream | replay views, call bookings, offer take rate — read per segment | existing funnels |

Always read results **per segment**: personalization that lifts Green Light can flatten
Creative Start; the blend hides it.

### A/B plan

**Test 1 — does personalization work at all?**
- Arms: A = current generic sequence, B = personalized (this plan). 50/50 at
  registration, stratified by segment.
- Primary metric: show-up rate. Guardrails: STOP rate > 3% or unsub > 1.5% on any
  message pauses that message.
- Size: detecting 30% → 38% show-up at 80% power needs ~550 registrants per arm. At a
  few hundred registrants/week, plan 3–5 weekly classes per test. Don't peek per class;
  read at the planned N.
- Keep a permanent 10% generic holdout after rollout so drift stays measurable.

**Then, one variable at a time, in impact order:**
1. Property module on/off inside the personalized arm (isolates the "run properties" hook)
2. −30m SMS copy (largest single lever on show-up)
3. T0+15m subject: city-led vs deal-led
4. −48h story email on/off (does the extra touch add show-ups or just unsubs?)
5. Morning-of send time: 9am vs 12pm lead-local

Each test: one variable, same stratification, same guardrails, log variant per send.

---

## 7. Compliance guardrails

Not legal advice — have counsel review the consent flow before launch. But these are
the design rules the plan is built around:

1. **FCRA — permissible purpose.** The pull runs on the consumer's written
   instructions (consent + IP + timestamp already captured). Make sure the consent
   language explicitly covers using results to tailor the education and funding
   options shown to them. If it doesn't yet, that's a blocker, not a nice-to-have.
2. **No credit data in messages. Ever.** Not the score, not balances, not "your
   utilization," not segment names that imply creditworthiness. Messages may say
   "your results are on your results page" — the details live only behind auth.
   SMS previews sit on lock screens; email gets forwarded.
3. **No firm-offer language.** "You're approved for $50k" is a prescreening/UDAP
   problem and it isn't true. The partner's range framing stays on the results page.
4. **TCPA.** SMS only to leads with SMS consent (`wantsSmsAlerts`, not `optedOut`),
   lead-local quiet hours (8am–9pm, tighter where state law says so), STOP honored
   instantly. The timezone field in `lead_segments` exists for this.
5. **Income claims.** Use comp-based, labeled projections ("comps within 2 miles
   project…"). Note: the product applies a 1.3× revenue boost factor internally —
   outbound marketing copy should use unboosted comp figures, or the claim isn't
   substantiable.
6. **CROA.** Almost There copy never promises credit improvement or sells credit
   repair. "Funding readiness prep" framing only, and keep it educational.
7. **Data minimization.** Raw reports stay with the partner. Locally: bands and the
   segment only, versioned, with a retention window aligned to the lead lifecycle.

---

## 8. v1 implementation (shipped with this PR)

The "run properties" personalization layer is live in code. Every registrant gets a
city/deal/regulation context attached, and every reminder can reference it — the
class demos San Diego live; the messages show each lead their own market before
they ever get to class.

### Pipeline

The audience is unaware — they opted into a webinar and have never touched the
tool. So the system runs the tool for them: it looks up their city (from the
opt-in / soft-pull address in HubSpot), then generates the Step 4 research —
real rentable listings, revenue projections, regulations — for that city.

```
Import cron (every 3 min, runWebinarImportInner)
  → Phase 1 (awaited, fast): enrichWebinarRegistrants()
      location:  HubSpot contact (data_perfection__city/state/postal_code —
                 populated from the opt-in / soft-pull flow; standard
                 city/state/zip as backup)
                 else email_optins (their stated city)
                 else analysis_reports (tool run — rare bonus, last resort)
      market:    newsletter_cities cached stats
      deal:      best claimable newsletter_deals row for their city
                 (dealScore desc, ≤30 days old; claims gated at ≥$1,000/mo
                 profit — the class's own floor)
      regs:      regulation_cache (status "unknown" rows are ignored)
      link:      personalized_links row, tool URL pre-targeted to their city
      stored in: webinar_registrants.metadata.personalization
  → confirmation SMS/email render with the payload (same cron cycle)
  → Phase 2 (detached, slow): runLiveCityScansForWebinar()
      for lead cities with no deals or no regulation data:
        searchZillowRentals (HasData, 5 credits) → top 3 listings →
        analyzePropertyForArbitrage (rentalizer/BNB Calc: revenue, profit
        after rent + 20% opex, deal score) → newsletter_deals rows
        getRegulationInfo (cached-or-live research, 7-day TTL)
      then re-computes and upgrades every lead in that city
      bounds: 2 cities per cycle, 24h retry on dry cities, kill switch via
      webinar_sms_settings key personalization_live_scan = "off"
Manual add (addRegistrant) computes the payload inline before the instant sends.
```

### Message tokens

SMS templates (sequence slots, confirmation template, campaigns) support, with safe
generic fallbacks: `%CITY%`, `%STATE%`, `%MARKET%`, `%DEAL_RENT%`, `%DEAL_REVENUE%`,
`%DEAL_PROFIT%` (all monthly), `%DEAL_LINK%` / `%TOOL_LINK%`.

Conditional blocks keep claims honest per recipient — a message never asserts a
local property unless that lead actually has one on file:

- `[IF_DEAL]...[/IF_DEAL]` — renders only when a real scanned deal with real
  numbers exists for their city
- `[IF_CITY]...[/IF_CITY]` — renders when we know their city
- `[IF_CITY_ONLY]...[/IF_CITY_ONLY]` — city known but no deal (either/or copy)

The default 11-slot sequence seeds and the evergreen confirmation template now use
these hooks (regenerate the sequence from admin to pick them up; existing scheduled
rows are not rewritten).

### Emails

`buildWebinarEmail` accepts an optional `personalization` payload and renders a
"Near {city}" card (local deal + their own report line + regulation one-liner +
tracked "see properties near {city}" link) in the confirmation, 2-days, day-before,
and morning-of emails. The day-before subject line personalizes to the city when
known. Emails without a payload render exactly as before.

### Transcript-locked class beats used in the copy

From the master class transcript: the live research demo (regulations check → Zillow
listings → revenue/comps analysis), the $1K–$3K/mo per-property profit target, the
$10K–$20K startup range or business credit path, the Landlord "Yes" pitch video and
lease addendum, and the stay-to-the-end free course bonus. Copy teases these beats
and attaches the lead's own market to them; income figures in templates stay within
what the class itself claims.

### Measurement hooks

Deal-link clicks accrue on `personalized_links` (campaignType `webinar_deals`) via
`clickCount`/`link_clicks`. Compare show-up rate for registrants with
`metadata.personalization` present vs absent as a first natural experiment, then run
the section 6 A/B properly.
