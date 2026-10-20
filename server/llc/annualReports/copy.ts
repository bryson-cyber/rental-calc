/**
 * The annual report reminder words (the owner, 2026-10-20: emails 60, 30 and 7 days before the due date and once
 * overdue). Coach Inayah's voice, rendered through this app's own client email shell (clientEmails.finalize: the
 * branded card, plain text kept alongside), white-label (never a provider or payment processor name), no dashes.
 * The link to her LLC page sits alone in its own paragraph so the shell draws it as the "File my annual report"
 * button; the page opens the filing straight from it (?file=annual-report).
 *
 * No text version: this app has no recorded agreement to texts that covers LLC members (see reminders.ts).
 */
import { finalize, type ClientEmailContent } from "../clientEmails";
import { feeWords } from "../../../shared/llcAnnualReports";

export type ReminderStage = "60" | "30" | "7" | "overdue";

export type ReminderCopyInput = {
  stage: ReminderStage;
  firstName: string;
  companyName: string;
  stateName: string;
  dueWords: string;
  daysLeft: number;
  fileUrl: string;
  quote: { priceCents: number; isMinimum: boolean } | null;
};

export const REMINDER_BUTTON_LABEL = "File my annual report";
export const PAY_AGAIN_BUTTON_LABEL = "Pay my state fee";
const SIGN_OFF = "The Coach Inayah team";

const flat = (value: string, max = 180) => value.replace(/[\r\n\t]+/g, " ").slice(0, max).trim();

function feeLine(quote: ReminderCopyInput["quote"]): string {
  if (!quote) return "pay the state's fee";
  if (quote.priceCents === 0) return "there's no state fee";
  return quote.isMinimum ? `pay the state's fee (it starts at ${feeWords(quote.priceCents)})` : `pay the state's ${feeWords(quote.priceCents)} fee`;
}

const daysWords = (days: number) => (days === 1 ? "1 day" : `${days} days`);

export function annualReportReminderEmail(input: ReminderCopyInput): ClientEmailContent {
  const company = flat(input.companyName) || "your LLC";
  const name = flat(input.firstName, 60);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const steps = `It takes a few minutes in your Coach Inayah account: answer the state's questions, ${feeLine(input.quote)}, and we file it for you. There's no extra charge from us.`;
  if (input.stage === "overdue") {
    return finalize(
      "Your LLC's annual report is past due",
      [
        greeting,
        "",
        `The annual report for ${company} was due ${input.dueWords}. Filing it now keeps your LLC in good standing with ${input.stateName}.`,
        "",
        steps,
        "",
        `${REMINDER_BUTTON_LABEL}:`,
        "",
        input.fileUrl,
        "",
        "Already sent it to the state yourself? Reply to this email and we'll update your account.",
        "",
        SIGN_OFF,
      ],
      REMINDER_BUTTON_LABEL,
    );
  }
  const subject =
    input.stage === "60"
      ? `Your ${input.stateName} annual report is due ${input.dueWords}`
      : input.stage === "30"
        ? `${daysWords(input.daysLeft)} until your annual report is due`
        : `Your annual report is due in ${daysWords(input.daysLeft)}`;
  return finalize(
    subject,
    [
      greeting,
      "",
      `Every year, ${input.stateName} asks ${company} for an annual report. Yours is due ${input.dueWords}${input.stage === "60" ? "" : `, ${daysWords(input.daysLeft)} from now`}.`,
      "",
      steps,
      "",
      `${REMINDER_BUTTON_LABEL}:`,
      "",
      input.fileUrl,
      "",
      SIGN_OFF,
    ],
    REMINDER_BUTTON_LABEL,
  );
}

/**
 * After ops refunded a payment made for a fee that then changed (ops "Fee changed: refunded" on /admin/llc): her
 * refund is on its way and the link to pay the fee on file. Same voice and rules as the reminders.
 */
export function annualReportPayAgainEmail(input: { firstName: string; companyName: string; stateName: string; priceCents: number | null; fileUrl: string }): ClientEmailContent {
  const company = flat(input.companyName) || "your LLC";
  const name = flat(input.firstName, 60);
  const fee = input.priceCents !== null && input.priceCents > 0 ? `the ${feeWords(input.priceCents)} state fee` : "the state fee";
  return finalize(
    "Your annual report: one more step",
    [
      name ? `Hi ${name},` : "Hi there,",
      "",
      `The state's fee for the annual report for ${company} changed after you paid, so we refunded your payment. It goes back to the card you used.`,
      "",
      `To finish, pay ${fee} in your Coach Inayah account. As soon as it's paid, we file your report with ${input.stateName}. There's no extra charge from us.`,
      "",
      `${PAY_AGAIN_BUTTON_LABEL}:`,
      "",
      input.fileUrl,
      "",
      SIGN_OFF,
    ],
    PAY_AGAIN_BUTTON_LABEL,
  );
}
