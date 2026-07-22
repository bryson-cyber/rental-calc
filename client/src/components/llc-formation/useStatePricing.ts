import { trpc } from "@/lib/trpc";
import { LLC_FORMATION_STATES, LLC_STATE_NAMES } from "@shared/llc";

type SupportedState = (typeof LLC_FORMATION_STATES)[number];

export function isSupportedState(state: string | null | undefined): state is SupportedState {
  return Boolean(state) && (LLC_FORMATION_STATES as readonly string[]).includes(state as string);
}

export function stateDisplayName(state: string | null | undefined): string {
  return isSupportedState(state) ? LLC_STATE_NAMES[state] : (state ?? "");
}

/**
 * Client-facing pricing for the selected formation state. Null retail price
 * (or no row) means "price not published" — the wizard falls back to the
 * total-after-you-submit copy and never blocks on missing pricing.
 */
export function useStatePricing(state: string | null | undefined) {
  return trpc.llc.statePricing.useQuery(
    { state: (isSupportedState(state) ? state : "WY") as SupportedState },
    {
      enabled: isSupportedState(state),
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  );
}

/** $549 for 54900; $549.50 when cents are present. */
export function formatUsdFromCents(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
