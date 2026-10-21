# Changelog

## 2.6.0 — 2026-10-21 · Performance
- Only the visible tab renders on each update; the others render when the phone is idle or when opened (~33% less work per update on a 6× throttled CPU).
- Realtime changes are coalesced into one render per frame; local cache writes are batched and flushed on hide.
- Long lists use `content-visibility` so off-screen rows are not painted.
- Fast mode: on slow phones (detected by measuring frame times on first launch, or by device memory) the glass blur and animated background are replaced by solid equivalents — scrolling went from ~32 to ~56 fps under 6× CPU throttling. Manual switch in Más → Apariencia.

## 2.5.0 — 2026-10-21
- Luca glass theme across the whole app, in light and dark: slowly drifting blue, indigo and lime aurora behind frosted translucent cards, sheets and bars; blue-to-indigo hero with a lime glow; Luca blue as the primary color.

## 2.4.2 — 2026-10-21
- Sign-in with a code now waits for the verification animation: cards fan out while the seal laps the edge (at least 1.3 s), then the slots turn green with a "Verified ✓" state, and only then the app opens.

## 2.4.0 — 2026-10-21
- New sign-in screen: dark frosted-glass card with corner shards over a futuristic backdrop in Luca colors: drifting blue, indigo and lime aurora, a moving perspective grid and light beams (pure CSS/SVG, no images); blue-to-lime headline and lime button with arrow.
- Icons inside the name, email and password fields; eye / eye-off icon to show the password.
- Sign-up now asks to confirm the password and to accept the terms and privacy policy.

## 2.3.2 — 2026-10-21
- Sign-in code now 8 digits (configurable with `OTP_LEN` in `config.js`); tighter card fan that stays on screen.
- Every text field and select shares the code input's motion: focus halo and lift, a small pop while typing, red shake and haptic on validation errors.
- Busy buttons show a light that laps the border (same "seal" as the code input).

## 2.3.0 — 2026-10-21
- New sign-in code input: six "card" slots that fan out like a hand of cards while verifying (one rotation around a pivot below the row), a progress seal that laps the edge, green on success, shake and auto-clear on a wrong code. Auto-submits on the 6th digit; paste and iOS/Android one-time-code autofill still work (single real input underneath). Respects reduced motion.

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
