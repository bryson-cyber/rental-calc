/**
 * Demo/test-filing markers — a leaf module (no llc-internal imports) so any
 * layer (documents, emails, routers, demo itself) can check demonstration
 * status without creating import cycles.
 */

export const DEMO_SUBMISSION_KEY_PREFIX = "demo-";

export function isDemoSubmissionKey(submissionKey: string | null | undefined): boolean {
  return Boolean(submissionKey?.startsWith(DEMO_SUBMISSION_KEY_PREFIX));
}

/**
 * A registration that exists only for demonstrations: either an instant demo
 * filing (demo- submissionKey) or an admin live-journey test run (isTest
 * column — immutable, set only at creation). Every demo-only affordance
 * (advance, delete, demo emails, ops badge, sample regeneration) keys off
 * this predicate.
 */
export function isTestRegistration(registration: {
  submissionKey: string | null;
  isTest: boolean;
}): boolean {
  return registration.isTest || isDemoSubmissionKey(registration.submissionKey);
}
