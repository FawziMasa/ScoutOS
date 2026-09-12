# ScoutOS Advisor Plan

Date: 2026-09-12

## Delivery status

- Phase 1 repository safeguards are implemented: signed Gallery media access,
  fail-closed schema startup, Brevo deployment guidance, and an operations
  runbook.
- Local checks pass. The integrity audit reached an empty/non-production schema,
  so it must still be run from Render with the production database environment.
- Automated backup status and a restoration drill must be confirmed by an
  operator in the managed database dashboard.
- Phase 2 is implemented: Admin-only Scout invitations, 24-hour hashed tokens,
  self-service password setup, resend/revoke/expiry/failure states, and focused
  authorization and token tests.
- Phase 3A Finance integrity is implemented: draft/submission/approval/rejection
  states, append-only history, cancellation instead of deletion, approved
  reversals, approval evidence, and scope-safe CSV export.
- Phase 3B receipt files are implemented with signature validation, strict size
  and count caps, authenticated unit-scoped downloads, and soft removal. The
  current MySQL binary store is intentionally a small-group bridge; external
  object storage remains the scale target.

## Executive verdict

ScoutOS is a credible internal operations MVP with strong foundations. It is
already useful, but it should stop expanding horizontally for a while.

The best next phase is to make the existing system trustworthy, easier to use,
and safer for real Scout data. The priority should be privacy, data integrity,
account onboarding, operational visibility, and production confidence.

ScoutOS is not yet formal accounting software or a large-scale media platform.
It should not be marketed or designed as either until the gaps below are fixed.

## What is already strong

- Four-role access model: Admin, Group Leader, Unit Leader, and Scout.
- Backend authorization derives access from the authenticated database account.
- Multi-unit Unit Leaders are supported.
- Scout records, points, attendance, Events, Gallery, Finance, and accounts exist.
- Points use an immutable ledger with duplicate-request protection.
- Account deactivation invalidates existing sessions.
- Password reset is a real working flow through Brevo SMTP and has been
  verified with an actual received email.
- Password-reset tokens are hashed, expiring, single-use, rate-limited, and
  removed when email delivery fails.
- Gallery has a storage boundary and a persistent MySQL fallback.
- Finance supports scoped totals, income, expenses, balance, debt, filters, and
  refresh.
- Backend tests, syntax checks, frontend lint, frontend build, and CI exist.

## The most important missing capability: Scout onboarding

Scout accounts technically exist, but the current process is manual. An Admin
must create the Scout record, create a Scout login, link the login to the Scout,
set an initial password, and give the credentials to the Scout.

That is not the right long-term experience because the Admin knows or handles
the Scout's password.

### Recommended Scout invitation flow

1. Admin creates or selects an existing active Scout.
2. Admin clicks **Invite Scout** and confirms the Scout email.
3. ScoutOS creates a short-lived, single-use invitation token.
4. Brevo sends an invitation email.
5. Scout opens the link and chooses their own password.
6. The account becomes active and is linked to exactly one Scout record.
7. Scout signs in and sees only their own profile, points, attendance, Events,
   Gallery, and leaderboard content.

Required controls:

- Invitation expiration.
- Single-use token hashing.
- Resend and revoke invitation actions for Admins.
- No open public registration.
- No password displayed to or chosen by an Admin.
- Safe handling of Scouts without an email address.
- Clear account states: invited, active, inactive, and expired.

## Priority 1: fix trust and privacy risks

### Gallery image access

The image media endpoint can be reached without authentication once someone has
the image URL. The application pages are protected, but the raw image URL is
publicly usable and cacheable.

For Scout photographs, especially children, this needs an explicit decision.
The preferred design is authenticated media access or short-lived signed URLs.

### Database startup behavior

The backend logs schema migration errors but continues starting. This can make
the service appear live while required tables or indexes are missing.

Production should fail readiness clearly when required schema setup fails.
Migrations should be run deliberately and safely, with a documented rollback or
recovery process.

### Session storage

The frontend stores bearer tokens in browser storage. This is acceptable for the
current MVP but increases the impact of a future XSS issue.

The stronger future design is secure HTTP-only cookies with server-managed
sessions or refresh-token rotation.

### Login protection

Login throttling currently lives in one Node process's memory and is keyed
primarily by username. It resets when the process restarts and does not scale
across instances.

