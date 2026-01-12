import React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface HelpSectionProps {
  title: string;
  description: string;
  steps: string[];
  isOpen: boolean;
  onToggle: () => void;
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  title,
  description,
  steps,
  isOpen,
  onToggle
}) => {
  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-[oklch(0.14_0.02_265)] hover:bg-[oklch(0.16_0.02_265)] border border-[oklch(0.25_0.02_265)]/50 rounded-xl transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-[oklch(0.78_0.12_75)] flex-shrink-0" />
          <span className="font-medium text-[oklch(0.85_0.01_265)]">{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[oklch(0.50_0.02_265)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-3 p-5 bg-[oklch(0.12_0.02_265)] border border-[oklch(0.22_0.02_265)]/50 rounded-xl space-y-5 animate-fade-in-up">
          <p className="text-[oklch(0.70_0.01_265)] leading-relaxed">{description}</p>

          <ol className="space-y-3">
            {steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-[oklch(0.78_0.12_75)] text-[oklch(0.12_0.02_265)] text-xs font-semibold flex-shrink-0">
                  {idx + 1}
                </div>
                <span className="text-[oklch(0.70_0.01_265)] text-sm pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
