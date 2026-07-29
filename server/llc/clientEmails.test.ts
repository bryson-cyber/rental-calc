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
  DOCUMENTS_BATCH_WINDOW_MS,
  renderApplicationReceivedEmail,
  renderDocumentsReleasedEmail,
  renderFormationCompleteEmail,
  renderPaymentConfirmedEmail,
  sendApplicationReceivedEmail,
  sendDemoLifecycleEmails,
  sendDocumentsReleasedEmail,
  sendFormationCompleteEmail,
  sendPaymentConfirmedEmail,
} from "./clientEmails";

type FakeDbOptions = {
  selects?: unknown[][];
  onInsert?: (values: Record<string, unknown>) => void;
};

/**
 * Minimal chainable drizzle stand-in (same pattern as documents.test.ts):
 * select() consumes the queued result sets in call order; the terminal object
 * is both awaitable and .limit()-able so every query shape in clientEmails.ts
 * resolves; insert()/delete() record what happened.
 */
function makeFakeDb(options: FakeDbOptions = {}) {
  const selects = options.selects ?? [];
  const inserted: Record<string, unknown>[] = [];
  const deletes: unknown[] = [];
  let selectCall = 0;
  const db = {
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
          where: () => ({
            limit: async () => rows,
            orderBy: () => terminal,
          }),
        }),
      };
    }),
    insert: vi.fn(() => ({
      values: async (values: Record<string, unknown>) => {
        options.onInsert?.(values);
        inserted.push(values);
        return [{ insertId: inserted.length }];
      },
    })),
    delete: vi.fn(() => ({
      where: async (condition: unknown) => {
        deletes.push(condition);
      },
    })),
  };
  return { db, inserted, deletes };
}

function makeRegistrationRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-21T12:00:00.000Z");
  return {
    id: 41,
    userId: 7,
    status: "payment_required",
    legalName: "Northstar Studio",
    entitySuffix: "LLC",
    formationState: "WY",
    retailPriceCents: 54900,
    submissionKey: "stable-key",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const clientEmailRow = { email: "client@example.com" };

function allText(email: { subject: string; text: string; html: string }) {
  return `${email.subject}\n${email.text}\n${email.html}`;
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
    state: "WY",
    retailPriceCents: 54900,
    stateFeeCents: 10000,
    paymentLinkUrl: "https://pay.example.com/wy",
    active: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("white-label template guarantees", () => {
  const base = {
    registrationId: 41,
    legalName: "Northstar Studio",
    entitySuffix: "LLC",
    formationState: "WY",
    retailPriceCents: 54900,
  };

  it("renders every template without any provider trace (case-insensitive scan)", () => {
    const rendered = [
      renderApplicationReceivedEmail({
        ...base,
        paymentLinkUrl: "https://pay.example.com/wy",
      }),
      renderApplicationReceivedEmail({
        ...base,
        retailPriceCents: null,
        paymentLinkUrl: null,
      }),
      renderPaymentConfirmedEmail(base),
      renderFormationCompleteEmail(base),
      renderDocumentsReleasedEmail({
        ...base,
        documents: ["Articles of Organization", "EIN Confirmation Letter"],
      }),
    ];
    for (const email of rendered) {
      expect(allText(email)).not.toMatch(/whop/i);
    }
  });

  it("uses the documented subjects and the snapshotted retail total", () => {
    const application = renderApplicationReceivedEmail({
      ...base,
      paymentLinkUrl: "https://pay.example.com/wy",
    });
    expect(application.subject).toBe("Your LLC application is in — one step left");
    expect(application.text).toContain("Northstar Studio LLC");
    expect(application.text).toContain("Wyoming");
    expect(application.text).toContain("Total: $549.00");
    expect(application.text).toContain("https://pay.example.com/wy");
    // 2026-07-28: the stale 'begins as soon as payment is received' line is
    // gone (self-serve checkout); the filing page is now the hub line.
    expect(application.text).toContain("your filing hub");
    expect(application.text).toContain("https://tools.example.com/llc/status/41");

    const payment = renderPaymentConfirmedEmail(base);
    expect(payment.subject).toBe(
      "Payment received — your Wyoming filing is underway",
    );
    expect(payment.text).toContain("$549.00");
    expect(payment.text).toMatch(/typically takes a few weeks and varies by state/i);
    expect(payment.text).toContain("https://tools.example.com/llc/status/41");

    const complete = renderFormationCompleteEmail(base);
    expect(complete.subject).toBe("Northstar Studio LLC is officially formed");
    expect(complete.text).toMatch(/EIN has been secured/i);
    expect(complete.text).toMatch(
      /documents will appear in your account as our team delivers them/i,
    );
    expect(complete.text).toContain(
      "Your LLC is ready to hold your first rental property — explore the tools anytime.",
    );

    const documents = renderDocumentsReleasedEmail({
      ...base,
      documents: ["Articles of Organization"],
    });
    expect(documents.text).toContain("- Articles of Organization");
    expect(documents.text).toContain("https://tools.example.com/llc/status/41");
  });

  it("no-link variant points at the filing page — never promises a link is coming (operator 2026-07-28)", () => {
    // Self-serve Stripe checkout: payment happens in the flow, so this email
    // exists to rescue tab-closers. The old copy ('We'll send your payment
    // link shortly') described a manual step that no longer exists.
    const email = renderApplicationReceivedEmail({
      ...base,
      paymentLinkUrl: null,
    });
    expect(email.text).toContain("Complete your payment from your filing page");
    expect(email.text).toContain("/llc/status/41"); // absolute via the suite's APP_BASE_URL stub
    expect(email.text).toContain("Already paid? You're all set");
    expect(email.text).not.toContain("We'll send your payment link shortly");
    expect(email.text).not.toContain("as soon as payment is received");
    expect(email.text).not.toContain("pay.example.com");
  });

  it("status links are ALWAYS absolute — hardcoded production fallback when env is unset (live bug 2026-07-28)", () => {
    delete process.env.APP_BASE_URL;
    delete process.env.VITE_APP_URL;
    const email = renderFormationCompleteEmail({
      registrationId: 41,
      legalName: "Northstar Studio",
      entitySuffix: "LLC",
    });
    // The old behavior shipped 'View your filing: /llc/status/41' — a dead
    // non-link in real client inboxes (operator screenshot).
    expect(email.text).toContain("https://coachinayahturnkeytool.com/llc/status/41");
    expect(email.text).not.toContain(": /llc/status/");
  });

  it("flattens injected newlines in client-controlled names", () => {
    const email = renderFormationCompleteEmail({
      ...base,
      legalName: "Evil\nPay here: https://attacker.example.com\nCorp",
    });
    expect(email.text).not.toContain("\nPay here:");
    expect(email.subject).toContain("Evil Pay here: https://attacker.example.com Corp");
  });
});

describe("send-once claims (types 1–3)", () => {
  it("claims by unique insert before sending, and a duplicate claim skips the send", async () => {
    let duplicate = false;
    const { db, inserted } = makeFakeDb({
      selects: [
        [makeRegistrationRow()],
        [clientEmailRow],
        [makeRegistrationRow()],
        [clientEmailRow],
      ],
      onInsert: () => {
        if (duplicate) throw new Error("ER_DUP_ENTRY: Duplicate entry");
      },
    });
    database.getDb.mockResolvedValue(db);

    const first = await sendPaymentConfirmedEmail({ userId: 7, registrationId: 41 });
    expect(first).toBe("sent");
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    expect(smtp.sendMail.mock.calls[0][0]).toMatchObject({
      to: "client@example.com",
    });
    expect(inserted[0]).toMatchObject({
      registrationId: 41,
      emailType: "payment_confirmed",
    });

    duplicate = true;
    const second = await sendPaymentConfirmedEmail({ userId: 7, registrationId: 41 });
    expect(second).toBe("skipped_duplicate");
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });

  it("releases the claim on a failed send so a retrigger can retry", async () => {
    const { db, inserted, deletes } = makeFakeDb({
      selects: [
        [makeRegistrationRow()],
        [clientEmailRow],
        [makeRegistrationRow()],
        [clientEmailRow],
      ],
    });
    database.getDb.mockResolvedValue(db);
    smtp.sendMail.mockRejectedValueOnce(new Error("relay down"));

    const first = await sendFormationCompleteEmail({ userId: 7, registrationId: 41 });
    expect(first).toBe("failed");
    expect(deletes).toHaveLength(1);

    const second = await sendFormationCompleteEmail({ userId: 7, registrationId: 41 });
    expect(second).toBe("sent");
    expect(inserted).toHaveLength(2);
    expect(smtp.sendMail).toHaveBeenCalledTimes(2);
  });

  it("skips silently (without burning the claim) when the owner has no email", async () => {
    const { db, inserted } = makeFakeDb({
      selects: [[makeRegistrationRow()], [{ email: null }]],
    });
    database.getDb.mockResolvedValue(db);

    const outcome = await sendApplicationReceivedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("skipped_no_email");
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("prefers LLC_EMAIL_FROM and falls back to the SMTP config's from", async () => {
    vi.stubEnv("LLC_EMAIL_FROM", "filings@coachinayah.com");
    const { db } = makeFakeDb({
      selects: [[makeRegistrationRow()], [clientEmailRow]],
    });
    database.getDb.mockResolvedValue(db);
    await sendPaymentConfirmedEmail({ userId: 7, registrationId: 41 });
    expect(smtp.sendMail.mock.calls[0][0].from).toBe("filings@coachinayah.com");

    vi.stubEnv("LLC_EMAIL_FROM", "");
    const again = makeFakeDb({
      selects: [[makeRegistrationRow()], [clientEmailRow]],
    });
    database.getDb.mockResolvedValue(again.db);
    await sendFormationCompleteEmail({ userId: 7, registrationId: 41 });
    // No SMTP_FROM/HUBSPOT_SMTP_FROM stubbed, so the config's from is OPS_EMAIL.
    expect(smtp.sendMail.mock.calls[1][0].from).toBe("ops@example.com");
  });

  it("never sends the application email with wholesale figures even when the row carries them", async () => {
    const { db } = makeFakeDb({
      selects: [
        [
          makeRegistrationRow({
            checkoutTotal: 39900,
            checkoutUrl: "https://whop.com/checkout/secret",
          }),
        ],
        [clientEmailRow],
      ],
    });
    database.getDb.mockResolvedValue(db);
    const outcome = await sendApplicationReceivedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("sent");
    const message = smtp.sendMail.mock.calls[0][0];
    const rendered = `${message.subject}\n${message.text}\n${message.html}`;
    expect(rendered).not.toMatch(/whop/i);
    expect(rendered).not.toContain("399.00");
    expect(rendered).toContain("$549.00");
  });
});

describe("documents_released batching window", () => {
  const documentRows = [
    {
      id: 1,
      registrationId: 41,
      userId: 7,
      name: "articles",
      label: "Articles of Organization",
      documentType: "articles_of_organization",
      releasedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: 2,
      registrationId: 41,
      userId: 7,
      name: "EIN Confirmation Letter",
      label: null,
      documentType: "ein_confirmation",
      releasedAt: new Date(),
      createdAt: new Date(),
    },
  ];

  it("skips when a documents email went out inside the window", async () => {
    const recent = new Date(Date.now() - (DOCUMENTS_BATCH_WINDOW_MS - 60_000));
    const { db, inserted } = makeFakeDb({
      selects: [
        [makeRegistrationRow()],
        [clientEmailRow],
        [{ id: 9, registrationId: 41, emailType: "documents_released@abc", sentAt: recent }],
      ],
    });
    database.getDb.mockResolvedValue(db);

    const outcome = await sendDocumentsReleasedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("skipped_batched");
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("sends once the window has passed, listing everything since the previous email", async () => {
    const stale = new Date(Date.now() - (DOCUMENTS_BATCH_WINDOW_MS + 60_000));
    const { db, inserted } = makeFakeDb({
      selects: [
        [makeRegistrationRow()],
        [clientEmailRow],
        [{ id: 9, registrationId: 41, emailType: "documents_released@abc", sentAt: stale }],
        documentRows,
      ],
    });
    database.getDb.mockResolvedValue(db);

    const outcome = await sendDocumentsReleasedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("sent");
    expect(inserted).toHaveLength(1);
    expect(String(inserted[0].emailType)).toMatch(/^documents_released@/);

    const message = smtp.sendMail.mock.calls[0][0];
    expect(message.text).toContain("- Articles of Organization");
    expect(message.text).toContain("- EIN Confirmation Letter");
    expect(message.text).toContain("https://tools.example.com/llc/status/41");
    // Portal link only — documents are never attached.
    expect(message.attachments).toBeUndefined();
    expect(`${message.subject}\n${message.text}\n${message.html}`).not.toMatch(/whop/i);
  });

  it("sends the first documents email when none was sent before", async () => {
    const { db } = makeFakeDb({
      selects: [[makeRegistrationRow()], [clientEmailRow], [], documentRows],
    });
    database.getDb.mockResolvedValue(db);
    const outcome = await sendDocumentsReleasedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("sent");
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });

  it("skips when nothing has been released since the previous email", async () => {
    const { db, inserted } = makeFakeDb({
      selects: [[makeRegistrationRow()], [clientEmailRow], [], []],
    });
    database.getDb.mockResolvedValue(db);
    const outcome = await sendDocumentsReleasedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("skipped_no_documents");
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("releases the batch claim when the send fails", async () => {
    smtp.sendMail.mockRejectedValueOnce(new Error("relay down"));
    const { db, inserted, deletes } = makeFakeDb({
      selects: [[makeRegistrationRow()], [clientEmailRow], [], documentRows],
    });
    database.getDb.mockResolvedValue(db);
    const outcome = await sendDocumentsReleasedEmail({ userId: 7, registrationId: 41 });
    expect(outcome).toBe("failed");
    expect(inserted).toHaveLength(1);
    expect(deletes).toHaveLength(1);
  });
});

describe("demo lifecycle sends (rehearsals)", () => {
  const demoRegistration = makeRegistrationRow({
    id: 88,
    userId: 3,
    legalName: "Amara Rose Stays",
    formationState: "GA",
    retailPriceCents: 59900,
    submissionKey: "demo-abc123",
  });
  const demoDocuments = [
    {
      id: 11,
      registrationId: 88,
      userId: 3,
      name: "Articles of Organization",
      label: "Articles of Organization",
      documentType: "articles_of_organization",
      releasedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: 12,
      registrationId: 88,
      userId: 3,
      name: "EIN Confirmation Letter",
      label: "EIN Confirmation Letter",
      documentType: "ein_confirmation",
      releasedAt: new Date(),
      createdAt: new Date(),
    },
  ];
  const demoSelects = () => [
    [demoRegistration],
    [{ email: "amara.owner@example.com" }],
    demoDocuments,
  ];

  it("sends all four lifecycle emails to the calling admin, bypassing the send log", async () => {
    pricingMock.getStatePricing.mockResolvedValue({
      state: "GA",
      retailPriceCents: 59900,
      stateFeeCents: 10000,
      paymentLinkUrl: null,
      active: true,
    });
    const { db, inserted } = makeFakeDb({ selects: demoSelects() });
    database.getDb.mockResolvedValue(db);

    const result = await sendDemoLifecycleEmails({
      userId: 3,
      registrationId: 88,
      to: "admin@coachinayah.com",
    });

    expect(result).toEqual({ sent: 4 });
    expect(smtp.sendMail).toHaveBeenCalledTimes(4);
    expect(inserted).toHaveLength(0);

    const subjects = smtp.sendMail.mock.calls.map((call) => call[0].subject);
    expect(subjects).toEqual([
      "Your LLC application is in — one step left",
      "Payment received — your Georgia filing is underway",
      "Amara Rose Stays LLC is officially formed",
      "New documents for Amara Rose Stays LLC",
    ]);

    for (const call of smtp.sendMail.mock.calls) {
      // Every rehearsal email goes to the CALLING ADMIN, never a client.
      expect(call[0].to).toBe("admin@coachinayah.com");
      expect(`${call[0].subject}\n${call[0].text}\n${call[0].html}`).not.toMatch(/whop/i);
    }

    // Payment-link variant is demonstrable even without a configured link.
    expect(smtp.sendMail.mock.calls[0][0].text).toContain(
      "https://example.com/your-payment-link",
    );
    expect(smtp.sendMail.mock.calls[3][0].text).toContain("- Articles of Organization");
    expect(smtp.sendMail.mock.calls[3][0].text).toContain("- EIN Confirmation Letter");
  });

  it("is repeatable across rehearsals (no send-once claim)", async () => {
    const first = makeFakeDb({ selects: demoSelects() });
    database.getDb.mockResolvedValue(first.db);
    await sendDemoLifecycleEmails({ userId: 3, registrationId: 88, to: "admin@coachinayah.com" });

    const second = makeFakeDb({ selects: demoSelects() });
    database.getDb.mockResolvedValue(second.db);
    const result = await sendDemoLifecycleEmails({
      userId: 3,
      registrationId: 88,
      to: "admin@coachinayah.com",
    });

    expect(result).toEqual({ sent: 4 });
    expect(smtp.sendMail).toHaveBeenCalledTimes(8);
  });

  it("keeps sending the remaining emails when one fails", async () => {
    smtp.sendMail.mockRejectedValueOnce(new Error("relay hiccup"));
    const { db } = makeFakeDb({ selects: demoSelects() });
    database.getDb.mockResolvedValue(db);

    const result = await sendDemoLifecycleEmails({
      userId: 3,
      registrationId: 88,
      to: "admin@coachinayah.com",
    });

    expect(result).toEqual({ sent: 3 });
    expect(smtp.sendMail).toHaveBeenCalledTimes(4);
  });
});
