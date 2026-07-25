#!/usr/bin/env node
/**
 * Doola SANDBOX smoke test — safe end-to-end rehearsal of the filing
 * lifecycle with fictional data. Sandbox never files with a state or
 * charges anything, and its playground endpoints complete the formation
 * and EIN on demand (firing real webhooks at whatever endpoint is
 * configured in the Partner Portal).
 *
 * Usage:
 *   DOOLA_API_KEY=dk_test_… node scripts/doola-sandbox-smoke.mjs
 *   (also reads ./.env; refuses dk_live_ keys and non-sandbox hosts)
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Load ./.env when present (never committed).
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim();
  }
} catch {
  // no .env — fine
}

const API_KEY = (process.env.DOOLA_API_KEY ?? "").trim();
const BASE_URL = (process.env.DOOLA_API_BASE_URL ?? "https://api.test.doola.com")
  .trim()
  .replace(/\/+$/, "");

if (!API_KEY.startsWith("dk_test_")) {
  console.error(
    "Refusing to run: DOOLA_API_KEY must be a SANDBOX key (dk_test_…). This script never runs against production.",
  );
  process.exit(1);
}
if (new URL(BASE_URL).host !== "api.test.doola.com") {
  console.error("Refusing to run: DOOLA_API_BASE_URL must be https://api.test.doola.com");
  process.exit(1);
}

async function call(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: API_KEY,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "POST" ? { "Idempotency-Key": randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let envelope = {};
  try {
    envelope = await response.json();
  } catch {
    // fallthrough
  }
  const payload = envelope.payload ?? envelope;
  console.log(`\n${method} ${path} → ${response.status}`);
  if (envelope.error) console.log("  error:", JSON.stringify(envelope.error));
  return { ok: response.ok && !envelope.error, status: response.status, payload };
}

const run = randomUUID().slice(0, 8);
console.log(`Doola sandbox smoke ${run} against ${BASE_URL}`);

// 1. Reference data sanity: states + fees prove auth and connectivity.
const states = await call("GET", "/v1/partner/references/states");
if (!states.ok) {
  console.error("\nFAILED at reference data — check the sandbox key.");
  process.exit(1);
}
console.log("  states returned:", Array.isArray(states.payload) ? states.payload.length : "?");

// 2. Create a fictional customer.
const customer = await call("POST", "/v1/partner/customers", {
  email: `smoke-${run}@example.com`,
  firstName: "Sandbox",
  lastName: "Founder",
  countryOfResidence: "USA",
  phoneNumber: "+12125550100",
});
const doolaCustomerId = customer.payload?.doolaCustomerId ?? customer.payload?.id;
if (!customer.ok || !doolaCustomerId) {
  console.error("\nFAILED at create customer.");
  process.exit(1);
}
console.log("  doolaCustomerId:", doolaCustomerId);

// 3. Create a fictional company (registered-agent addresses, single member).
const company = await call("POST", "/v1/partner/companies", {
  doolaCustomerId,
  entityType: "LLC",
  state: "WY",
  nameOptions: [
    { name: `Smoke Test ${run}`, entityTypeEnding: "LLC" },
    { name: `Smoke Test ${run} Ventures`, entityTypeEnding: "LLC" },
  ],
  industry: "Vacation rentals",
  description: "Sandbox smoke test — fictional short-term rental business",
  responsibleParty: {
    legalFirstName: "Sandbox",
    legalLastName: "Founder",
    email: `smoke-${run}@example.com`,
    address: {
      line1: "1 Test Street",
      city: "Cheyenne",
      state: "WY",
      postalCode: "82001",
      country: "USA",
      phone: "+12125550100",
    },
  },
  addresses: [
    { provider: "registeredAgent", type: "mailing" },
    { provider: "registeredAgent", type: "business" },
  ],
  members: [
    {
      legalFirstName: "Sandbox",
      legalLastName: "Founder",
      isNaturalPerson: true,
      ownershipPercent: 100,
      address: {
        line1: "1 Test Street",
        city: "Cheyenne",
        state: "WY",
        postalCode: "82001",
        country: "USA",
        phone: "+12125550100",
      },
    },
  ],
  requestedServices: [{ service: "EinCreation", variant: "Standard" }],
});
const doolaCompanyId = company.payload?.doolaCompanyId;
if (!company.ok || !doolaCompanyId) {
  console.error("\nFAILED at create company. Payload:", JSON.stringify(company.payload).slice(0, 500));
  process.exit(1);
}
console.log("  doolaCompanyId:", doolaCompanyId);
console.log("  submission status:", company.payload?.formationSubmissionStatus);

// 4. Playground: complete the formation, then the EIN (fires real webhooks).
await call("POST", `/v1/partner/playground/companies/${doolaCompanyId}/formation/complete`);
await call("POST", `/v1/partner/playground/companies/${doolaCompanyId}/eincreation/complete`);

// 5. Read back: EIN + filing date should now be present.
const readback = await call("GET", `/v1/partner/companies/${doolaCompanyId}`);
console.log("  formationSubmissionStatus:", readback.payload?.formationSubmissionStatus);
console.log("  formationFilingDate:", readback.payload?.formationFilingDate);
console.log("  ein:", readback.payload?.ein);

// 6. Documents.
const documents = await call("GET", `/v1/partner/companies/${doolaCompanyId}/documents`);
const list = Array.isArray(documents.payload)
  ? documents.payload
  : documents.payload?.documents ?? [];
console.log("  documents:", list.map((doc) => `${doc.documentType}:${doc.name}`).join(", ") || "(none)");
if (list[0]?.id) {
  const single = await call(
    "GET",
    `/v1/partner/companies/${doolaCompanyId}/documents/${list[0].id}`,
  );
  console.log("  first document downloadUrl present:", Boolean(single.payload?.downloadUrl));
}

console.log(`\nSMOKE COMPLETE. Company ${doolaCompanyId} lived and died in the sandbox — nothing real was filed or charged.`);
