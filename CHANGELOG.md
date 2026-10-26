# Changelog

## 3.1.0 — 2026-10-26
- iOS navigation bar: plain blue glyph buttons (chat, +, privacy) above a 34 pt large title; greeting in sentence case instead of an uppercase eyebrow.
- No floating action button on phones: "+" lives in the nav bar like iOS apps.
- Status labels are text, not colored pills; no emoji or decorative flame; sparkle icon replaced by a chat bubble.
- Payment warnings use a normal white card (color only on the dates); card buttons are rounded rectangles; "add" buttons are plain blue text.

## 3.0.0 — 2026-10-26 · Pure iOS look
- Removed the glass/aurora theme: no backdrop blur, no animated gradients, no purple or lime accents.
- iOS system palette: grouped background (#F2F2F7 / black), flat white or #1C1C1E cards, system blue, hairline separators, solid tab bar, gray initials avatar like Contacts.
- Sign-in screen is now a plain iOS screen: large title, filled text fields, segmented control, blue button.
- Code input, fields and buttons keep their motion (springs, shake on error) but drop halos and glows.

## 2.8.1 — 2026-10-26
- Mobile-native pass: hover styles gated behind `(hover: hover) and (pointer: fine)` so they don't stick after a tap, overscroll contained in sheets and chat, no long-press callout on controls, 16 px minimum input text on touch, keyboard resizes the layout on Android (`interactive-widget`), status bar colors match the new canvas.

## 2.8.0 — 2026-10-26 · Apple design pass
- Sheets: swipe-to-dismiss now follows the finger 1:1 after a 10 px threshold, projects release momentum (Apple's deceleration formula) to decide close vs. return, and finishes with a velocity-inheriting spring (critically damped to close, slight bounce to return).
- Size-specific tracking (tighter display text, neutral small text), smooth light/dark theme change, light-catching top edge on the glass tab bar.
- Honors `prefers-reduced-transparency` (solid surfaces) and `prefers-contrast: more` (defined borders).
- Tests pin the clock so date-dependent checks are deterministic.

## 2.7.0 — 2026-10-21
- Linked accounts (Más → Cuenta): link or unlink Google and Apple (iCloud) to the same Luca account, or add a password; uses Supabase identity linking.
- Sign-in screen explains that Google/Apple with the same email links to the existing account automatically.

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
