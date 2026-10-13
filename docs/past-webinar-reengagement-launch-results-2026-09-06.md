# Past-Webinar Re-engagement Launch Results — September 6, 2026

## Record provenance

This historical record was restored on October 13, 2026 from the inherited task summary after a sandbox reset. The original uncheckpointed document was absent from both the restored project and available archived history. These are the previously reported launch outcomes, not a new October 13 database or provider audit.

## Authorization and scope

The user explicitly approved the launch (`A`, then `go`). That one-time campaign is complete. This record does **not** authorize any future send or resend.

The audience used all deduplicated historical webinar registrants across the system, segmented by prior attendance. Exclusions included active HubSpot Turnkey Program deals, customers/students, current webinar registrants, recent webinar email conflicts (7 days), HubSpot suppressions/bounces, invalid contacts, SimpleTexting/local opt-outs, and duplicate SMS phones.

## Reported completed launch

| Segment | Email requests completed | Unique opted-in SMS phones |
|---|---:|---:|
| Prior attendees | 1,461 | 1,124 |
| Prior registrants/no-shows | 4,537 | 2,436 |
| **Total** | **5,998** | **3,560** |

Two email and two SMS campaign segments were launched through persistent promo infrastructure. All four steps were reported complete with zero app-level failures, skips, or pending recipients. Email was sent first; SMS was released after an email-provider health checkpoint.

## Delivery distinction

- HubSpot downstream **sample of 300 recipients**: 293 delivered, 5 deferred, 2 dropped (97.7% delivered in this sample only).
- All 3,560 SMS requests were accepted by SimpleTexting with provider IDs.
- The available provider history endpoint did not expose final carrier receipts. **Accepted must not be reported as carrier-delivered.**
- App-level email completion/SMTP acceptance must not be reported as final inbox delivery.
- These results do not establish complete-list delivery, open, click, unsubscribe, or conversion totals.

## Approved message reference

- Subject: `Free training: your first Airbnb without buying a property`
- CTA: https://masterclass.coachinayah.com/the-turnkey-program
- Offer: the user-supplied $2,997 Turnkey Program and 12-month conditional first-unit guarantee.
- Financing qualification: `Financing may be available for as low as $200 per month, subject to approval. Terms and monthly payments vary.`
- Promotional SMS retained `STOP to opt out.`

## October 13 sync safeguards

No campaign messages were sent or resent to restore this document. Campaign database records were not modified as part of the GitHub sync. Temporary launch scripts were not recreated. Any future resend requires fresh audience/suppression checks and explicit user approval.
