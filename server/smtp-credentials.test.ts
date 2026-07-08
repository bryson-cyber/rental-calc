import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

describe("HubSpot SMTP Credentials", () => {
  it("should authenticate with smtp.hubapi.com using provided credentials", async () => {
    const user = process.env.HUBSPOT_SMTP_USER;
    const pass = process.env.HUBSPOT_SMTP_PASS;

    expect(user).toBeTruthy();
    expect(pass).toBeTruthy();

    const transporter = nodemailer.createTransport({
      host: "smtp.hubapi.com",
      port: 587,
      secure: false,
      auth: { user: user!, pass: pass! },
    });

    // verify() checks the connection and auth without sending
    await expect(transporter.verify()).resolves.toBe(true);
  }, 15000);
});
