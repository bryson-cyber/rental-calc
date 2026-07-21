import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LLC_FORMATION_STATES } from "@shared/llc";
import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/** Green affirmation line for "what's included" lists. */
export function IncludedLine({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600/10">
        <Check className="size-2.5 text-emerald-600" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="text-[13px] leading-5 text-muted-foreground">{children}</span>
    </span>
  );
}

/** Small status chip used on selection cards ("Included", "Add-on"). */
export function OfferBadge({
  tone = "success",
  children,
}: {
  tone?: "success" | "accent";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone === "success"
          ? "bg-emerald-600/10 text-emerald-700"
          : "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export type AddressValue = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold leading-snug text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function FieldBlock({
  label,
  htmlFor,
  help,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const helpId = help ? `${htmlFor}-help` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={htmlFor} className="text-[12px]">
          {label}
        </Label>
        {optional ? (
          <span className="text-[11px] text-muted-foreground">Optional</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-xs leading-5 text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  help,
  error,
  optional,
  className,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  help?: string;
  error?: string;
  optional?: boolean;
}) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <FieldBlock
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <Input
        {...inputProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
    </FieldBlock>
  );
}

export function NativeSelect({
  id,
  label,
  help,
  error,
  optional,
  options,
  placeholder = "Select an option",
  className,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  help?: string;
  error?: string;
  optional?: boolean;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <FieldBlock
      htmlFor={id}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <select
        {...selectProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldBlock>
  );
}

export function AddressFields({
  idPrefix,
  value,
  onChange,
  errors,
}: {
  idPrefix: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  errors: Record<string, string>;
}) {
  const stateOptions = LLC_FORMATION_STATES.map((state) => ({
    value: state,
    label: state,
  }));
  const update = (field: keyof AddressValue, next: string) =>
    onChange({ ...value, [field]: next });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={`${idPrefix}-line1`}
        label="Street address"
        autoComplete="address-line1"
        value={value.line1 ?? ""}
        onChange={(event) => update("line1", event.target.value)}
        error={errors[`${idPrefix}.line1`]}
        className="sm:col-span-2"
      />
      <TextField
        id={`${idPrefix}-line2`}
        label="Apartment, suite, or unit"
        autoComplete="address-line2"
        value={value.line2 ?? ""}
        onChange={(event) => update("line2", event.target.value)}
        error={errors[`${idPrefix}.line2`]}
        optional
        className="sm:col-span-2"
      />
      <TextField
        id={`${idPrefix}-city`}
        label="City"
        autoComplete="address-level2"
        value={value.city ?? ""}
        onChange={(event) => update("city", event.target.value)}
        error={errors[`${idPrefix}.city`]}
      />
      <NativeSelect
        id={`${idPrefix}-state`}
        label="State"
        autoComplete="address-level1"
        value={value.state ?? ""}
        onChange={(event) => update("state", event.target.value)}
        options={stateOptions}
        error={errors[`${idPrefix}.state`]}
      />
      <TextField
        id={`${idPrefix}-postalCode`}
        label="ZIP code"
        autoComplete="postal-code"
        inputMode="numeric"
        value={value.postalCode ?? ""}
        onChange={(event) => update("postalCode", event.target.value)}
        error={errors[`${idPrefix}.postalCode`]}
      />
      <TextField
        id={`${idPrefix}-country`}
        label="Country"
        value="US"
        readOnly
        aria-readonly="true"
        help="LLC formation currently supports United States addresses."
      />
    </div>
  );
}
