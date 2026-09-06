import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("webinar email recipient claims", () => {
  const source = readFileSync(new URL("../routers/webinar-sms.ts", import.meta.url), "utf8");

  it("uses INSERT IGNORE for every duplicate-sensitive email and reminder claim", () => {
    const claims = source.match(/INSERT IGNORE INTO email_send_log/g) ?? [];
    expect(claims).toHaveLength(4);
  });

  it("does not use the CLIENT_FOUND_ROWS-sensitive no-op upsert claim", () => {
    expect(source).not.toContain("onDuplicateKeyUpdate({ set: { id: sql`${emailSendLog.id}` } })");
  });

  it("persists confirmation SMTP message IDs for downstream delivery correlation", () => {
    expect(source).toContain("messageId: emailResult.messageId || null");
  });
});
