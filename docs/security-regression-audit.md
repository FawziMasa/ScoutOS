# ScoutOS security, regression, and data-integrity audit

Audit date: 2026-09-12. Automated result: backend syntax checks passed, 25/25
backend tests passed, frontend lint passed, and the production frontend build
passed. No live production credentials or inbox were used during this audit.

| Area | Test | Expected | Actual | Status | Fix |
| --- | --- | --- | --- | --- | --- |
| Authentication | Invalid, disabled, or stale session | Generic denial | DB account, `active`, expiry, signature, and `session_version` are checked | Pass | Session version now invalidates edited/deactivated accounts |
| Password reset | Unknown email, invalid/expired/reused token | No enumeration; no reuse | Generic response, hashed random token, expiry and single-use transaction covered by tests | Pass | SMTP failures remove pending tokens; bounded IPv4 transport |
| Authorization | Tampered role/actor/unit | Server ignores forged authority | Actor and access come from hydrated DB account; assigned/outside-unit tests pass | Pass | Central authorization helpers and scoped queries |
| Scouts | Scout changes target ID | Own record only | Linked `scout_id` is checked on private reads; mutation roles denied | Pass | Added own-data route enforcement and Scout portal |
| Accounts | Role/unit/scout-link changes | Admin-only, atomic, unique | Admin guard, transaction, active-unit validation, unique Scout link, last-admin protection | Pass | Multi-unit replacement is transactional; deletion is deactivation |
| Points | Award/deduct, duplicate request, outside unit | Immutable and scoped | Ledger writes derive actor/Scout unit; request ID uniqueness and positive/negative tests pass | Pass | Added idempotency key and bounded non-zero integer validation |
| Attendance | Unit/history filter bypass | Assigned units only | Server constructs authorized unit set; Scout mutations denied; session/Scout uniqueness enforced | Pass | Unit/date/status/search filters are server-scoped |
| Gallery | Unit Leader uses global/outside album | Denied | Assigned-album creation/write tests pass; Scout is view-only | Pass | Added canonical album unit, metadata, migration, and UI filtering |
| Finance | Scout/outside-unit access and total math | Denied/correct scope | Scoped service tests and whole-balance/debt calculation pass | Pass | All routes use authenticated unit scope |
| Frontend | Role routes, Arabic content, responsive build | No TS/lint regression | Vite production build and ESLint pass | Pass | Role-aware routes/navigation and responsive filters |
| Database | Orphans, duplicate pairs, required indexes | Zero findings | Read-only audit command added; production execution needs DB environment | Manual | Run `npm run migrate` then `npm run audit:data` on Render |
| Email delivery | Real Brevo handoff and inbox receipt | Provider accepts and email arrives | Verified through Render, Brevo, and a real inbox on 2026-09-12 | Pass | Keep the sender verified and rotate exposed SMTP keys |

## Vulnerabilities corrected

- Unit Leaders can no longer escape assigned scope through submitted unit IDs.
- Scouts cannot invoke leader mutations or read another Scout's private record.
- Point actor IDs cannot be forged and duplicate submits are idempotent.
- Account updates revoke existing sessions and preserve historical references.
- Gallery album writes now enforce canonical unit ownership on the backend.
- Password reset tokens are hashed, expiring, single-use, rate-limited, and not
  retained when SMTP delivery fails.

## Remaining operational work and debt

Run the live read-only data audit after the production migration. Brevo SMTP and
real inbox delivery are confirmed. Cloudinary is recommended before Gallery volume grows. Finance
receipt attachments, append-only approval history, and export remain documented
extensions; current transaction deletion is still a hard delete and should move
to reversal/archival before formal accounting use.

## Deployment sequence

1. Push/deploy `main` to Render and Vercel.
2. In the Render backend, run `npm run migrate` and then `npm run audit:data`.
3. Confirm `/api/health`, Admin login, one multi-unit Unit Leader, and one Scout.
4. Request a password reset and verify the provider handoff and real inbox.
5. Upload one assigned-unit Gallery photo and confirm persistence after restart.
