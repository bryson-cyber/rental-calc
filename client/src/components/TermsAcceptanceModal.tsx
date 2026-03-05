/**
 * TermsAcceptanceModal
 * 
 * A modal that requires users to accept the Terms of Service before using the tool.
 * Acceptance is stored in localStorage so users only see it once per browser.
 * The modal cannot be dismissed without accepting.
 */

import { useState } from 'react';
import { FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

const TOS_ACCEPTED_KEY = 'tos_accepted_v1';

/**
 * Check if the user has already accepted the TOS.
 * Can be called from any component to gate functionality.
 */
export function hasTosBeenAccepted(): boolean {
  try {
    return localStorage.getItem(TOS_ACCEPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark TOS as accepted in localStorage.
 */
export function markTosAccepted(): void {
  try {
    localStorage.setItem(TOS_ACCEPTED_KEY, 'true');
  } catch {
    // localStorage might be unavailable in some contexts
  }
}

interface TermsAcceptanceModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export function TermsAcceptanceModal({ isOpen, onAccept }: TermsAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!checked) return;
    markTosAccepted();
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[oklch(0.20_0.02_265)] to-[oklch(0.25_0.02_265)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Terms of Service</h2>
              <p className="text-white/70 text-sm">Please review before continuing</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="bg-[oklch(0.97_0_0)] rounded-xl p-4 border border-[oklch(0.92_0_0)] mb-5 max-h-48 overflow-y-auto text-[11px] text-[oklch(0.40_0_0)] leading-relaxed">
            <p className="mb-3">
              By using the Rental Revenue Calculator and related tools provided by I&B Coaching, you acknowledge and agree to the following:
            </p>
            <ul className="space-y-2 ml-3">
              <li className="flex gap-2">
                <span className="text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0">1.</span>
                <span>This tool provides <strong>estimates only</strong> for informational and educational purposes. It does not constitute financial, investment, real estate, tax, or legal advice.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0">2.</span>
                <span>All revenue projections, occupancy rates, and other data are derived from third-party sources and algorithmic models. <strong>Actual results may vary materially.</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0">3.</span>
                <span>I&B Coaching is <strong>not a licensed</strong> real estate broker, appraiser, financial advisor, or investment advisor.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0">4.</span>
                <span>You should conduct your own due diligence and consult qualified professionals before making any decisions based on this data.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[oklch(0.55_0.14_75)] mt-0.5 flex-shrink-0">5.</span>
                <span>I&B Coaching disclaims all liability for any loss or damage arising from the use of this tool.</span>
              </li>
            </ul>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group mb-5">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                checked 
                  ? 'bg-[oklch(0.55_0.14_75)] border-[oklch(0.55_0.14_75)]' 
                  : 'border-[oklch(0.75_0_0)] group-hover:border-[oklch(0.55_0.14_75)]'
              }`}>
                {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <span className="text-sm text-[oklch(0.30_0_0)] leading-relaxed">
              I have read and agree to the{' '}
              <Link href="/terms-of-service" className="text-[oklch(0.55_0.14_75)] underline font-medium hover:opacity-80" target="_blank">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-[oklch(0.55_0.14_75)] underline font-medium hover:opacity-80" target="_blank">
                Privacy Policy
              </Link>
            </span>
          </label>

          {/* Accept Button */}
          <Button
            onClick={handleAccept}
            disabled={!checked}
            className="w-full bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.50_0.14_75)] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Tool
          </Button>
        </div>
      </div>
    </div>
  );
}
