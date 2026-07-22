// A valid FICO score is 300–850. Guards against bad upstream data (e.g. a
// mangled value from the funding system) being shown as a credit score.
export function validFico(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 300 && v <= 850 ? Math.round(v) : null;
}
