import { Link } from 'wouter';
import { ArrowLeft, Shield, Mail, MapPin } from 'lucide-react';

export default function PrivacyPolicy() {
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
              <Shield className="w-6 h-6 text-[oklch(0.55_0.14_75)]" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-[oklch(0.15_0_0)]">Privacy Policy</h1>
              <p className="text-[oklch(0.5_0_0)]">Last updated: January 27, 2026</p>
            </div>
          </div>

          {/* Introduction */}
          <section className="mb-10">
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              I&B Coaching ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our rental analysis tools.
            </p>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-[oklch(0.25_0_0)] mb-3">Personal Information You Provide</h3>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              We collect information you voluntarily provide when using our services, including:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 mb-6 ml-4">
              <li>Name and email address (when creating an account or contacting support)</li>
              <li>Property addresses you search or analyze</li>
              <li>Saved properties and market preferences</li>
              <li>Communication records when you contact us</li>
            </ul>

            <h3 className="text-lg font-medium text-[oklch(0.25_0_0)] mb-3">Information Collected Automatically</h3>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              When you access our website, we may automatically collect certain information, including:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and general location</li>
              <li>Pages visited and time spent on pages</li>
              <li>Referring website or source</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">2. How We Use Your Information</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 ml-4">
              <li>Provide and maintain our rental analysis tools</li>
              <li>Process your property searches and save your preferences</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Send you updates about our services (with your consent)</li>
              <li>Improve our website and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">3. Information Sharing</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following situations:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 ml-4">
              <li><strong>Service Providers:</strong> We may share information with third-party vendors who perform services on our behalf (hosting, analytics, payment processing)</li>
              <li><strong>Payment Processing:</strong> When you make a purchase, your payment information is processed by our payment partners, including Affirm. Their use of your information is governed by their respective privacy policies</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In the event of a merger or acquisition, your information may be transferred</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">4. Third-Party Services</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              Our website uses third-party services that may collect information about you:
            </p>
            
            <h3 className="text-lg font-medium text-[oklch(0.25_0_0)] mb-3">Affirm Financing</h3>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              We offer financing through Affirm. When you apply for financing, Affirm will collect and process your information according to their privacy policy. Affirm's underwriting decisions are made independently, and we do not have access to your full financial information submitted to Affirm.
            </p>

            <h3 className="text-lg font-medium text-[oklch(0.25_0_0)] mb-3">Analytics</h3>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We use analytics services to understand how visitors use our website. These services may use cookies and similar technologies to collect information about your browsing behavior.
            </p>
          </section>

          {/* Data Security */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">5. Data Security</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Cookies */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">6. Cookies and Tracking Technologies</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              We use cookies and similar tracking technologies to:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 mb-4 ml-4">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Analyze website traffic and usage</li>
              <li>Improve our services</li>
            </ul>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              You can control cookies through your browser settings. Disabling cookies may affect the functionality of our website.
            </p>
          </section>

          {/* Your Rights */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">7. Your Rights and Choices</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-[oklch(0.35_0_0)] space-y-2 mb-4 ml-4">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time</li>
            </ul>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              To exercise these rights, please contact us at support@coachinayah.com.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">8. Data Retention</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy. When you delete your account, we will delete or anonymize your personal information within 30 days, unless we are required to retain it for legal purposes.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">9. Children's Privacy</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
            </p>
          </section>

          {/* Contact Information */}
          <section className="bg-[oklch(0.97_0_0)] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[oklch(0.15_0_0)] mb-4">11. Contact Us</h2>
            <p className="text-[oklch(0.35_0_0)] leading-relaxed mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[oklch(0.35_0_0)]">
                <Mail className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                <a href="mailto:support@coachinayah.com" className="hover:text-[oklch(0.55_0.14_75)] transition-colors">
                  support@coachinayah.com
                </a>
              </div>
              <div className="flex items-center gap-3 text-[oklch(0.35_0_0)]">
                <MapPin className="w-5 h-5 text-[oklch(0.55_0.14_75)]" />
                <span>I&B Coaching, Las Vegas, NV 89134</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[oklch(0.5_0_0)]">
            <Link href="/refund-policy" className="hover:text-[oklch(0.55_0.14_75)] transition-colors">
              Refund Policy
            </Link>
            <Link href="/contact" className="hover:text-[oklch(0.55_0.14_75)] transition-colors">
              Contact Us
            </Link>
            <Link href="/" className="hover:text-[oklch(0.55_0.14_75)] transition-colors">
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
