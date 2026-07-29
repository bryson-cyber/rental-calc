import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { DOOLA_INDUSTRY_OPTIONS } from "@shared/doola-industries";

interface IndustryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Searchable combobox for selecting a Doola-valid industry.
 * Renders all 821 industries from Doola's reference list with fuzzy search.
 */
export function IndustryCombobox({ value, onChange, error }: IndustryComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = DOOLA_INDUSTRY_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground">
        Industry classification
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive",
            )}
          >
            {selectedOption ? selectedOption.label : "Search for your industry..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type to search industries..." />
            <CommandList>
              <CommandEmpty>No matching industry found.</CommandEmpty>
              <CommandGroup>
                {DOOLA_INDUSTRY_OPTIONS.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{option.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {option.naicsCode}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {value && selectedOption && (
        <p className="text-xs text-muted-foreground">
          NAICS {selectedOption.naicsCode} — {selectedOption.label}
        </p>
      )}
    </div>
  );
}
