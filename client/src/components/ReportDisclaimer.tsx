/**
 * Legal disclaimer for I&B Coaching — appears at the bottom of every report.
 * Shared component to ensure consistency across all report types.
 */
export function ReportDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`mt-10 pt-6 border-t border-gray-200 ${className}`}>
      <p className="text-[10px] leading-relaxed text-gray-400 text-center max-w-3xl mx-auto">
        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[9px]">Disclaimer</span>
        <br />
        The information contained in this report is provided by I&B Coaching, a Nevada limited liability company, for informational and educational purposes only. This report does not constitute financial, investment, real estate, tax, or legal advice, and should not be relied upon as such. All revenue projections, occupancy rates, average daily rates, and other estimates presented herein are derived from third-party data sources and algorithmic models. These figures are estimates only and are not guarantees of actual or future performance. Actual results may vary materially based on property condition, management quality, local regulations, market conditions, seasonality, and other factors not accounted for in this analysis. I&B Coaching is not a licensed real estate broker, appraiser, financial advisor, or investment advisor. Nothing in this report should be construed as a recommendation to purchase, sell, or operate any property as a short-term rental. Users should conduct their own independent due diligence and consult with qualified licensed professionals before making any investment or business decisions. I&B Coaching makes no representations or warranties, express or implied, regarding the accuracy, completeness, reliability, or suitability of the information provided. To the fullest extent permitted by law, I&B Coaching disclaims all liability for any loss, damage, or expense arising from or in connection with the use of or reliance on this report. By using this tool, you acknowledge and agree that I&B Coaching shall not be held liable for any decisions made or actions taken based on the information presented herein.
      </p>
    </div>
  );
}

/**
 * Plain-text version of the disclaimer for PDF exports.
 */
export const DISCLAIMER_TEXT = `DISCLAIMER: The information contained in this report is provided by I&B Coaching, a Nevada limited liability company, for informational and educational purposes only. This report does not constitute financial, investment, real estate, tax, or legal advice, and should not be relied upon as such. All revenue projections, occupancy rates, average daily rates, and other estimates presented herein are derived from third-party data sources and algorithmic models. These figures are estimates only and are not guarantees of actual or future performance. Actual results may vary materially based on property condition, management quality, local regulations, market conditions, seasonality, and other factors not accounted for in this analysis. I&B Coaching is not a licensed real estate broker, appraiser, financial advisor, or investment advisor. Nothing in this report should be construed as a recommendation to purchase, sell, or operate any property as a short-term rental. Users should conduct their own independent due diligence and consult with qualified licensed professionals before making any investment or business decisions. I&B Coaching makes no representations or warranties, express or implied, regarding the accuracy, completeness, reliability, or suitability of the information provided. To the fullest extent permitted by law, I&B Coaching disclaims all liability for any loss, damage, or expense arising from or in connection with the use of or reliance on this report. By using this tool, you acknowledge and agree that I&B Coaching shall not be held liable for any decisions made or actions taken based on the information presented herein.`;
