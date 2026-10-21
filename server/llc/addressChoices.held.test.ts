/**
 * Held orders, what the client is told (2026-10-14; owner: an LLC was filed
 * with the registered agent's address as its business address; fix it in
 * every app). An order placed before the fix with the old agent switch on is
 * held before filing until the client confirms the business address and where
 * mail goes. Everything the client reads about that order must say so:
 *  - the payment emails never say the filing is underway, starts the moment
 *    the payment goes through, or that the client is "all set";
 *  - the banner after a card payment does not say "all set" over "One more
 *    step";
 *  - the LLC tab's "included" list does not still say a professional address
 *    receives state and legal mail "not your home" (the client's own street
 *    address is the default now, and her mail comes to her).
 * Orders that are not held keep their wording exactly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: smtp.createTransport },
}));

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: database.getDb }));

const pricingMock = vi.hoisted(() => ({ getStatePricing: vi.fn() }));
vi.mock("./pricing", () => ({ getStatePricing: pricingMock.getStatePricing }));

import {
  renderApplicationReceivedEmail,
  renderPaymentConfirmedEmail,
  sendApplicationReceivedEmail,
  sendPaymentConfirmedEmail,
} from "./clientEmails";

const read = (relative: string) => readFileSync(join(__dirname, "..", "..", relative), "utf8");

/** Same chainable drizzle stand-in clientEmails.test.ts uses. */
function makeFakeDb(selects: unknown[][]) {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      const rows = selects[selectCall++] ?? [];
      const terminal = {
        limit: async () => rows,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (resolve: (value: unknown[]) => any, reject?: (error: unknown) => any) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return {
        from: () => ({
          where: () => ({ limit: async () => rows, orderBy: () => terminal }),
        }),
      };
    }),
    insert: vi.fn(() => ({ values: async () => [{ insertId: 1 }] })),
    delete: vi.fn(() => ({ where: async () => undefined })),
  };
}

