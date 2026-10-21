# Changelog

## 2.2.0 — 2026-10-21 · Security
- Strict Content-Security-Policy (no inline or third-party scripts) and referrer policy on every page.
- Supabase client self-hosted and pinned in `vendor/` (no CDN supply-chain risk); clickjacking protection.
- Logout wipes local cache, session and biometric lock; hardened backup import (size, prototype pollution, row caps).
- `supabase/security.sql`: collection allow-list, size and row limits, server timestamps, revoked grants.
- Payment webhook: constant-time secret check, payload limit.
- CodeQL, Dependabot, least-privilege CI, `SECURITY.md` threat model, `security.txt`, automated XSS/CSP tests.

## 2.1.0 — 2026-10-21
- **Pregúntale a Luca**: chat that answers questions about your money ("¿cuánto gasté en comida?", "¿cuánto debo?", "¿cuándo vence…?") computed entirely on the device.
- **Fingerprint / Face ID lock** (WebAuthn platform authenticator), auto-relock after 60 s in background.
- New Seguridad section in Más; tests for the assistant.

## 2.0.0 — 2026-10-21
- Daily rings and streak, "Luca insights", smart payment plan (avalanche/snowball), paycheck splitter, subscription hunter, privacy mode, Luca Pro screen.
- iOS-style redesign: large titles, compact translucent nav bar, Wallet-style quick actions, light cards.
- Test suite moved into the repo; GitHub Actions CI.

## 1.4.0 — 2026-10-20
- Credit-limit usage colors (healthy / halfway / almost full / over limit); cards sorted by due date; "No debt" group.

## 1.3.0 — 2026-10-20
- Inter typeface on Android, spring animations, swipe-to-dismiss sheets, haptics.

## 1.2.0 — 2026-10-20
- Free-until-payday, "Can I afford it?", quick expenses, natural-language expense input, monthly recap, animated goals, payment reminders (.ics), debt-free simulator, English, new logo, Android package for Google Play.

## 1.1.0 — 2026-10-19
- Accounts with email codes (Supabase Auth + Brevo), onboarding, CSV export, backups, account deletion, Android APK.

## 1.0.0 — 2026-10-18
- First public version: cards in COP and USD, paychecks on the 15th and 30th, calendar, savings accounts, budgets and goals.
