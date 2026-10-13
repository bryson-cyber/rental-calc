/**
 * Deal walkthrough — what clients see on a rental-arbitrage /share report.
 *
 * Built to end in a decision, not more analysis: the verdict and the three
 * numbers that matter sit at the top, then a short read of the money, every
 * month checked against rent, why it's safe, proof they can check, how to win
 * it, and the reply we need in Slack. The team still sees the full analysis
 * below it; clients don't.
 *
 * Numbers come from the server's deterministic facts (`_dealFacts`) and the
 * report's monthly forecast; Claude only writes the prose (`_dealBrief`).
 * See server/deal-brief.ts and server/deal-page.ts.
 */

import type { ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
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
  /** null when there's no real market data (never the deal's own projection) */
  marketMedianOccupancy: number | null;
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

/** One month of the report's revenue forecast, as stored in reportData.forecast */
export interface ForecastMonth {
  month: string;
  revenue: number;
}

const usd = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function monthLabel(raw: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(raw);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString("en-US", {
      month: "short",
    });
  }
  return raw.slice(0, 3);
}

function Section({
  step,
  title,
  lead,
  children,
}: {
  step: number;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
      {/* Phones: number sits beside the title and content runs full width */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-sm font-semibold text-[#C9A962] sm:h-9 sm:w-9 sm:text-base">
          {step}
        </span>
        <h2 className="font-serif text-xl font-semibold text-slate-900 sm:text-2xl">
          {title}
        </h2>
      </div>
      <div className="sm:pl-[52px]">
        <p className="mt-2 text-sm text-slate-500">{lead}</p>
        <div className="mt-5 min-w-0">{children}</div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/60">{note}</p>
    </div>
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

/** Horizontal 0–100% bar: break-even bookings vs. how booked similar homes are. */
function OccupancyBar({
  breakEven,
  market,
}: {
  breakEven: number;
  market: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n)) * 100;
  return (
    <div>
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

/**
 * The report's 12-month forecast, scaled to this deal's projected revenue,
 * with each month checked against rent + running costs.
 */
function MonthByMonth({
  forecast,
  facts,
}: {
  forecast: ForecastMonth[];
  facts: DealFacts;
}) {
  const total = forecast.reduce((sum, m) => sum + (m.revenue || 0), 0);
  const scale = total > 0 ? (facts.monthlyRevenue * 12) / total : 1;
  const months = forecast.map(m => {
    const revenue = (m.revenue || 0) * scale;
    return {
      label: monthLabel(m.month),
      revenue,
      profit: revenue * (1 - facts.expenseRatio) - facts.monthlyRent,
    };
  });
  const breakEvenRevenue = facts.monthlyRent / (1 - facts.expenseRatio);
  const max = Math.max(breakEvenRevenue, ...months.map(m => m.revenue)) * 1.05;
  const covered = months.filter(m => m.profit >= 0).length;
  const slowest = months.reduce((a, b) => (b.revenue < a.revenue ? b : a));
  const yearProfit = months.reduce((sum, m) => sum + m.profit, 0);

  return (
    <div>
      <div className="relative flex h-40 items-end gap-1 sm:gap-2">
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-slate-700"
          style={{ bottom: `${(breakEvenRevenue / max) * 100}%` }}
        />
        {months.map((m, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={`rounded-t ${m.profit >= 0 ? "bg-emerald-400" : "bg-amber-300"}`}
              style={{ height: `${(m.revenue / max) * 100}%` }}
              title={`${m.label}: ${usd(m.revenue)} revenue, ${usd(m.profit)} profit`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 sm:gap-2">
        {months.map((m, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[10px] text-slate-500 sm:text-xs"
          >
            {m.label}
          </span>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span className="w-6 border-t-2 border-dashed border-slate-400" />
        Rent + running costs ({usd(breakEvenRevenue)}/mo)
      </p>
      <p className="mt-4 text-slate-700">
        {covered === months.length ? (
          <>
            <strong>Every month covers rent and costs on its own</strong> — even{" "}
            {slowest.label}, the slowest, brings in {usd(slowest.revenue)}.
          </>
        ) : (
          <>
            <strong>
              {covered} of {months.length} months
            </strong>{" "}
            cover rent and costs on their own. The busy months carry the slow
            ones — over the full year you keep{" "}
            <strong>{usd(yearProfit)}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

export function DealWalkthrough({
  facts,
  brief,
  imageUrl,
  forecast,
}: {
  facts: DealFacts;
  brief?: DealBrief | null;
  imageUrl?: string;
  forecast?: ForecastMonth[];
}) {
  const market = facts.marketMedianOccupancy;
  const cushion = market != null ? market - facts.breakEvenOccupancy : 0;
  const annualProfit = facts.monthlyProfit * 12;
  const afterLaunchYearOne = annualProfit - facts.startupCost;
  const usableForecast = (forecast ?? [])
    .filter(m => m.revenue > 0)
    .slice(0, 12);
  const hasForecast = usableForecast.length >= 6;
  let step = 0;

  return (
    <div className="mb-10 space-y-6">
      {/* Verdict at a glance */}
      <div className="overflow-hidden rounded-2xl bg-[#0F172A]">
        {imageUrl && (
          <img
            onError={e => (e.currentTarget.style.display = "none")}
            src={imageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        )}
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#C9A962]">
              Why this deal works
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-[#C9A962]" />
              Analysis powered by Claude
            </span>
          </div>
          <p className="mt-3 font-serif text-[28px] font-semibold leading-tight text-white sm:text-4xl">
            {brief?.headline ||
              `${usd(facts.monthlyProfit)}/mo after rent and expenses`}
          </p>
          {brief?.summary && (
            <p className="mt-4 max-w-3xl text-base text-white/75 sm:text-lg">
              {brief.summary}
            </p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <HeroStat
              label="Your profit"
              value={`${usd(facts.monthlyProfit)}/mo`}
              note={`About ${usd(annualProfit)} a year, after rent and costs`}
            />
            <HeroStat
              label="Launch cost back in"
              value={
                facts.paybackMonths != null
                  ? `${facts.paybackMonths.toFixed(1)} months`
                  : "—"
              }
              note={`${usd(facts.startupCost)} to furnish and launch`}
            />
            <HeroStat
              label="Break-even"
              value={`${pct(facts.breakEvenOccupancy)} booked`}
              note={
                market != null
                  ? `Similar homes nearby run ${pct(market)}`
                  : `Projection assumes ${pct(facts.projectedOccupancy)} booked`
              }
            />
          </div>

          {brief && brief.whyItWorks.length > 0 && (
            <ul className="mt-6 space-y-2">
              {brief.whyItWorks.map((point, i) => (
                <li key={i} className="flex gap-3 text-white/85">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  {point}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-sm text-white/50">
            {facts.bedrooms} bed · {facts.bathrooms} bath ·{" "}
            {usd(facts.monthlyRent)}/mo rent
          </p>
        </div>
      </div>

      <Section
        step={++step}
        title="The money"
        lead="What this home earns on Airbnb, minus rent and running costs. What's left is yours."
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
        <p className="mt-4 text-slate-700">
          That's about <strong>{usd(annualProfit)} a year</strong>
          {afterLaunchYearOne > 0 ? (
            <>
              . Even after paying back your {usd(facts.startupCost)} launch
              budget, year one still leaves{" "}
              <strong>{usd(afterLaunchYearOne)}</strong> in your pocket.
            </>
          ) : (
            <>, which pays back your {usd(facts.startupCost)} launch budget.</>
          )}
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Optimized scenario</strong> = what a well-run, well-furnished
          listing earns here ({usd(facts.adr)}/night,{" "}
          {pct(facts.projectedOccupancy)} booked). Big data models put a
          typical, unoptimized listing at {usd(facts.dataModelMonthlyRevenue)}
          /mo — they're built conservative.
        </p>
      </Section>

      {hasForecast && (
        <Section
          step={++step}
          title="Every month, checked"
          lead="Airbnb income rises and falls with the seasons. Green months cover rent and costs on their own."
        >
          <MonthByMonth forecast={usableForecast} facts={facts} />
        </Section>
      )}

      <Section
        step={++step}
        title="Why it's safe"
        lead="How booked this home needs to be to cover rent and costs, next to how booked similar homes nearby actually are."
      >
        {market != null ? (
          <>
            <OccupancyBar
              breakEven={facts.breakEvenOccupancy}
              market={market}
            />
            {cushion > 0 && (
              <p className="mt-4 text-slate-700">
                You only need <strong>{pct(facts.breakEvenOccupancy)}</strong>{" "}
                of nights booked. Similar homes already get{" "}
                <strong>{pct(market)}</strong> — a{" "}
                <strong>{Math.round(cushion * 100)}-point cushion</strong>.
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-700">
            You only need <strong>{pct(facts.breakEvenOccupancy)}</strong> of
            nights booked to cover rent and costs.
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

      {facts.comps.length > 0 && (
        <Section
          step={++step}
          title="Check the proof yourself"
          lead="Real Airbnb listings near this home and what they actually earn. Tap one to see it live."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {facts.comps.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-w-0 gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#C9A962]"
              >
                {c.imageUrl && (
                  <img
                    onError={e => (e.currentTarget.style.display = "none")}
                    src={c.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
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
            step={++step}
            title="How to win this deal"
            lead="What the top earners nearby do differently, and what good operators keep an eye on."
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
                        <p className="text-[15px] font-semibold leading-snug text-slate-900">
                          {m.move}
                        </p>
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
                        <p className="text-[15px] font-semibold leading-snug text-slate-900">
                          {w.risk}
                        </p>
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

      {/* Same ask as the team's Slack message — turn the read into a decision */}
      <div className="rounded-2xl border-2 border-[#C9A962] bg-white p-5 sm:p-8">
        {brief?.closingNote && (
          <p className="mb-5 font-serif text-xl text-slate-800">
            {brief.closingNote}
          </p>
        )}
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

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Sparkles className="h-3.5 w-3.5" />
        Deal analysis written by Claude from BNBCalc market data and our team's
        numbers
      </p>
    </div>
  );
}
