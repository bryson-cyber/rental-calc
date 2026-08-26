import { describe, expect, it } from "vitest";
import { renderRequiredActionEmail } from "./clientEmails";

describe("required-action client email", () => {
  it("explains the SS-4 reset and links only to the branded filing page", () => {
    const result = renderRequiredActionEmail({
      registrationId: 270004,
      legalName: "Diipa Spaces",
      entitySuffix: "LLC",
      actionCode: "FORMATION_SIGNATURE_SS4_RESET",
      reason: "SS4 must be signed again.",
      statusToken: "a".repeat(48),
    });
    expect(result.subject).toContain("Action needed");
    expect(result.text).toContain("IRS Form SS-4");
    expect(result.text).toContain("coachinayahturnkeytool.com/llc/status/270004?t=");
    expect(result.text.toLowerCase()).not.toContain("doola");
  });

  it("tells name-rejection clients that the filing remains paused", () => {
    const result = renderRequiredActionEmail({
      registrationId: 41,
      legalName: "Old Name",
      entitySuffix: "LLC",
      actionCode: "FORMATION_NAME_OPTIONS_EXHAUSTED",
      reason: "The state rejected every submitted name.",
    });
    expect(result.text).toContain("replacement company names");
    expect(result.text).toContain("remain paused");
  });
});
