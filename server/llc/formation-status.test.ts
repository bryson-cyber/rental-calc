import { describe, expect, it } from "vitest";
import {
  isFormationStatusRegression,
  normalizeWhopFormationStatus,
} from "./whop";

describe("normalizeWhopFormationStatus provider contract", () => {
  it("maps a draft payment_pending object to payment_required", () => {
    const result = normalizeWhopFormationStatus({ payment_pending: true });
    expect(result.localStatus).toBe("payment_required");
  });

  it("prioritizes pending founder signatures as action_required and keeps the signing URLs", () => {
    const result = normalizeWhopFormationStatus({
      status: "processing",
      signatures: [
        { status: "pending", url: "https://sign.example.com/session/1", expires_at: "2026-08-01" },
        { status: "completed", url: "https://sign.example.com/session/0" },
      ],
    });
    expect(result.localStatus).toBe("action_required");
    expect(result.snapshot.signatures).toHaveLength(2);
    expect(result.snapshot.signatures?.[0]?.url).toBe("https://sign.example.com/session/1");
  });

  it("treats state_registered plus ein_registered as completed", () => {
    const result = normalizeWhopFormationStatus({
      state_registered: true,
      ein_registered: true,
    });
    expect(result.localStatus).toBe("completed");
  });

  it("keeps state-registered-only filings in processing", () => {
    const result = normalizeWhopFormationStatus({
      state_registered: true,
      ein_registered: false,
    });
    expect(result.localStatus).toBe("processing");
  });

  it("never classifies a compound failure string as completed", () => {
    const result = normalizeWhopFormationStatus({ status: "filing_failed" });
    expect(result.localStatus).toBe("action_required");
  });

  it("maps the documented enum: draft stays payment_required, never progress", () => {
    const result = normalizeWhopFormationStatus({ status: "draft" });
    expect(result.localStatus).toBe("payment_required");
  });

  it("maps the documented enum: filed is NOT completed while the EIN is outstanding", () => {
    const result = normalizeWhopFormationStatus({
      status: "filed",
      state_registered: true,
      ein_registered: false,
    });
    expect(result.localStatus).toBe("processing");
  });

  it("maps the documented enum: rejected demands ops attention", () => {
    expect(normalizeWhopFormationStatus({ status: "rejected" }).localStatus).toBe(
      "action_required",
    );
  });

  it("still completes when both booleans confirm, regardless of status text", () => {
    const result = normalizeWhopFormationStatus({
      status: "filed",
      state_registered: true,
      ein_registered: true,
    });
    expect(result.localStatus).toBe("completed");
  });

  it("parses the keyed-object signatures shape and keeps the form label", () => {
    const result = normalizeWhopFormationStatus({
      status: "processing",
      signatures: {
        ss4: { status: "pending", url: "https://sign.example/ss4", expires_at: "2026-08-01" },
      },
    });
    expect(result.localStatus).toBe("action_required");
    expect(result.snapshot.signatures?.[0]?.form).toBe("ss4");
    expect(result.snapshot.signatures?.[0]?.url).toBe("https://sign.example/ss4");
  });

  it("parses documents in both the pinned and current field shapes", () => {
    const result = normalizeWhopFormationStatus({
      status: "completed",
      documents: [
        { id: "file_1", name: "Articles", type: "articles_of_organization", url: "https://cdn.example/a.pdf" },
        { id: "doc_2", name: "EIN", document_type: "ein_letter", download_url: "https://cdn.example/b.pdf" },
      ],
    });
    expect(result.snapshot.documents?.[0]?.document_type).toBe("articles_of_organization");
    expect(result.snapshot.documents?.[0]?.download_url).toBe("https://cdn.example/a.pdf");
    expect(result.snapshot.documents?.[1]?.document_type).toBe("ein_letter");
  });

  it("never classifies 'inactive' or 'incomplete' as completed", () => {
    expect(normalizeWhopFormationStatus({ status: "inactive" }).localStatus).not.toBe("completed");
    expect(normalizeWhopFormationStatus({ status: "incomplete" }).localStatus).not.toBe("completed");
  });

  it("maps snake_case completion values through separator normalization", () => {
    expect(normalizeWhopFormationStatus({ status: "filing_completed" }).localStatus).toBe("completed");
  });

  it("does not let 'filing' match the completed 'filed' signal", () => {
    const result = normalizeWhopFormationStatus({ status: "filing" });
    expect(result.localStatus).toBe("processing");
  });

  it("sanitizes documents to safe fields and caps list length", () => {
    const documents = Array.from({ length: 30 }, (_, index) => ({
      id: `doc_${index}`,
      name: "Articles of Organization",
      document_type: "articles_of_organization",
      download_url: "https://cdn.example.com/doc.pdf",
      internal_secret: "must-not-survive",
    }));
    const result = normalizeWhopFormationStatus({ status: "processing", documents });
    expect(result.snapshot.documents).toHaveLength(20);
    expect(result.snapshot.documents?.[0]).toEqual({
      id: "doc_0",
      name: "Articles of Organization",
      document_type: "articles_of_organization",
      download_url: "https://cdn.example.com/doc.pdf",
    });
  });

  it("preserves the last confirmed status for an empty provider object", () => {
    const result = normalizeWhopFormationStatus({});
    expect(result.localStatus).toBeNull();
  });

  it("treats unknown non-empty objects conservatively as processing", () => {
    const result = normalizeWhopFormationStatus({ status: "next_gen_state" });
    expect(result.localStatus).toBe("processing");
  });
});

describe("isFormationStatusRegression monotonic guard", () => {
  it("never allows completed to rewind", () => {
    expect(isFormationStatusRegression("completed", "processing")).toBe(true);
    expect(isFormationStatusRegression("completed", "payment_required")).toBe(true);
    expect(isFormationStatusRegression("completed", "action_required")).toBe(true);
    expect(isFormationStatusRegression("completed", "completed")).toBe(false);
  });

  it("blocks processing from rewinding to payment_required", () => {
    expect(isFormationStatusRegression("processing", "payment_required")).toBe(true);
  });

  it("allows forward progress and attention states", () => {
    expect(isFormationStatusRegression("payment_required", "processing")).toBe(false);
    expect(isFormationStatusRegression("processing", "completed")).toBe(false);
    expect(isFormationStatusRegression("processing", "action_required")).toBe(false);
    expect(isFormationStatusRegression("action_required", "processing")).toBe(false);
  });
});
