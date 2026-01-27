import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoTooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * InfoTooltip - A reusable tooltip component for explaining metrics to beginners
 * 
 * Usage:
 * <InfoTooltip content="Explanation text">Label Text</InfoTooltip>
 * 
 * Or just the icon:
 * <InfoTooltip content="Explanation text" />
 */
export function InfoTooltip({ 
  content, 
  children, 
  className = '',
  iconClassName = '',
  side = 'top'
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          {children}
          <Info className={`w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors ${iconClassName}`} />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * MetricLabel - A label with built-in tooltip for metric explanations
 */
interface MetricLabelProps {
  label: string;
  tooltip: string;
  className?: string;
}

export function MetricLabel({ label, tooltip, className = '' }: MetricLabelProps) {
  return (
    <InfoTooltip content={tooltip} className={className}>
      <span>{label}</span>
    </InfoTooltip>
  );
}

export default InfoTooltip;
