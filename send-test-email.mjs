import nodemailer from "nodemailer";

// Load env
import { config } from "dotenv";
config();

const SMTP_USER = process.env.HUBSPOT_SMTP_USER;
const SMTP_PASS = process.env.HUBSPOT_SMTP_PASS;
const SMTP_FROM = process.env.HUBSPOT_SMTP_FROM || "support@coachinayah.com";

if (!SMTP_USER || !SMTP_PASS) {
  console.error("Missing HUBSPOT_SMTP_USER or HUBSPOT_SMTP_PASS in env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.hubspot.net",
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Build a Morning Of email
const BRAND = {
  navy: "#0F172A",
  gold: "#C9A962",
  white: "#FFFFFF",
  offWhite: "#F8F6F1",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

const preheader = "Tonight's your night — here's what to expect...";
const preheaderHtml = `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</span>`;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.offWhite};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.offWhite};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<tr><td style="background-color:${BRAND.navy};padding:24px 40px;text-align:center;">
<h1 style="margin:0;color:${BRAND.gold};font-size:20px;font-weight:600;letter-spacing:0.5px;">COACH INAYAH</h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;font-weight:600;">Good morning, Bryson!</h2>
<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">Tonight at <strong>7:00 PM ET</strong> we're live.</p>
<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">I'll walk you through:</p>
<ul style="color:${BRAND.textDark};font-size:16px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
<li>How rental arbitrage works — no mortgage, no down payment — and what one property could actually profit</li>
<li>The funding piece: 0% interest business funding for a set period (good credit helps) so you're not draining savings to start</li>
<li>Real client examples (like my mom's $116K in under 10 months from 2 units)</li>
</ul>
<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">If you've ever thought, "I know I'm meant for more than just my paycheck," this class is for you.</p>
<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">Watch for your join link in your inbox and texts later today.</p>
<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:16px 0 0;">With you,<br><strong>Inayah</strong></p>
</td></tr>
<tr><td style="background-color:${BRAND.offWhite};padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
<p style="margin:0;color:${BRAND.textMuted};font-size:12px;">Coach Inayah | Las Vegas, NV<br>You registered for our Airbnb Masterclass.</p>
</td></tr>
</table></td></tr></table></body></html>`;

console.log("Sending test email to bryson@coachinayah.com...");
console.log(`SMTP User: ${SMTP_USER}`);
console.log(`From: "Inayah" <${SMTP_FROM}>`);

try {
  const result = await transporter.sendMail({
    from: `"Inayah" <${SMTP_FROM}>`,
    to: "bryson@coachinayah.com",
    subject: "[TEST] Tonight: Your 90-minute Airbnb game plan",
    html,
    replyTo: SMTP_FROM,
  });
  console.log("✅ Email sent successfully!");
  console.log("Message ID:", result.messageId);
  console.log("Response:", result.response);
} catch (error) {
  console.error("❌ Failed to send:", error.message);
  process.exit(1);
}
