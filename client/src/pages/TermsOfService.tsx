import { Link } from 'wouter';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[oklch(0.98_0_0)]">
      {/* Header */}
      <header className="bg-white border-b border-[oklch(0.9_0_0)]">
        <div className="container max-w-4xl mx-auto py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-[oklch(0.5_0_0)] hover:text-[oklch(0.3_0_0)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[oklch(0.9_0_0)] p-8 md:p-12">
          {/* Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-[oklch(0.15_0_0)]">Terms of Service</h1>
              <p className="text-[oklch(0.5_0_0)]">Last updated: March 4, 2026</p>
            </div>
          </div>

          {/* Introduction */}
          <section className="mb-10">
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              These Terms of Service ("Terms") govern your access to and use of the Rental Revenue Calculator and related tools (the "Service") provided by I&B Coaching, a Nevada limited liability company ("we," "us," or "our"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          {/* 1. Acceptance of Terms */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">1. Acceptance of Terms</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              By creating an account, submitting a property address, or otherwise using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy-policy" className="text-[oklch(0.55_0.14_75)] underline hover:opacity-80">Privacy Policy</Link>. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">2. Description of Service</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              The Service provides estimated short-term rental revenue projections, market analysis, occupancy rates, comparable property data, and related analytics for informational and educational purposes. The Service uses third-party data sources and algorithmic models to generate these estimates.
            </p>
          </section>

          {/* 3. No Professional Advice */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">3. No Professional Advice</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              The Service does not provide financial, investment, real estate, tax, or legal advice. All information, estimates, projections, and analyses provided through the Service are for informational and educational purposes only and should not be relied upon as the basis for any investment, purchase, sale, or business decision.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              I&B Coaching is not a licensed real estate broker, appraiser, financial advisor, or investment advisor. We do not recommend, endorse, or advise for or against any specific property, market, or investment strategy.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              You should always conduct your own independent due diligence and consult with qualified, licensed professionals (including real estate agents, financial advisors, accountants, and attorneys) before making any investment or business decisions.
            </p>
          </section>

          {/* 4. No Guarantees */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">4. No Guarantees of Accuracy or Performance</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              All revenue projections, occupancy rates, average daily rates, market scores, and other estimates are derived from third-party data sources and algorithmic models. These figures are estimates only and are not guarantees of actual or future performance.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              Actual results may vary materially based on factors including but not limited to: property condition, furnishing quality, listing optimization, management quality, local regulations, zoning changes, market conditions, seasonality, competition, economic conditions, and other factors not accounted for in the analysis.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We make no representations or warranties, express or implied, regarding the accuracy, completeness, reliability, timeliness, or suitability of any information provided through the Service.
            </p>
          </section>

          {/* 5. User Responsibilities */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">5. User Responsibilities</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              You agree to:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 mb-4 ml-4">
              <li>Provide accurate information when using the Service</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not attempt to reverse-engineer, scrape, or extract data from the Service in bulk</li>
              <li>Not use automated tools or bots to access the Service without our prior written consent</li>
              <li>Not share your account credentials with third parties</li>
              <li>Comply with all applicable local, state, and federal laws and regulations</li>
            </ul>
          </section>

          {/* 6. Intellectual Property */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">6. Intellectual Property</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              The Service, including its design, features, content, and underlying technology, is owned by I&B Coaching and is protected by intellectual property laws. You may use reports generated by the Service for your personal or internal business purposes. You may not resell, redistribute, or commercially exploit the Service or its output without our prior written consent.
            </p>
          </section>

          {/* 7. Third-Party Data */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">7. Third-Party Data and Services</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              The Service relies on data from third-party providers. We do not control and are not responsible for the accuracy, availability, or reliability of third-party data. Third-party data may be subject to its own terms of use and licensing restrictions.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">8. Limitation of Liability</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4 font-medium">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, I&B COACHING AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR RELIANCE ON THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4 font-medium">
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE EXCEED THE AMOUNT YOU PAID TO US, IF ANY, IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              You acknowledge and agree that I&B Coaching shall not be held liable for any decisions made or actions taken based on the information provided through the Service.
            </p>
          </section>

          {/* 9. Indemnification */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">9. Indemnification</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              You agree to indemnify, defend, and hold harmless I&B Coaching and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or in connection with your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          {/* 10. Disclaimer of Warranties */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed font-medium">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DEFECTS WILL BE CORRECTED.
            </p>
          </section>

          {/* 11. Termination */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">11. Termination</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service will immediately cease. Sections 3, 4, 8, 9, 10, and 12 shall survive termination.
            </p>
          </section>

          {/* 12. Governing Law */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">12. Governing Law and Dispute Resolution</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of Nevada, without regard to its conflict of law principles.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              Any dispute arising out of or relating to these Terms or the Service shall be resolved exclusively in the state or federal courts located in Clark County, Nevada, and you consent to the personal jurisdiction of such courts.
            </p>
          </section>

          {/* 13. Changes to Terms */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">13. Changes to These Terms</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the Service. Your continued use of the Service after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          {/* 14. Contact */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">14. Contact Information</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="bg-[oklch(0.97_0_0)] rounded-xl p-6 border border-[oklch(0.9_0_0)]">
              <p className="text-[oklch(0.35_0_0)] font-medium mb-2">I&B Coaching</p>
              <p className="text-[oklch(0.45_0_0)] text-sm">Las Vegas, NV 89134</p>
              <p className="text-[oklch(0.45_0_0)] text-sm">
                Email: <a href="mailto:support@coachinayah.com" className="text-[oklch(0.55_0.14_75)] underline">support@coachinayah.com</a>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
