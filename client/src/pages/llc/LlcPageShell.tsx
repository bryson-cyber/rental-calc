/**
 * Shared page shell + auth gate for the LLC formation pages.
 *
 * Matches the Coach Inayah light theme used across the app: white background,
 * gold accents, apple-card content surfaces, fixed home button top-left.
 * Filing requires an account, so unauthenticated visitors get the app's
 * standard sign-in call to action (returning to the page they wanted).
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { AuthButton } from "@/components/AuthButton";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Building2, Home, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LlcPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed header actions (same pattern as the tool hub) */}
      <div className="fixed top-4 left-4 z-50">
        <a
          href="/?tab=llc"
          className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all min-h-[44px]"
          title="Back to tools"
        >
          <Home className="w-5 h-5 text-amber-600" />
          <span className="hidden sm:inline text-sm font-semibold text-slate-800">Coach Inayah</span>
        </a>
      </div>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <AuthButton />
      </div>

      <section className="pt-20 pb-10 md:pt-24">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[oklch(0.55_0.14_75)] flex items-center justify-center glow-gold flex-shrink-0">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[oklch(0.15_0_0)]">
                  {title}
                </h1>
                <p className="text-[oklch(0.50_0_0)] text-sm sm:text-base">{description}</p>
              </div>
            </div>
          </div>

          {authLoading ? (
            <div className="apple-card flex items-center justify-center gap-3 p-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <span className="text-sm text-muted-foreground">Loading your workspace…</span>
            </div>
          ) : !isAuthenticated || !user ? (
            <div className="apple-card p-8 text-center sm:p-12">
              <h2 className="text-xl font-semibold text-foreground">Sign in to continue</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Your LLC registration is saved to your account, so you can pick up right
                where you left off on any device.
              </p>
              <Button
                className="mt-5"
                onClick={() => {
                  window.location.href = getLoginUrl(
                    window.location.pathname + window.location.search,
                  );
                }}
              >
                Sign in to continue
              </Button>
            </div>
          ) : (
            children
          )}
          {/* Contractual co-brand attribution (partner agreement §4.2) —
              do not remove or obscure. */}
          <p className="mt-10 pb-4 text-center text-[11px] text-muted-foreground/70">
            Formation services powered by doola
          </p>
        </div>
      </section>
    </div>
  );
}
