/**
 * Deal walkthrough — the top of a rental-arbitrage /share report.
 *
 * A guided, plain-English read of one deal for our clients: the money, why
 * it's safe, what it takes to start, proof they can check, and how to reach
 * the top earners. Each section says what the client is looking at. The full
 * analysis (TeslaDashboard) continues below it on the same page.
 *
 * Numbers come from the server's deterministic facts (`_dealFacts`); Claude
 * only writes the prose (`_dealBrief`). See server/deal-brief.ts and
 * server/deal-page.ts.
 */

import type { ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

interface DealBriefComp {
  title: string;
  url?: string;
  imageUrl?: string;
  annualRevenue: number;
  occupancy: number;
  adr: number;
  distanceMiles?: number;
}

export interface DealFacts {
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  monthlyRevenue: number;
  adr: number;
  projectedOccupancy: number;
  dataModelMonthlyRevenue: number;
  slowYearMonthlyRevenue: number;
  slowYearMonthlyProfit: number;
  expenseRatio: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  breakEvenOccupancy: number;
  marketMedianOccupancy: number;
  startupCost: number;
  paybackMonths: number | null;
  annualCashOnCash: number;
  comps: DealBriefComp[];
}

export interface DealBrief {
  headline: string;
  summary: string;
  whyItWorks: string[];
  upsideMoves: Array<{ move: string; why: string }>;
  watchOuts: Array<{ risk: string; howTopOperatorsHandleIt: string }>;
  closingNote: string;
}

const usd = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Section({
  step,
  title,
  explainer,
  children,
}: {
  step: number;
  title: string;
  explainer: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F172A] font-semibold text-[#C9A962]">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-600">
              What you're looking at:{" "}
            </span>
            {explainer}
          </p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function MoneyRow({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "minus" | "total";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${tone === "total" ? "border-t-2 border-slate-900" : "border-t border-slate-100"}`}
    >
      <span
        className={
          tone === "total" ? "font-semibold text-slate-900" : "text-slate-600"
        }
      >
        {label}
      </span>
      <span
        className={`whitespace-nowrap ${tone === "total" ? "text-2xl font-bold text-emerald-700" : tone === "minus" ? "font-medium text-slate-500" : "font-medium text-slate-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Horizontal 0–100% bar with a marker for break-even and one for the market. */
function OccupancyBar({
  breakEven,
  market,
}: {
  breakEven: number;
  market: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n)) * 100;
  return (
    <div className="mt-2">
      <div className="relative h-4 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-amber-200"
          style={{ width: `${clamp(breakEven)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-emerald-300"
          style={{
            left: `${clamp(breakEven)}%`,
            width: `${Math.max(0, clamp(market) - clamp(breakEven))}%`,
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-200" /> Booked{" "}
          {pct(breakEven)} = you break even
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-300" /> Similar homes
          are booked {pct(market)}
        </span>
      </div>
    </div>
  );
}

export function DealWalkthrough({
  facts,
  brief,
  imageUrl,
}: {
  facts: DealFacts;
  brief?: DealBrief | null;
  imageUrl?: string;
}) {
  const cushion = facts.marketMedianOccupancy - facts.breakEvenOccupancy;

  return (
    <div className="mb-10 space-y-6">
      {/* Headline */}
      <div className="overflow-hidden rounded-2xl bg-[#0F172A]">
        {imageUrl && (
          <img
            onError={e => (e.currentTarget.style.display = "none")}
            src={imageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        )}
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold text-[#C9A962]">
            Why this deal works
          </p>
          <p className="mt-2 font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {brief?.headline ||
              `${usd(facts.monthlyProfit)}/mo after rent and expenses`}
          </p>
          {brief?.summary && (
            <p className="mt-4 max-w-3xl text-lg text-white/75">
              {brief.summary}
            </p>
          )}
          <p className="mt-4 text-sm text-white/50">
            {facts.bedrooms} bed · {facts.bathrooms} bath ·{" "}
            {usd(facts.monthlyRent)}/mo rent
          </p>
        </div>
      </div>

      <Section
        step={1}
        title="The money"
        explainer="what this home earns each month on Airbnb, minus what you pay the landlord and what it costs to run. What's left is yours."
      >
        <MoneyRow
          label="Airbnb revenue (optimized scenario)"
          value={`${usd(facts.monthlyRevenue)}/mo`}
        />
        <MoneyRow
          label="Rent to landlord"
          value={`− ${usd(facts.monthlyRent)}`}
          tone="minus"
        />
        <MoneyRow
          label={`Running costs (${pct(facts.expenseRatio)} — cleaning, utilities, supplies, fees)`}
          value={`− ${usd(facts.monthlyExpenses)}`}
          tone="minus"
        />
        <MoneyRow
          label="Your profit"
          value={`${usd(facts.monthlyProfit)}/mo`}
          tone="total"
        />
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Optimized scenario</strong> means what a well-run,
          well-furnished listing earns here ({usd(facts.adr)}/night,{" "}
          {pct(facts.projectedOccupancy)} booked). Big data models show a
          typical, unoptimized listing at {usd(facts.dataModelMonthlyRevenue)}
          /mo — they're built conservative.
        </p>
      </Section>

      <Section
        step={2}
        title="Why it's safe"
        explainer="how many nights a month you need booked just to cover rent and costs, compared with how booked similar homes nearby already are. The bigger the gap, the safer the deal."
      >
        <OccupancyBar
          breakEven={facts.breakEvenOccupancy}
          market={facts.marketMedianOccupancy}
        />
        {cushion > 0 && (
          <p className="mt-4 text-slate-700">
            You only need <strong>{pct(facts.breakEvenOccupancy)}</strong> of
            nights booked. Similar homes already get{" "}
            <strong>{pct(facts.marketMedianOccupancy)}</strong> — a{" "}
            <strong>{Math.round(cushion * 100)}-point cushion</strong>.
          </p>
        )}
        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">Slow-year test</p>
          <p className="mt-1 text-sm text-slate-600">
            If this home only earned like the bottom 25% of nearby listings (
            {usd(facts.slowYearMonthlyRevenue)}/mo), you'd still{" "}
            {facts.slowYearMonthlyProfit >= 0 ? "keep" : "be at"}{" "}
            <strong
              className={
                facts.slowYearMonthlyProfit >= 0
                  ? "text-emerald-700"
                  : "text-amber-700"
              }
            >
              {usd(facts.slowYearMonthlyProfit)}/mo
            </strong>{" "}
            after rent and costs.
          </p>
        </div>
      </Section>

      <Section
        step={3}
        title="What it takes to start"
        explainer="your one-time launch budget (furniture, setup, deposit and first month) and how fast the profit pays it back."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Launch budget
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {usd(facts.startupCost)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Paid back in
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {facts.paybackMonths != null
                ? `${facts.paybackMonths.toFixed(1)} months`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Year-one return
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {pct(facts.annualCashOnCash)}
            </p>
            <p className="text-xs text-slate-500">
              year of profit ÷ launch budget
            </p>
          </div>
        </div>
      </Section>

      {brief && brief.whyItWorks.length > 0 && (
        <Section
          step={4}
          title="The case for this deal"
          explainer="the strongest reasons this deal works, tied to the numbers above."
        >
          <ul className="space-y-3">
            {brief.whyItWorks.map((point, i) => (
              <li key={i} className="flex gap-3 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                {point}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {facts.comps.length > 0 && (
        <Section
          step={brief ? 5 : 4}
          title="Check the proof yourself"
          explainer="real Airbnb listings near this home with their actual earnings. Tap any of them to see it live on Airbnb."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {facts.comps.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#C9A962]"
              >
                {c.imageUrl && (
                  <img
                    onError={e => (e.currentTarget.style.display = "none")}
                    src={c.imageUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {c.title}
                  </p>
                  <p className="font-semibold text-emerald-700">
                    {usd(c.annualRevenue)}/yr
                  </p>
                  <p className="text-xs text-slate-500">
                    {pct(c.occupancy)} booked · {usd(c.adr)}/night
                    {c.distanceMiles != null
                      ? ` · ${c.distanceMiles.toFixed(1)} mi away`
                      : ""}
                  </p>
                  {c.url && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#C9A962]">
                      View on Airbnb <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {brief &&
        (brief.upsideMoves.length > 0 || brief.watchOuts.length > 0) && (
          <Section
            step={facts.comps.length > 0 ? 6 : 5}
            title="How to win this deal"
            explainer="what the top-earning listings nearby do differently, and the few things good operators keep an eye on."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              {brief.upsideMoves.length > 0 && (
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <TrendingUp className="h-5 w-5 text-blue-600" /> Reach the
                    top earners
                  </p>
                  <ul className="mt-3 space-y-3">
                    {brief.upsideMoves.map((m, i) => (
                      <li key={i}>
                        <p className="font-medium text-slate-900">{m.move}</p>
                        <p className="text-sm text-slate-600">{m.why}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.watchOuts.length > 0 && (
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldCheck className="h-5 w-5 text-amber-600" /> Keep an
                    eye on
                  </p>
                  <ul className="mt-3 space-y-3">
                    {brief.watchOuts.map((w, i) => (
                      <li key={i}>
                        <p className="font-medium text-slate-900">{w.risk}</p>
                        <p className="text-sm text-slate-600">
                          {w.howTopOperatorsHandleIt}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

      {brief?.closingNote && (
        <p className="px-2 text-center font-serif text-xl text-slate-800">
          {brief.closingNote}
        </p>
      )}

      {/* Same ask as the team's Slack message — turn the read into a decision */}
      <div className="rounded-2xl border-2 border-[#C9A962] bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-[#9E7B2F]">Your next step</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-slate-900">
          Reply in Slack with your decision
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">1</p>
            <p className="font-medium text-slate-900">I'm interested</p>
            <p className="text-sm text-slate-600">
              We'll start moving toward the lease signing.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-500">2</p>
            <p className="font-medium text-slate-900">Not interested</p>
            <p className="text-sm text-slate-600">
              Tell us the main reason (location, rent, property size, or
              build-out cost) so we can send better matches.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Availability can change, so reply when you can.
        </p>
      </div>
    </div>
  );
}
