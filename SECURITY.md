# Security

Luca stores people's debts, balances and spending, so security is a product feature, not an afterthought. This document describes the threat model, the controls in place and how to report a vulnerability.

## Reporting a vulnerability

Email **luca.app.col@gmail.com** with the subject `SECURITY`. Please do not open a public issue. You will get an answer within 72 hours. Also published at [`/.well-known/security.txt`](.well-known/security.txt).

## Threat model

| Threat | Example | Main controls |
|---|---|---|
| Reading another user's data | Calling the REST API with your own token but someone else's `user_id` | Row Level Security on every table, views with `security_invoker`, `anon` role revoked |
| Upgrading yourself to Pro | `update profiles set plan='pro'` from the browser | No `insert/update/delete` grant on `profiles`; only the server-side webhook (service role) changes plans |
| Forged payment notification | POST to the webhook pretending a payment happened | Shared secret ≥ 32 chars, constant-time comparison, 10 KB body limit, POST only |
| Cross-site scripting (XSS) | A card named `<img onerror=…>` | Every user value goes through `esc()`; strict Content-Security-Policy with `script-src 'self'` blocks inline scripts even if one slips through; automated XSS test |
| Supply-chain attack on a CDN | Compromised third-party script | Supabase client is **self-hosted** in `vendor/` and pinned to an exact version; no third-party scripts at all; Dependabot + CodeQL |
| Clickjacking | Luca loaded invisibly in an iframe | Frame-busting in `boot.js` (GitHub Pages cannot send `frame-ancestors`), `frame-src 'none'` |
| Data exfiltration | Injected code sending data to an attacker's server | CSP `connect-src` allow-list: only the Supabase project and the official exchange-rate API |
| Lost or shared phone | Someone opens the app | Optional fingerprint / Face ID lock (WebAuthn, platform authenticator), relocks after 60 s in background; privacy mode blurs amounts |
| Shared computer | Data left in the browser after logout | Logout wipes the local cache, session token and lock credential |
| Database abuse | A modified client floods the free tier | Collection allow-list, 64-char ids, 16 KB per document, 20,000 rows per user (DB constraints and trigger) |
| Malicious backup file | A crafted JSON import | 5 MB limit, prototype-pollution keys stripped, per-record size and id checks, row cap |
| Account takeover | Weak passwords, brute force | 8+ character passwords, 8-digit email codes with expiry, Supabase Auth rate limits |

## Controls by layer

**Browser**
- Content-Security-Policy (meta tag): `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'` plus a `connect-src` allow-list.
- No inline scripts or inline event handlers anywhere; `referrer` policy set.
- Output encoding with a single `esc()` helper for all user data rendered as HTML.

**Data & auth (Supabase / PostgreSQL)**
- RLS policies `auth.uid() = user_id` for select, insert, update and delete — see [`supabase/schema.sql`](supabase/schema.sql).
- Hardening in [`supabase/security.sql`](supabase/security.sql): check constraints, per-user row limit, server-side timestamps, revoked grants, internal functions not callable from the API, and a query that lists any table without RLS.
- `security definer` functions pin `search_path = ''`.
- The anon key in `config.js` is public by design; the service-role key only exists as an Edge Function secret.

**Server (Edge Function)**
- [`payment-webhook`](supabase/functions/payment-webhook/index.ts): secret header with constant-time comparison, minimum secret length, payload size limit, strict input validation.

**Repository & CI**
- CodeQL (`security-extended`) on every push and weekly; Dependabot for npm and GitHub Actions; least-privilege `GITHUB_TOKEN` permissions.
- Signing keys and keystores are never committed (`.gitignore`).
- End-to-end security tests: XSS payloads in names and notes, CSP presence, no third-party scripts, local data wiped on logout.

## Recommended Supabase settings

In the Supabase dashboard (Authentication): enable leaked-password protection, keep email OTP expiry at 10 minutes or less, keep the default rate limits, and enable CAPTCHA if sign-up abuse appears.

## Known limitations

- GitHub Pages cannot send HTTP security headers, so CSP is delivered via `<meta>` (no `frame-ancestors` or reporting). Moving to Cloudflare Pages or Netlify would allow full headers.
- `style-src` allows `'unsafe-inline'` because dynamic charts use inline `style` attributes. Scripts remain strict.
- Data is encrypted in transit (HTTPS/WSS) and at rest by Supabase, but not end-to-end encrypted.
