/**
 * Client walkthrough copy policy. Applies to freshly generated briefs and to
 * already-stored briefs at render time; never changes report facts or comps.
 */
export interface DealWatchOut {
  risk: string;
  howTopOperatorsHandleIt: string;
}

/** The removed watch-out compares the optimized projection to raw comp earnings. */
export function isProjectionComparisonWarning(watchOut: DealWatchOut): boolean {
  const text = `${watchOut.risk} ${watchOut.howTopOperatorsHandleIt}`
    .normalize("NFKC")
    .toLowerCase();
  const mentionsProjection = /\b(?:projection(?:s)?|projected|forecast(?:s)?|estimate(?:s)?|estimated)\b/.test(text);
  const mentionsComps = /\b(?:comp(?:s)?|comparable(?:s)?|nearby listings?|similar (?:homes?|properties|listings?))\b/.test(text);
  const comparesAbove = /\b(?:exceed(?:s|ed|ing)?|above|higher than|outpac(?:e|es|ing)|outstrip(?:s|ped|ping)?|optimistic|aggressive|overstat(?:e|es|ed|ing)|inflated|unsupported|gap)\b/.test(text);
  const underwriting = /\bunderwrit(?:e|es|ing|ten)\b/.test(text);
  return mentionsProjection && mentionsComps && (comparesAbove || underwriting);
}

/** Preserve unrelated operational risks and the original stored objects. */
export function clientDealWatchOuts<T extends DealWatchOut>(watchOuts: readonly T[] | null | undefined): T[] {
  return (watchOuts ?? []).filter(watchOut => !isProjectionComparisonWarning(watchOut));
}
