import { Checkbox } from "@/components/ui/checkbox";
import type { LlcDraft } from "@shared/llc";
import {
  BUSINESS_AGENT_ACK,
  MAILING_AGENT_ACK,
  REGISTERED_AGENT_INCLUDED_LINE,
  agentBusinessAddressBlockedReason,
  type LlcAddressMode,
} from "@shared/llcAddress";
import { Check, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AddressFields, TextField } from "./FormControls";

/**
 * Step 3 since 2026-10-14: the registered agent is always included, and the
 * business address and the mail address are two separate questions. The
 * client's own street address is the default for both; each opt-in to the
 * agent's address needs its own checkbox. Also used on the status page when
 * an order placed before the fix must confirm its choices. Copy never names
 * the filing or payment provider.
 */
export type AddressChoices = Pick<
  LlcDraft,
  | "businessAddressMode"
  | "mailingAddressMode"
  | "businessAgentAckVersion"
  | "mailingAgentAckVersion"
  | "companyAddress"
  | "businessPhone"
>;

/** Plain-words summary used on review and status (address text only when it is the client's own). */
export { addressChoiceSummary } from "@shared/llcAddress";

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      {children}
    </span>
  );
}

function ErrorLine({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/**
 * One option card. This app's UI kit has no radio group, so (like the
 * wizard's other choice cards) each option is a native button with
 * role="radio": keyboard-reachable, 44px or taller, and disabled where the
 * state refuses the option.
 */
function OptionCard({
  id,
  selected,
  disabled,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-11 w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors sm:p-5 ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40"
      } ${disabled ? "cursor-not-allowed opacity-70 hover:border-border" : "cursor-pointer"}`}
    >
      {selected ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

function Acknowledgment({
  id,
  text,
  checked,
  onChange,
  error,
}: {
  id: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-5 shrink-0"
        />
        <span className="text-[13px] leading-5 text-amber-950">{text}</span>
      </label>
      <ErrorLine id={`${id}-error`} message={error} />
    </div>
  );
}

export function RegisteredAgentIncluded() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-600/10">
        <ShieldCheck className="size-4 text-emerald-700" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          Professional registered agent <Pill>Included</Pill>
        </p>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{REGISTERED_AGENT_INCLUDED_LINE}</p>
      </div>
    </div>
  );
}

export function AddressChoiceFields({
  value,
  formationState,
  errors,
  onChange,
  idPrefix = "address-choice",
}: {
  value: AddressChoices;
  formationState: string | undefined;
  errors: Record<string, string>;
  onChange: (value: AddressChoices) => void;
  idPrefix?: string;
}) {
  const patch = (next: Partial<AddressChoices>) => onChange({ ...value, ...next });
  const blockedReason = agentBusinessAddressBlockedReason(formationState);
  const business = value.businessAddressMode;
  const mailing = value.mailingAddressMode;
  const businessAckChecked = value.businessAgentAckVersion === BUSINESS_AGENT_ACK.version;
  const mailingAckChecked = value.mailingAgentAckVersion === MAILING_AGENT_ACK.version;
  // The client's address is asked for once: under the business question when
  // it is the business address, otherwise under the mail question when mail
  // goes to the client.
  const addressUnderBusiness = business === "customer";
  const addressUnderMail = business === "registered_agent" && mailing === "customer";

  const chooseBusiness = (mode: LlcAddressMode) =>
    patch({
      businessAddressMode: mode,
      ...(mode === "customer" ? { businessAgentAckVersion: "" } : {}),
    });
  const chooseMailing = (mode: LlcAddressMode) =>
    patch({
      mailingAddressMode: mode,
      ...(mode === "customer" ? { mailingAgentAckVersion: "" } : {}),
    });

  const ownAddressFields = (heading: string) => (
    <div className="mt-4 rounded-xl border border-border p-4 sm:p-5">
      <h4 className="mb-1 text-sm font-semibold text-foreground">{heading}</h4>
      <p className="mb-4 text-xs leading-5 text-muted-foreground">
        Use a street address, not a PO box or "c/o". It must be in the United States.
      </p>
      <AddressFields
        idPrefix="companyAddress"
        value={value.companyAddress}
        onChange={(companyAddress) => patch({ companyAddress })}
        errors={errors}
      />
      <TextField
        id={`${idPrefix}-businessPhone`}
        label="Business phone"
        value={value.businessPhone ?? ""}
        onChange={(event) => patch({ businessPhone: event.target.value })}
        placeholder="(702) 555-0100"
        autoComplete="tel"
        inputMode="tel"
        error={errors.businessPhone}
        help="Goes with this address on your filing. US numbers work as-is; international numbers need their + country code."
        className="mt-4"
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <RegisteredAgentIncluded />

      <fieldset>
        <legend id={`${idPrefix}-business-legend`} className="text-[15px] font-semibold text-foreground">
          Your business address (principal place of business)
        </legend>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          This goes on your state filing and is public. Banks and lenders compare it with your EIN
          letter and your bank records, so most owners use their own street address.
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-business-legend`}
          aria-describedby={errors.businessAddressMode ? `${idPrefix}-business-error` : undefined}
          className="mt-4 grid gap-3"
        >
          <OptionCard
            id={`${idPrefix}-business-own`}
            selected={business === "customer"}
            onSelect={() => chooseBusiness("customer")}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Use my own street address</span>
              <Pill>Recommended</Pill>
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              The address where you run your business. It matches what your bank will ask for.
            </span>
          </OptionCard>
          <OptionCard
            id={`${idPrefix}-business-agent`}
            selected={business === "registered_agent"}
            disabled={Boolean(blockedReason)}
            onSelect={() => chooseBusiness("registered_agent")}
          >
            <span className="block text-sm font-semibold text-foreground">
              Use the registered agent's address instead
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              {blockedReason ?? "A privacy choice: your own address stays off the state filing."}
            </span>
          </OptionCard>
        </div>
        <ErrorLine id={`${idPrefix}-business-error`} message={errors.businessAddressMode} />

        {business === "registered_agent" && !blockedReason ? (
          <Acknowledgment
            id={`${idPrefix}-business-ack`}
            text={BUSINESS_AGENT_ACK.text}
            checked={businessAckChecked}
            onChange={(checked) => patch({ businessAgentAckVersion: checked ? BUSINESS_AGENT_ACK.version : "" })}
            error={errors.businessAgentAckVersion}
          />
        ) : null}

        {addressUnderBusiness ? ownAddressFields("Your business street address") : null}
      </fieldset>

      <fieldset>
        <legend id={`${idPrefix}-mail-legend`} className="text-[15px] font-semibold text-foreground">
          Where should mail and your EIN letter go?
        </legend>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-mail-legend`} className="mt-4 grid gap-3">
          <OptionCard
            id={`${idPrefix}-mail-own`}
            selected={mailing === "customer"}
            onSelect={() => chooseMailing("customer")}
          >
            <span className="block text-sm font-semibold text-foreground">
              {business === "customer" ? "To my business address above" : "To my own address"}
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              State and tax mail for your company comes straight to you.
            </span>
          </OptionCard>
          <OptionCard
            id={`${idPrefix}-mail-agent`}
            selected={mailing === "registered_agent"}
            onSelect={() => chooseMailing("registered_agent")}
          >
            <span className="block text-sm font-semibold text-foreground">
              Send it to the registered agent and show it to me in my account
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              The registered agent opens your company's mail, scans it and adds it to your account.
              Your IRS EIN letter will then show the registered agent's address.
            </span>
          </OptionCard>
        </div>

        {mailing === "registered_agent" ? (
          <Acknowledgment
            id={`${idPrefix}-mail-ack`}
            text={MAILING_AGENT_ACK.text}
            checked={mailingAckChecked}
            onChange={(checked) => patch({ mailingAgentAckVersion: checked ? MAILING_AGENT_ACK.version : "" })}
            error={errors.mailingAgentAckVersion}
          />
        ) : null}

        {addressUnderMail ? ownAddressFields("Your mailing street address") : null}

        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          A copy of your EIN letter is added to your account either way. If the IRS ever has the
          wrong address for your company, you can update it for free with IRS Form 8822-B.
        </p>
      </fieldset>
    </div>
  );
}
