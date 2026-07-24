import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validDraft } from "./test-fixtures";
import {
  WhopApiError,
  mapLlcToWhopRequest,
  normalizeWhopFormationStatus,
  retrieveWhopAccount,
} from "./whop";

const previousKey = process.env.WHOP_API_KEY;
const previousBaseUrl = process.env.WHOP_API_BASE_URL;

describe("Whop LLC contract", () => {
  beforeEach(() => {
    process.env.WHOP_API_KEY = `whop_${"t".repeat(40)}`;
    process.env.WHOP_API_BASE_URL = "https://api.whop.com/api/v1";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousKey === undefined) delete process.env.WHOP_API_KEY;
    else process.env.WHOP_API_KEY = previousKey;
    if (previousBaseUrl === undefined) delete process.env.WHOP_API_BASE_URL;
    else process.env.WHOP_API_BASE_URL = previousBaseUrl;
  });

  it("maps the validated domain model to Whop's exact snake-case request contract", () => {
    expect(mapLlcToWhopRequest(validDraft)).toEqual({
      business_info: {
        legal_name: "Northstar Studio",
        entity_suffix: "LLC",
        formation_state: "WY",
        business_type: "coaching_and_courses",
        industry_group: "trading_and_investing",
        industry_type: "stock_trading",
        use_registered_agent: false,
        expedite_ein: false,
        phone: "+12125550100",
        website: "https://northstar.example",
        address: {
          line1: "100 Main Street",
          line2: "Suite 4",
          city: "Cheyenne",
          state: "WY",
          postal_code: "82001",
          country: "US",
        },
      },
      founders: [
        {
          is_primary: true,
          first_name: "Avery",
          last_name: "Stone",
          email: "avery@example.com",
          phone: "+12125550101",
          ownership_percentage: 60,
          address: {
            line1: "10 Pine Road",
            city: "Cheyenne",
            state: "WY",
            postal_code: "82001",
            country: "US",
          },
        },
        {
          is_primary: false,
          first_name: "Jordan",
          last_name: "Lee",
          email: "jordan@example.com",
          phone: "+12125550102",
          ownership_percentage: 40,
          address: {
            line1: "20 Birch Road",
            city: "Cheyenne",
            state: "WY",
            postal_code: "82001",
            country: "US",
          },
        },
      ],
    });
  });

  it("omits the company address and empty optional contact fields when registered-agent service is selected", () => {
    const request = mapLlcToWhopRequest({
      ...validDraft,
      useRegisteredAgent: true,
      businessPhone: "",
      website: "",
    });
    expect(request.business_info).not.toHaveProperty("address");
    expect(request.business_info).not.toHaveProperty("phone");
    expect(request.business_info).not.toHaveProperty("website");
  });

  it("normalizes only approved provider signals and discards unknown or sensitive keys", () => {
    expect(
      normalizeWhopFormationStatus({
        status: "filed",
        secret_token: "must-not-survive",
        founder_ssn: "000-00-0000",
      }),
    ).toMatchObject({
      // Per the documented enum, "filed" means the state leg is done while
      // the EIN may still be outstanding — progress, not completion.
      localStatus: "processing",
      snapshot: { status: "filed" },
    });

    expect(
      normalizeWhopFormationStatus({
        undocumented_status_blob: "unknown",
        private_note: "do not persist",
      }),
    ).toEqual({
      localStatus: null,
      snapshot: {},
      note: "Whop has not published detailed filing progress yet",
    });
  });

  it.each([
    [{ payment_pending: true }, "payment_required"],
    [{ action_required: true }, "action_required"],
    [{ state: "under review" }, "processing"],
    [{ formation_status: "formed" }, "completed"],
    [null, null],
  ])("maps provider snapshot %j to %s", (snapshot, expected) => {
    expect(normalizeWhopFormationStatus(snapshot).localStatus).toBe(expected);
  });

  it("rejects malformed connected-account IDs before making a network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(retrieveWhopAccount("not-a-business-id")).rejects.toMatchObject({
      name: "WhopApiError",
      errorType: "invalid_account_id",
      retryable: false,
      actionRequired: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("classifies a provider 500 as retryable while redacting provider text and the API key", async () => {
    const providerText = "internal upstream trace with secret details";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { type: "provider_failure", message: providerText } }),
          {
            status: 500,
            headers: { "content-type": "application/json", "x-request-id": "req_safe123" },
          },
        ),
      ),
    );

    try {
      await retrieveWhopAccount("biz_Valid123");
      throw new Error("Expected Whop request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WhopApiError);
      const whopError = error as WhopApiError;
      expect(whopError.retryable).toBe(true);
      expect(whopError.actionRequired).toBe(false);
      expect(whopError.safeMessage).not.toContain(providerText);
      expect(whopError.safeMessage).not.toContain(process.env.WHOP_API_KEY!);
      expect(whopError.message).not.toContain(process.env.WHOP_API_KEY!);
      expect(whopError.requestId).toBe("req_safe123");
    }
  });
});
