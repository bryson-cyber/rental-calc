import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function RefundPolicy() {
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
        <h1 className="text-4xl font-semibold text-[oklch(0.15_0_0)] mb-8">
          Refund & Return Policy
        </h1>
        
        <div className="prose prose-lg max-w-none text-[oklch(0.35_0_0)]">
          <p className="text-xl text-[oklch(0.45_0_0)] mb-8">
            Last updated: January 27, 2026
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-4">
              Free Tools
            </h2>
            <p className="mb-4">
              The rental research tools provided on this website are offered free of charge. 
              No payment is required to use the market analysis, property comparison, or data 
              exploration features. As these tools are provided at no cost, no refund is applicable.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-4">
              Paid Services (Standard Purchases)
            </h2>
            <p className="mb-4">
              For paid coaching and consulting services through the Turnkey Program purchased without financing:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Eligibility:</strong> Refund requests must be submitted within 3 calendar days of purchase.
              </li>
              <li>
                <strong>Time Window:</strong> You have 3 calendar days from the date of purchase to request a refund.
              </li>
              <li>
                <strong>Refund Method:</strong> Refunds will be processed using the original payment method.
              </li>
              <li>
                <strong>Processing Time:</strong> Approved refunds are processed within 5-7 business days.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-4">
              Financing Through Affirm
            </h2>
            <p className="mb-4">
              If you financed your purchase through Affirm, you have an extended refund window:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Eligibility:</strong> Refund requests must be submitted within 30 days of purchase.
              </li>
              <li>
                <strong>Time Window:</strong> You have 30 calendar days from the date of purchase to request a refund.
              </li>
              <li>
                <strong>Refund Processing:</strong> Refunds will be applied to your Affirm loan balance.
              </li>
              <li>
                <strong>Interest Credit:</strong> Any interest paid on the refunded amount will also be credited.
              </li>
              <li>
                <strong>Loan Questions:</strong> Contact Affirm directly for questions about your loan status after a refund.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-4">
              How to Request a Refund
            </h2>
            <p className="mb-4">
              To request a refund for paid services:
            </p>
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              <li>Email us at <a href="mailto:support@coachinayah.com" className="text-[oklch(0.55_0.14_75)] hover:underline">support@coachinayah.com</a></li>
              <li>Include your order number and the email used for purchase</li>
              <li>Specify whether you paid with Affirm financing or another payment method</li>
              <li>Provide a brief explanation of your refund request</li>
              <li>Our team will respond within 2 business days</li>
            </ol>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[oklch(0.20_0_0)] mb-4">
              Contact Us
            </h2>
            <p className="mb-4">
              If you have questions about this policy, please contact us:
            </p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong> <a href="mailto:support@coachinayah.com" className="text-[oklch(0.55_0.14_75)] hover:underline">support@coachinayah.com</a></li>
              <li><strong>Response Time:</strong> Within 2 business days</li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[oklch(0.92_0_0)] bg-[oklch(0.98_0_0)] py-8">
        <div className="container max-w-4xl mx-auto px-4 text-center text-[oklch(0.50_0_0)] text-sm">
          <p>&copy; {new Date().getFullYear()} I&B Coaching. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
