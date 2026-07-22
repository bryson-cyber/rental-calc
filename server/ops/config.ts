/**
 * Operations configuration for the white-label reseller flow.
 *
 * OPS_EMAIL is the address that receives every operational alert (wholesale
 * checkout ready, filing progress, problems). It is also the base identity for
 * per-registration Whop connected-account aliases so that no Whop-originated
 * account email can ever reach an end client.
 */
export class OpsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpsConfigurationError";
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export type OpsConfig = {
  opsEmail: string;
  resendApiKey: string | null;
  resendFrom: string;
  smtp: SmtpConfig | null;
  appBaseUrl: string | null;
};

export function getOpsConfig(env: NodeJS.ProcessEnv = process.env): OpsConfig {
  const opsEmail = env.OPS_EMAIL?.trim() ?? "";
  if (!opsEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opsEmail)) {
    throw new OpsConfigurationError(
      "OPS_EMAIL is missing or invalid. Set it to the operations inbox that should own Whop accounts and receive alerts.",
    );
  }

  // HubSpot (or any) SMTP relay. Falls back to HUBSPOT_SMTP_* env vars
  // (used by the rest of the app for webinar emails) when SMTP_HOST is not set.
  const smtpHost = env.SMTP_HOST?.trim() || (env.HUBSPOT_SMTP_USER?.trim() ? "smtp.hubapi.com" : "");
  const smtpUser = env.SMTP_USER?.trim() || env.HUBSPOT_SMTP_USER?.trim();
  const smtpPass = env.SMTP_PASS?.trim() || env.HUBSPOT_SMTP_PASS?.trim();
  const smtpFrom = env.SMTP_FROM?.trim() || env.HUBSPOT_SMTP_FROM?.trim() || opsEmail;
  const smtp: SmtpConfig | null =
    smtpHost && smtpUser && smtpPass
      ? {
          host: smtpHost,
          port: Number(env.SMTP_PORT?.trim() || "587"),
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
        }
      : null;

  return {
    opsEmail,
    resendApiKey: env.RESEND_API_KEY?.trim() || null,
    resendFrom: env.RESEND_FROM?.trim() || "onboarding@resend.dev",
    smtp,
    appBaseUrl: env.APP_BASE_URL?.trim().replace(/\/+$/, "") || null,
  };
}

/**
 * The email placed on the Whop connected account for a registration. Always an
 * owner-controlled alias (plus-addressing on the ops inbox), never a client
 * or founder address, so Whop's account/formation emails route to operations.
 * WHOP_ACCOUNT_EMAIL overrides the base inbox when the ops team wants a
 * dedicated mailbox (e.g. filings@yourdomain.com) instead of OPS_EMAIL.
 */
export function connectedAccountEmailAlias(
  registrationId: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const base = env.WHOP_ACCOUNT_EMAIL?.trim() || env.OPS_EMAIL?.trim() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base)) {
    throw new OpsConfigurationError(
      "Cannot derive a Whop account email alias: set OPS_EMAIL (or WHOP_ACCOUNT_EMAIL) to a plain valid address like filings@yourdomain.com.",
    );
  }
  const separatorIndex = base.lastIndexOf("@");
  const local = base.slice(0, separatorIndex).split("+")[0];
  const domain = base.slice(separatorIndex + 1);
  return `${local}+reg${registrationId}@${domain}`;
}
