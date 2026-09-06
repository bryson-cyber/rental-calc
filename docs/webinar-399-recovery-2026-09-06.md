# Webinar 399 Delivery Recovery — September 6, 2026

## Root cause

Webinar `399` (`Webby 9.6.26`, schedule `713`) was selected and its 11-message sequence was scheduled, but the global `cron_enabled` setting did not exist. The import heartbeat was healthy yet returned `skipped: true`, leaving the local audience at zero. The SMS dispatcher therefore marked the first four due sequence rows sent with zero recipients, while the email dispatcher wrote zero-recipient completion markers.

## Immediate recovery

The missing setting was enabled at 20:18 UTC. The next import loaded all 86 WebinarJam registrants. The still-timely `3 Hours Before` zero-recipient marker and schedule status were safely reset because no recipient-level email or SMS record existed. At 20:23 UTC, the system sent 86/86 emails through HubSpot SMTP and attempted all 86 SMS records: 25 accepted, 53 skipped as unsupported international numbers, and eight rejected as locally unsubscribed/opted out.

The remaining `1 Hour Warning`, `15 Min Before`, and `Starting NOW` steps remain pending at their correct times. Audience-specific post-event messages remain gated by fresh WebinarJam attendance data.

## Permanent prevention

Selecting a webinar now creates the missing `cron_enabled=true` default without overriding an explicit admin disable. The import heartbeat also treats a missing setting as enabled and respects only an explicit `false`. Confirmation SMS and email work is bounded per import cycle so larger audiences do not exceed the platform callback timeout; atomic claims allow later cycles to continue without duplicates.