For the current single-instance deployment this is acceptable, but it should
eventually move to a shared limiter or edge/platform protection.

## Priority 2: make data safe for real operations

### Finance

Finance is a good register, but it is not formal accounting yet. Before relying
on it for official records, add:

- Receipt attachments using external storage.
- Reversal or archival instead of hard deletion.
- Approval states and permissions.
- Append-only status history.
- CSV export.
- Clear created-by and approved-by audit information.

The current status model should eventually distinguish draft, submitted,
approved, rejected, and cancelled transactions.

### Backups and integrity

- Run the production read-only data-integrity audit after migrations.
- Establish automated database backups and test restoration.
- Monitor database size and Gallery storage growth.
- Keep production secrets only in Render/Brevo/Cloudinary settings.
- Document how to rotate SMTP, database, JWT, and storage credentials.

### Gallery storage

The MySQL image fallback is suitable for a small group and avoids Render's
ephemeral filesystem. It should not become the long-term storage plan for a
large photo library. Move production Gallery storage to Cloudinary or another
object-storage provider before the database grows significantly.

## Priority 3: turn the dashboard into the daily command center

The current dashboard shows useful counts, but it should answer what needs
attention today rather than mainly link to other pages.

Recommended dashboard content:

- Active Scout count by unit.
- Next event and registration count.
- Attendance needing completion.
- Recent attendance or points activity.
- Finance balance, income, expenses, and pending transactions.
- Gallery activity.
- Alerts for inactive accounts, failed invitations, or incomplete records.
- A real last-updated time and manual refresh state.

Avoid displaying static claims such as “All systems operational” unless that
status is actually checked.

## Priority 4: improve the daily workflows

- Calendar view for Events.
- Clear event registration and attendance relationship.
- Attendance history export.
- Scout invitation and account status indicators.
- Better empty, loading, and error states.
- Arabic/English language consistency where users need it.
- Search and filtering that work consistently across modules.
- Mobile-first attendance workflow for leaders using phones at meetings.

## Testing and release confidence

The existing unit tests are a strong start, but they do not replace a real
browser-level test.

Add a small end-to-end test covering:

1. Admin login.
2. Scout creation.
3. Scout invitation or activation.
4. Scout login.
5. Scout sees only Scout-safe content.
6. Leader cannot access an unassigned unit.
7. Password reset email request and reset completion.

Also add tests for Gallery privacy, finance reversal behavior, account
deactivation, and migration failure handling.

## Documentation corrected in Phase 1

The README and password-reset deployment guide now describe:

- Brevo SMTP host and port.
- SMTP key versus API key.
- Verified sender requirement.
- Free-plan sending limits.
- Secret rotation procedure.
- Render environment variables without real values.

## What I recommend saying “no” to for now

Do not build these before the priorities above:

- AI chatbot features.
- Native mobile apps.
- Payments.
- A social feed.
- A complex notification platform.
- A large reporting suite.
- More standalone modules.
- Formal accounting claims without approvals and audit history.
- Large Gallery growth on MySQL blobs.
- Open public Scout registration.

These features can create impressive screens while leaving the core system
less trustworthy.

## Best implementation order

### Phase 1: trust

1. Protect Gallery media access.
2. Make migration failures visible and safe.
3. Run the production data-integrity audit.
4. Set up backups and restoration testing.
5. Update stale deployment documentation.

### Phase 2: people

6. Build secure Scout invitations and self-service password setup.
7. Add invitation resend, revoke, expiry, and account-state handling.
8. Add the small end-to-end role and onboarding test.

### Phase 3: operations

9. Add Finance receipts, reversals, approvals, history, and export.
10. Improve the dashboard into a real operations command center.
11. Improve mobile attendance and Event workflows.

### Phase 4: scale

12. Move Gallery storage to external object storage.
13. Improve shared rate limiting and session security.
14. Add monitoring, alerts, and a formal release checklist.

## Final advisor recommendation

ScoutOS has enough features to start earning trust. The next question should
not be “what screen can we add?” It should be “can leaders safely depend on the
information and can Scouts safely use their own accounts?”

The next feature I would approve is **secure Scout invitations**. Before that,
I would address the Gallery privacy decision and production data safeguards.

The next feature I would reject is another unrelated module.
