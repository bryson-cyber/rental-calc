import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LlcDraft } from "@shared/llc";
import { LLC_ACTIVITY_PRESETS, LLC_ENTITY_SUFFIXES, LLC_FORMATION_STATES } from "@shared/llc";
import {
  WHOP_BUSINESS_TAXONOMY,
  humanizeWhopTaxonomyValue,
} from "@shared/whop-taxonomy";
import { AlertCircle, ArrowUpRight, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import {
  AddressFields,
  FieldBlock,
  IncludedLine,
  NativeSelect,
  OfferBadge,
  SectionHeading,
  TextField,
} from "./FormControls";
import {
  formatUsdFromCents,
  stateDisplayName,
  useStatePricing,
} from "./useStatePricing";

/**
 * Price panel for the selected formation state. Shown only when the owner
 * has published a retail price; inactive states get a friendly blocker.
 */
function StatePricePanel({ state }: { state: string | null | undefined }) {
  const pricingQuery = useStatePricing(state);
  const pricing = pricingQuery.data;
  if (!state || !pricing) return null;

  if (!pricing.active) {
    return (
      <div
        role="alert"
        className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-sm leading-6 text-foreground">
          We're not filing in {stateDisplayName(state)} just yet. Choose another
          formation state, or check back soon.
        </p>
      </div>
    );
  }

  if (pricing.retailPriceCents === null) return null;

  return (
    <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-foreground">
        Total for {stateDisplayName(state)}: {formatUsdFromCents(pricing.retailPriceCents)}
        {pricing.stateFeeCents !== null ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            — includes the {formatUsdFromCents(pricing.stateFeeCents)} state filing fee
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        State filing, registered agent service, and your federal EIN are all included.
      </p>
    </div>
  );
}

type StepProps = {
  draft: LlcDraft;
  errors: Record<string, string>;
  onChange: (draft: LlcDraft) => void;
};

const taxonomy = WHOP_BUSINESS_TAXONOMY as Record<
  string,
  Record<string, readonly string[]>
>;

export function BusinessStep({ draft, errors, onChange }: StepProps) {
  const patch = (values: Partial<LlcDraft>) => onChange({ ...draft, ...values });
  return (
    <div>
      <SectionHeading
        eyebrow="Step 1 · Business"
        title="Start with the company itself."
        description="Enter the legal name without its ending. We keep the entity suffix separate so the filing is formatted correctly."
      />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <TextField
          id="legalName"
          label="Legal business name"
          value={draft.legalName ?? ""}
          onChange={(event) => patch({ legalName: event.target.value })}
          placeholder="Sunrise Stays"
          autoComplete="organization"
          error={errors.legalName}
          help="Do not include LLC or Limited Liability Company here."
        />
        <NativeSelect
          id="entitySuffix"
          label="Entity ending"
          value={draft.entitySuffix}
          onChange={(event) =>
            patch({ entitySuffix: event.target.value as LlcDraft["entitySuffix"] })
          }
          options={LLC_ENTITY_SUFFIXES.map((value) => ({ value, label: value }))}
          error={errors.entitySuffix}
        />
        <NativeSelect
          id="formationState"
          label="Formation state"
          value={draft.formationState ?? ""}
          onChange={(event) => patch({ formationState: event.target.value })}
          options={LLC_FORMATION_STATES.map((state) => ({ value: state, label: state }))}
          error={errors.formationState}
          help="Choose the state where the LLC will be legally formed."
        />
        <TextField
          id="businessPhone"
          label="Business phone"
          value={draft.businessPhone ?? ""}
          onChange={(event) => patch({ businessPhone: event.target.value })}
          placeholder="+12125550100"
          autoComplete="tel"
          inputMode="tel"
          error={errors.businessPhone}
          help="Use international format, beginning with +1 for US numbers. Required if you use your own company address instead of our registered agent."
          optional
        />
        <TextField
          id="website"
          label="Website"
          value={draft.website ?? ""}
          onChange={(event) => patch({ website: event.target.value })}
          placeholder="https://sunrisestays.com"
          autoComplete="url"
          inputMode="url"
          error={errors.website}
          help="Include https:// at the beginning."
          optional
          className="sm:col-span-2"
        />
      </div>
      <StatePricePanel state={draft.formationState} />
    </div>
  );
}

export function ActivityStep({ draft, errors, onChange }: StepProps) {
  const businessTypes = Object.keys(taxonomy);
  const groups = draft.businessType ? Object.keys(taxonomy[draft.businessType] ?? {}) : [];
  const industries =
    draft.businessType && draft.industryGroup
      ? [...(taxonomy[draft.businessType]?.[draft.industryGroup] ?? [])]
      : [];

  return (
    <div>
      <SectionHeading
        eyebrow="Step 2 · Activity"
        title="Describe what the business does."
        description="Filings use a three-level industry taxonomy. The choices below are constrained to valid combinations so your filing is not rejected for mismatched categories."
      />
      <div className="mb-6">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quick pick
        </p>
        <div className="flex flex-wrap gap-2">
          {LLC_ACTIVITY_PRESETS.map((preset) => {
            const active =
              draft.businessType === preset.businessType &&
              draft.industryGroup === preset.industryGroup;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    ...draft,
                    businessType: preset.businessType,
                    industryGroup: preset.industryGroup,
                    industryType: preset.industryType,
                  })
                }
                className={`rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick the closest style below if the default isn't quite right.
        </p>
      </div>

      <div className="grid gap-4">
        <NativeSelect
          id="businessType"
          label="Business type"
          value={draft.businessType ?? ""}
          onChange={(event) =>
            onChange({
              ...draft,
              businessType: event.target.value,
              industryGroup: "",
              industryType: "",
            })
          }
          options={businessTypes.map((value) => ({
            value,
            label: humanizeWhopTaxonomyValue(value),
          }))}
          error={errors.businessType}
        />
        <NativeSelect
          id="industryGroup"
          label="Industry group"
          value={draft.industryGroup ?? ""}
          onChange={(event) =>
            onChange({ ...draft, industryGroup: event.target.value, industryType: "" })
          }
          options={groups.map((value) => ({
            value,
            label: humanizeWhopTaxonomyValue(value),
          }))}
          error={errors.industryGroup}
          disabled={!draft.businessType}
          placeholder={draft.businessType ? "Select an industry group" : "Choose a business type first"}
        />
        <NativeSelect
          id="industryType"
          label="Specific industry"
          value={draft.industryType ?? ""}
          onChange={(event) => onChange({ ...draft, industryType: event.target.value })}
          options={industries.map((value) => ({
            value,
            label: humanizeWhopTaxonomyValue(value),
          }))}
          error={errors.industryType}
          disabled={!draft.industryGroup}
          placeholder={draft.industryGroup ? "Select the closest industry" : "Choose an industry group first"}
        />
      </div>
    </div>
  );
}

/**
 * Selectable option card (used instead of a radio group — this app's UI kit
 * does not ship one). Fully keyboard-accessible via native buttons.
 */
function ChoiceCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-start gap-4 rounded-xl border p-5 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {selected ? (
        <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Circle className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function AddressAgentStep({ draft, errors, onChange }: StepProps) {
  return (
    <div>
      <SectionHeading
        eyebrow="Step 3 · Registered agent"
        title="Who receives legal mail for your LLC?"
        description="Every LLC needs a registered agent — the official recipient for state mail and legal documents. Our professional service is included with your order."
      />

      <FieldBlock
        htmlFor="agent-choice-service"
        label="Registered agent"
        error={errors.useRegisteredAgent}
      >
        <div role="radiogroup" aria-label="Registered agent" className="grid gap-3">
          <ChoiceCard
            selected={draft.useRegisteredAgent}
            onSelect={() => onChange({ ...draft, useRegisteredAgent: true })}
          >
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-[15px] font-semibold text-foreground">
                Professional registered agent
              </span>
              <OfferBadge>Included</OfferBadge>
            </span>
            <span className="mt-3 grid gap-2">
              <IncludedLine>A professional address receives state mail — not your home</IncludedLine>
              <IncludedLine>Legal documents accepted and handled on your behalf</IncludedLine>
              <IncludedLine>Nothing extra to set up — we handle the paperwork</IncludedLine>
            </span>
          </ChoiceCard>
          <ChoiceCard
            selected={!draft.useRegisteredAgent}
            onSelect={() => onChange({ ...draft, useRegisteredAgent: false })}
          >
            <span className="block text-[15px] font-semibold text-foreground">
              Use my own address
            </span>
            <span className="mt-1.5 block text-[13px] leading-5 text-muted-foreground">
              Your company mailing address goes on the filing and appears on the public
              state record. You handle legal mail yourself.
            </span>
          </ChoiceCard>
        </div>
      </FieldBlock>

      {!draft.useRegisteredAgent ? (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Company mailing address</h3>
          <AddressFields
            idPrefix="companyAddress"
            value={draft.companyAddress}
            onChange={(companyAddress) => onChange({ ...draft, companyAddress })}
            errors={errors}
          />
        </div>
      ) : null}
    </div>
  );
}

const emptyFounder = (isPrimary: boolean): LlcDraft["founders"][number] => ({
  isPrimary,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  ssn: "",
  ownershipPercentage: undefined,
  address: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "US" },
});

export function FoundersStep({ draft, errors, onChange }: StepProps) {
  const founders = draft.founders.length > 0 ? draft.founders : [emptyFounder(true)];
  const replaceFounder = (index: number, founder: LlcDraft["founders"][number]) => {
    const next = [...founders];
    next[index] = founder;
    onChange({ ...draft, founders: next });
  };
  const setPrimary = (index: number) =>
    onChange({
      ...draft,
      founders: founders.map((founder, founderIndex) => ({
        ...founder,
        isPrimary: founderIndex === index,
      })),
    });
  const removeFounder = (index: number) => {
    const next = founders.filter((_, founderIndex) => founderIndex !== index);
    if (next.length > 0 && !next.some((founder) => founder.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange({ ...draft, founders: next });
  };
  const ownershipTotal = founders.reduce(
    (total, founder) => total + (founder.ownershipPercentage ?? 0),
    0,
  );

  return (
    <div>
      <SectionHeading
        eyebrow="Step 4 · Founders"
        title="Add every owner of the LLC."
        description="Choose exactly one primary responsible party. Ownership percentages must total 100%. SSNs are optional, stored encrypted, and used only for the IRS EIN application."
      />

      <div className="mb-5 flex items-center justify-between border-y border-border py-3">
        <span className="text-sm font-medium text-foreground">Ownership allocated</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            Math.abs(ownershipTotal - 100) < 0.001 ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {ownershipTotal.toFixed(2).replace(/\.00$/, "")}% / 100%
        </span>
      </div>
      {errors.founders ? (
        <p role="alert" className="mb-4 text-xs font-medium text-destructive">
          {errors.founders}
        </p>
      ) : null}

      <div className="space-y-5">
        {founders.map((founder, index) => (
          <section key={index} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Founder {index + 1}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Switch
                    id={`founder-${index}-primary`}
                    checked={founder.isPrimary}
                    onCheckedChange={(checked) => {
                      if (checked) setPrimary(index);
                    }}
                  />
                  <Label htmlFor={`founder-${index}-primary`} className="text-sm font-medium">
                    Primary responsible party
                  </Label>
                </div>
              </div>
              {founders.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove founder ${index + 1}`}
                  onClick={() => removeFounder(index)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={`founders-${index}-firstName`}
                label="First name"
                autoComplete="given-name"
                value={founder.firstName ?? ""}
                onChange={(event) => replaceFounder(index, { ...founder, firstName: event.target.value })}
                error={errors[`founders.${index}.firstName`]}
              />
              <TextField
                id={`founders-${index}-lastName`}
                label="Last name"
                autoComplete="family-name"
                value={founder.lastName ?? ""}
                onChange={(event) => replaceFounder(index, { ...founder, lastName: event.target.value })}
                error={errors[`founders.${index}.lastName`]}
              />
              <TextField
                id={`founders-${index}-email`}
                label="Email"
                type="email"
                autoComplete="email"
                value={founder.email ?? ""}
                onChange={(event) => replaceFounder(index, { ...founder, email: event.target.value })}
                error={errors[`founders.${index}.email`]}
              />
              <TextField
                id={`founders-${index}-phone`}
                label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+12125550100"
                value={founder.phone ?? ""}
                onChange={(event) => replaceFounder(index, { ...founder, phone: event.target.value })}
                error={errors[`founders.${index}.phone`]}
              />
              <TextField
                id={`founders-${index}-ssn`}
                label="Social Security Number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="123-45-6789"
                value={founder.ssn ?? ""}
                onChange={(event) => replaceFounder(index, { ...founder, ssn: event.target.value })}
                error={errors[`founders.${index}.ssn`]}
                help="US residents only — speeds up your EIN. Encrypted and never shown to our staff. Non-US founders leave this blank."
                optional
              />
              <TextField
                id={`founders-${index}-ownership`}
                label="Ownership percentage"
                type="number"
                inputMode="decimal"
                min="0.01"
                max="100"
                step="0.01"
                value={founder.ownershipPercentage ?? ""}
                onChange={(event) =>
                  replaceFounder(index, {
                    ...founder,
                    ownershipPercentage:
                      event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
                error={errors[`founders.${index}.ownershipPercentage`]}
              />
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h4 className="mb-4 text-sm font-semibold text-foreground">Home address</h4>
              <AddressFields
                idPrefix={`founders.${index}.address`}
                value={founder.address}
                onChange={(address) => replaceFounder(index, { ...founder, address })}
                errors={errors}
              />
            </div>
          </section>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-5"
        onClick={() => onChange({ ...draft, founders: [...founders, emptyFounder(false)] })}
        disabled={founders.length >= 10}
      >
        <Plus className="mr-2 size-4" aria-hidden="true" />
        Add another founder
      </Button>
    </div>
  );
}

export function PreferencesStep({ draft, errors, onChange }: StepProps) {
  const hasSsn = draft.founders.some((founder) => (founder.ssn ?? "").trim() !== "");
  return (
    <div>
      <SectionHeading
        eyebrow="Step 5 · Your EIN"
        title="Your federal tax ID is included."
        description="The EIN is your company's federal tax ID — you'll need it to open a business bank account. We retrieve it from the IRS as part of your order."
      />

      <div className="grid gap-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[15px] font-semibold text-foreground">Federal EIN (Tax ID)</span>
            <OfferBadge>Included</OfferBadge>
          </div>
          <div className="mt-3 grid gap-2">
            <IncludedLine>Retrieved directly from the IRS for you</IncludedLine>
            <IncludedLine>Required to open a business bank account</IncludedLine>
            <IncludedLine>No Social Security number needed to start</IncludedLine>
          </div>
        </div>

        {hasSsn ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[15px] font-semibold text-foreground">EIN fast-track</span>
              <OfferBadge>Active</OfferBadge>
            </div>
            <div className="mt-3 grid gap-2">
              <IncludedLine>
                An SSN is on file, so the IRS issues your EIN by its fastest route — no
                add-on needed
              </IncludedLine>
              <IncludedLine>
                The expedite option applies only to filings without an SSN
              </IncludedLine>
            </div>
          </div>
        ) : (
          <Label
            htmlFor="expediteEin"
            className="flex cursor-pointer items-start justify-between gap-5 rounded-xl border border-border bg-card p-5 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="text-[15px] font-semibold text-foreground">Expedite my EIN</span>
                <OfferBadge tone="accent">Add-on</OfferBadge>
              </span>
              <span className="mt-1.5 block max-w-xl text-[13px] leading-5 text-muted-foreground">
                No SSN on the filing means the IRS takes the slower paper route. Our team
                prioritizes your EIN retrieval so it lands sooner.
              </span>
            </span>
            <Switch
              id="expediteEin"
              checked={draft.expediteEin}
              onCheckedChange={(expediteEin) => onChange({ ...draft, expediteEin })}
            />
          </Label>
        )}
      </div>

      <p className="mt-5 max-w-2xl text-[13px] leading-5 text-muted-foreground">
        SSNs are optional, encrypted at rest, and never visible to our staff. Dates of
        birth are not collected.
      </p>
      {errors.expediteEin ? (
        <p role="alert" className="mt-3 text-xs font-medium text-destructive">
          {errors.expediteEin}
        </p>
      ) : null}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || "Not provided"}</dd>
    </div>
  );
}

function EditSection({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      Edit {label}
      <ArrowUpRight className="ml-1.5 size-3.5" aria-hidden="true" />
    </Button>
  );
}

export function ReviewStep({
  draft,
  errors,
  onChange,
  onEdit,
}: StepProps & { onEdit: (step: number) => void }) {
  const legalDisplay = `${draft.legalName ?? ""} ${draft.entitySuffix}`.trim();
  const pricingQuery = useStatePricing(draft.formationState);
  const pricing = pricingQuery.data;
  const showTotal =
    Boolean(pricing) && pricing!.active && pricing!.retailPriceCents !== null;
  return (
    <div>
      <SectionHeading
        eyebrow="Step 6 · Review"
        title="Review before the secure handoff."
        description="Submitting sends your application to our filing team. We prepare the state filing and keep your status page updated at every step."
      />

      <div className="space-y-6">
        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Business</h3>
            <EditSection label="business" onClick={() => onEdit(1)} />
          </div>
          <dl className="mt-1 divide-y divide-border">
            <SummaryLine label="Legal name" value={legalDisplay} />
            <SummaryLine label="Formation state" value={draft.formationState ?? ""} />
            <SummaryLine label="Business phone" value={draft.businessPhone ?? ""} />
            <SummaryLine label="Website" value={draft.website ?? ""} />
          </dl>
        </section>

        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Activity</h3>
            <EditSection label="activity" onClick={() => onEdit(2)} />
          </div>
          <dl className="mt-1 divide-y divide-border">
            <SummaryLine label="Business type" value={humanizeWhopTaxonomyValue(draft.businessType ?? "")} />
            <SummaryLine label="Industry group" value={humanizeWhopTaxonomyValue(draft.industryGroup ?? "")} />
            <SummaryLine label="Specific industry" value={humanizeWhopTaxonomyValue(draft.industryType ?? "")} />
          </dl>
        </section>

        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Address and agent</h3>
            <EditSection label="address" onClick={() => onEdit(3)} />
          </div>
          <dl className="mt-1 divide-y divide-border">
            <SummaryLine
              label="Registered agent"
              value={draft.useRegisteredAgent ? "Registered agent service" : "Company mailing address"}
            />
            {!draft.useRegisteredAgent ? (
              <SummaryLine
                label="Company address"
                value={[
                  draft.companyAddress.line1,
                  draft.companyAddress.line2,
                  draft.companyAddress.city,
                  draft.companyAddress.state,
                  draft.companyAddress.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}
          </dl>
        </section>

        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Founders</h3>
            <EditSection label="founders" onClick={() => onEdit(4)} />
          </div>
          <div className="mt-3 space-y-3">
            {draft.founders.map((founder, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {founder.firstName} {founder.lastName}
                    {founder.isPrimary ? " · Primary" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {founder.email}
                    {(founder.ssn ?? "").trim() ? " · SSN on file" : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {founder.ownershipPercentage ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">Filing preference</h3>
            <EditSection label="preference" onClick={() => onEdit(5)} />
          </div>
          <dl className="mt-1 divide-y divide-border">
            <SummaryLine
              label="EIN processing"
              value={
                draft.founders.some((founder) => (founder.ssn ?? "").trim())
                  ? "Fast-track (SSN on file)"
                  : draft.expediteEin
                    ? "Expedited (add-on)"
                    : "Standard"
              }
            />
          </dl>
        </section>

        {showTotal ? (
          <section className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-foreground">Order total</h3>
            </div>
            <dl className="mt-1 divide-y divide-border">
              <SummaryLine
                label={`Total for ${stateDisplayName(draft.formationState)}`}
                value={`${formatUsdFromCents(pricing!.retailPriceCents!)}${
                  pricing!.stateFeeCents !== null
                    ? ` — includes the ${formatUsdFromCents(pricing!.stateFeeCents)} state filing fee`
                    : ""
                }`}
              />
            </dl>
          </section>
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Checkbox
            id="accuracyAttested"
            checked={draft.accuracyAttested}
            onCheckedChange={(checked) =>
              onChange({ ...draft, accuracyAttested: checked === true })
            }
            aria-invalid={Boolean(errors.accuracyAttested)}
            aria-describedby={errors.accuracyAttested ? "accuracyAttested-error" : undefined}
          />
          <div>
            <Label htmlFor="accuracyAttested" className="text-sm font-medium leading-6 text-foreground">
              I confirm that the information above is accurate and that I am authorized to submit it for this business.
            </Label>
            {errors.accuracyAttested ? (
              <p id="accuracyAttested-error" role="alert" className="mt-2 text-xs font-medium text-destructive">
                {errors.accuracyAttested}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
