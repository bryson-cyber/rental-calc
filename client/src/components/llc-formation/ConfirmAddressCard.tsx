import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { LlcDraft } from "@shared/llc";
import { Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddressChoiceFields, type AddressChoices } from "./AddressChoiceFields";

/**
 * Shown on the status page when a submitted order cannot be filed until the
 * client chooses the business address and where mail goes (an order placed
 * before 2026-10-14 with the old "registered agent" switch on). It opens on
 * the new defaults, the client's own street address for both, and saves only
 * these choices. Works from a tokenized email link too (no sign-in), like the
 * required-action cards on the same page.
 */
export function ConfirmAddressCard({
  registrationId,
  statusToken,
  draft,
  startsFilingOnSave,
  onSaved,
}: {
  registrationId: number;
  statusToken: string | null;
  draft: LlcDraft;
  /** True only when the payment is in: then saving starts the filing. */
  startsFilingOnSave: boolean;
  onSaved: () => void;
}) {
  const [choices, setChoices] = useState<AddressChoices>({
    businessAddressMode: "customer",
    mailingAddressMode: "customer",
    businessAgentAckVersion: "",
    mailingAgentAckVersion: "",
    companyAddress: draft.companyAddress,
    businessPhone: draft.businessPhone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const handlers = {
    onSuccess: (result: { saved: true } | { saved: false; fieldErrors: Record<string, string> }) => {
      if (!result.saved) {
        setErrors(result.fieldErrors);
        toast.error("Check the highlighted fields.");
        return;
      }
      setErrors({});
      toast.success("Thank you. Your address choices are saved.");
      onSaved();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const confirm = trpc.llc.confirmAddressChoices.useMutation(handlers);
  const confirmByToken = trpc.llc.confirmAddressChoicesByToken.useMutation(handlers);
  const isPending = confirm.isPending || confirmByToken.isPending;

  const save = () => {
    const payload = { ...choices, businessPhone: choices.businessPhone ?? "" };
    if (statusToken !== null) {
      confirmByToken.mutate({ id: registrationId, token: statusToken, choices: payload });
    } else {
      confirm.mutate({ id: registrationId, choices: payload });
    }
  };

  return (
    <section
      aria-labelledby="confirm-address-title"
      className="apple-card border-primary/30 bg-primary/5 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Needed before we file
          </p>
          <h3 id="confirm-address-title" className="mt-1 text-base font-semibold text-foreground">
            Confirm your business address and where mail goes
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
            We now ask for these separately, so your state filing can show your own street
            address.{" "}
            {startsFilingOnSave
              ? "Your filing starts as soon as you save."
              : "Once you save these and your payment is in, we start your filing."}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <AddressChoiceFields
          value={choices}
          formationState={draft.formationState}
          errors={errors}
          onChange={(next) => {
            setChoices(next);
            if (Object.keys(errors).length > 0) setErrors({});
          }}
          idPrefix="confirm"
        />
      </div>
      <Button
        className="mt-6 min-h-11 w-full font-semibold sm:w-auto"
        disabled={isPending}
        onClick={save}
      >
        {isPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
        Save my address choices
      </Button>
    </section>
  );
}