/** A submitted order that has not reached the filing service yet. */
function registrationRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-10-14T12:00:00.000Z");
  return {
    id: 41,
    userId: 7,
    status: "payment_required",
    provider: "doola",
    doolaCompanyId: null,
    lastErrorType: null,
    isTest: false,
    legalName: "Northstar Studio",
    entitySuffix: "LLC",
    formationState: "OK",
    retailPriceCents: 54900,
    submissionKey: "stable-key",
    statusToken: "t".repeat(40),
    businessPhone: "+17025550100",
    // The old single switch on, and nothing acknowledged: the held case.
    useRegisteredAgent: true,
    businessAddressMode: null,
    mailingAddressMode: null,
    businessAgentAckVersion: null,
    mailingAgentAckVersion: null,
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyAddressCity: null,
    companyAddressState: null,
    companyAddressPostalCode: null,
    companyAddressCountry: "US",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** An order whose own street address is complete: not held. */
const NOT_HELD = {
  useRegisteredAgent: false,
  businessAddressMode: "customer",
  mailingAddressMode: "customer",
  companyAddressLine1: "500 Main St",
  companyAddressCity: "Tulsa",
  companyAddressState: "OK",
  companyAddressPostalCode: "74103",
};

const EM_DASH = "—";
const base = {
  registrationId: 41,
  legalName: "Northstar Studio",
  entitySuffix: "LLC",
  formationState: "OK",
  retailPriceCents: 54900,
  statusToken: "t".repeat(40),
};
const SIGN_OFF = `${EM_DASH} The Coach Inayah team`;

/** Everything above the sign-off, which keeps the house dash. */
function body(email: { text: string }) {
  return email.text.slice(0, email.text.indexOf(SIGN_OFF));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPS_EMAIL", "ops@example.com");
  vi.stubEnv("SMTP_HOST", "smtp.hubapi.com");
  vi.stubEnv("SMTP_USER", "relay-user");
  vi.stubEnv("SMTP_PASS", "relay-pass");
  vi.stubEnv("APP_BASE_URL", "https://tools.example.com");
  smtp.sendMail.mockResolvedValue({ messageId: "msg-1" });
  smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });
  pricingMock.getStatePricing.mockResolvedValue({
    state: "OK",
    retailPriceCents: 54900,
    stateFeeCents: 10000,
    paymentLinkUrl: "https://pay.example.com/ok",
    active: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("payment confirmed email for a held order", () => {
  it("asks for the one step instead of saying the filing is underway", () => {
    const held = renderPaymentConfirmedEmail({ ...base, addressChoiceNeeded: true });
    const all = `${held.subject}\n${held.text}\n${held.html}`;
    expect(all).not.toMatch(/underway|all set|now filing/i);
    expect(held.subject).toBe("Payment received: one more step before we file in Oklahoma");
    expect(held.text).toContain("We've received your payment of $549.00 for Northstar Studio LLC.");
    expect(held.text).toContain("confirm your business address and where your company's mail goes");
    expect(held.text).toContain("Nothing is filed until you save them");
    // The link to the page that carries the confirm card, as the gold button.
    expect(held.text).toContain(`https://tools.example.com/llc/status/41?t=${"t".repeat(40)}`);
    expect(held.html).toContain("Open your filing page");
  });

  it("uses plain words: no em dash above the sign-off, no provider name, no address", () => {
    const held = renderPaymentConfirmedEmail({ ...base, addressChoiceNeeded: true });
    expect(body(held)).not.toContain(EM_DASH);
    expect(held.subject).not.toContain(EM_DASH);
    expect(`${held.subject}\n${held.text}\n${held.html}`).not.toMatch(/doola|whop/i);
  });

  it("an order that is not held keeps its wording exactly", () => {
    const plain = renderPaymentConfirmedEmail(base);
    expect(plain).toEqual(renderPaymentConfirmedEmail({ ...base, addressChoiceNeeded: false }));
    expect(plain.subject).toBe(`Payment received ${EM_DASH} your Oklahoma filing is underway`);
    expect(plain.text).toContain("Your Oklahoma filing is now underway.");
  });
});

describe("application received (payment rescue) email for a held order", () => {
  for (const [label, paymentLinkUrl] of [
    ["with the state's payment link", "https://pay.example.com/ok"],
    ["with the filing-page payment button", null],
  ] as const) {
    it(`${label} does not promise the filing starts when the payment goes through`, () => {
      const email = renderApplicationReceivedEmail({ ...base, paymentLinkUrl, addressChoiceNeeded: true });
      expect(email.text).not.toMatch(/you're all set|starts the moment it goes through|already paid\?/i);
      expect(email.text).toContain("confirm your business address and where your company's mail goes");
      expect(email.text).toContain("Nothing is filed until you save them");
      expect(email.text).toContain("Filing payments are final and non-refundable.");
      expect(body(email)).not.toContain(EM_DASH);
      expect(`${email.subject}\n${email.text}\n${email.html}`).not.toMatch(/doola|whop/i);
    });
  }

  it("an order that is not held keeps its wording exactly", () => {
    const plain = renderApplicationReceivedEmail({ ...base, paymentLinkUrl: null });
    expect(plain).toEqual(renderApplicationReceivedEmail({ ...base, paymentLinkUrl: null, addressChoiceNeeded: false }));
    expect(plain.text).toContain("your filing starts the moment it goes through");
    expect(plain.text).toContain("You're all set");
  });
});

describe("the send reads the order, so only a held order gets the held wording", () => {
  const owner = { email: "client@example.com" };

  it("payment confirmed: a pre-fix agent-switch order is told the one step", async () => {
    database.getDb.mockResolvedValue(makeFakeDb([[registrationRow()], [owner]]));
    expect(await sendPaymentConfirmedEmail({ userId: 7, registrationId: 41 })).toBe("sent");
    const sent = smtp.sendMail.mock.calls[0][0];
    expect(sent.subject).toBe("Payment received: one more step before we file in Oklahoma");
    expect(sent.text).not.toMatch(/underway/i);
  });

  it("payment confirmed: an order with its own address complete is told the filing is underway", async () => {
    database.getDb.mockResolvedValue(makeFakeDb([[registrationRow(NOT_HELD)], [owner]]));
    expect(await sendPaymentConfirmedEmail({ userId: 7, registrationId: 41 })).toBe("sent");
    expect(smtp.sendMail.mock.calls[0][0].subject).toBe(`Payment received ${EM_DASH} your Oklahoma filing is underway`);
  });

  it("application received: the same rule", async () => {
    database.getDb.mockResolvedValue(makeFakeDb([[registrationRow()], [owner]]));
    expect(await sendApplicationReceivedEmail({ userId: 7, registrationId: 41 })).toBe("sent");
    expect(smtp.sendMail.mock.calls[0][0].text).toContain("Nothing is filed until you save them");

    smtp.sendMail.mockClear();
    database.getDb.mockResolvedValue(makeFakeDb([[registrationRow(NOT_HELD)], [owner]]));
    expect(await sendApplicationReceivedEmail({ userId: 7, registrationId: 41 })).toBe("sent");
    expect(smtp.sendMail.mock.calls[0][0].text).not.toContain("Nothing is filed until you save them");
    expect(smtp.sendMail.mock.calls[0][0].text).toContain("You're all set");
  });
});

describe("status page banner after a card payment", () => {
  it("a held order's banner heading is not 'you're all set' over 'One more step'", () => {
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    const banner = status.slice(status.indexOf('paymentReturn === "success" ? ('), status.indexOf('paymentReturn === "cancelled"'));
    expect(banner).toContain('registration.addressChoiceNeeded ? "Payment received" : "Payment received');
    // The held body still asks for the choice, and the heading above it no
    // longer contradicts it.
    expect(banner).toContain("One more step: confirm your business address and where mail goes below");
    expect(banner.indexOf('"Payment received"')).toBeLessThan(banner.indexOf("One more step"));
  });
});

describe("the LLC tab's included list", () => {
  const tab = read("client/src/components/LLCFormationStep.tsx");
  const list = tab.slice(tab.indexOf("const INCLUDED = ["), tab.indexOf("function StatusPill"));
  // The agent's own entry (the other two keep their house dashes).
  const included = list.slice(list.indexOf("icon: MailCheck"), list.indexOf("icon: FileCheck2"));

  it("no longer says a professional address receives state mail instead of the client's home", () => {
    expect(included).not.toMatch(/not your home/i);
    expect(included).not.toContain("Registered agent service");
    expect(included).not.toContain("A professional address receives state and legal mail");
  });

  it("says the agent is included and that the client chooses the address and where mail goes", () => {
    expect(included).toContain("title: 'Professional registered agent'");
    expect(included).toContain("Included with every filing.");
    expect(included).toContain("you choose the address on your state filing and where your mail goes");
    expect(included).not.toMatch(/doola|whop|—/i);
  });
});
