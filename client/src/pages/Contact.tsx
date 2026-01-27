import { ArrowLeft, Mail, Clock, MapPin, Phone } from 'lucide-react';
import { Link } from 'wouter';

export default function Contact() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[oklch(0.92_0_0)] bg-white sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-[oklch(0.45_0_0)] hover:text-[oklch(0.25_0_0)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-semibold text-[oklch(0.15_0_0)] mb-4">
          Contact & Support
        </h1>
        <p className="text-xl text-[oklch(0.45_0_0)] mb-12">
          We're here to help. Reach out with any questions about our tools or services.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-[oklch(0.98_0_0)] rounded-2xl p-6 border border-[oklch(0.92_0_0)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[oklch(0.55_0.14_75)]/10 rounded-xl">
                  <Mail className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[oklch(0.20_0_0)] mb-1">Email Support</h3>
                  <a 
                    href="mailto:support@coachinayah.com" 
                    className="text-[oklch(0.55_0.14_75)] hover:underline text-lg"
                  >
                    support@coachinayah.com
                  </a>
                  <p className="text-[oklch(0.50_0_0)] text-sm mt-2">
                    For general inquiries, technical support, and refund requests
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[oklch(0.98_0_0)] rounded-2xl p-6 border border-[oklch(0.92_0_0)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[oklch(0.55_0.14_75)]/10 rounded-xl">
                  <Clock className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[oklch(0.20_0_0)] mb-1">Response Time</h3>
                  <p className="text-[oklch(0.35_0_0)] text-lg">Within 2 business days</p>
                  <p className="text-[oklch(0.50_0_0)] text-sm mt-2">
                    Monday through Friday, 9am - 5pm CST
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[oklch(0.98_0_0)] rounded-2xl p-6 border border-[oklch(0.92_0_0)]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[oklch(0.55_0.14_75)]/10 rounded-xl">
                  <MapPin className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[oklch(0.20_0_0)] mb-1">Business Address</h3>
                  <p className="text-[oklch(0.35_0_0)]">
                    I&B Coaching<br />
                    Las Vegas, NV 89134<br />
                    United States
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ / Quick Help */}
          <div>
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-6">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-[oklch(0.25_0_0)] mb-2">
                  Are the research tools really free?
                </h3>
                <p className="text-[oklch(0.45_0_0)]">
                  Yes, all market analysis and property research tools on this site are completely free to use. 
                  No credit card or payment required.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[oklch(0.25_0_0)] mb-2">
                  What is the Turnkey Program?
                </h3>
                <p className="text-[oklch(0.45_0_0)]">
                  The Turnkey Program is a 12-month coaching program for those who want hands-on guidance 
                  in building a short-term rental business. It includes one-on-one coaching, resources, 
                  and ongoing support.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[oklch(0.25_0_0)] mb-2">
                  How do I request a refund?
                </h3>
                <p className="text-[oklch(0.45_0_0)]">
                  Email us at support@coachinayah.com within the refund window (3 days for standard purchases, 
                  30 days for Affirm financing). See our <Link href="/refund-policy" className="text-[oklch(0.55_0.14_75)] hover:underline">Refund Policy</Link> for full details.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[oklch(0.25_0_0)] mb-2">
                  Where does the rental data come from?
                </h3>
                <p className="text-[oklch(0.45_0_0)]">
                  Our tools use aggregated data from actual short-term rental bookings and listings. 
                  The data is updated regularly to reflect current market conditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[oklch(0.92_0_0)] bg-[oklch(0.98_0_0)] py-8 mt-12">
        <div className="container max-w-4xl mx-auto px-4 text-center text-[oklch(0.50_0_0)] text-sm">
          <p>&copy; {new Date().getFullYear()} I&B Coaching. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
