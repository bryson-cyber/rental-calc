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
        className="w-full flex items-center justify-between p-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-all group"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-[#D4A84B] flex-shrink-0" />
          <span className="font-medium text-slate-200">{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-3 p-4 bg-slate-800/50 border border-slate-600/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <p className="text-slate-300 text-sm">{description}</p>

          <ol className="space-y-2">
            {steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-r from-[#D4A84B] to-[#4ECDC4] text-white text-xs font-semibold flex-shrink-0">
                  {idx + 1}
                </div>
                <span className="text-slate-300 text-sm pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
