# Password reset deployment

ScoutOS sends password-reset emails through Brevo SMTP. The sender address must
be verified in Brevo before messages will be delivered.

Set these environment variables in Render for the backend service:

```env
FRONTEND_URL=https://your-frontend-domain.example
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_FAMILY=4
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=your-brevo-smtp-key
EMAIL_FROM="SCOUT OS <verified-sender@example.com>"
```

Use Node 20 or newer for the backend service. This is declared in `backend/package.json`.

In Brevo, create an SMTP key under SMTP & API and use the displayed SMTP login
as `SMTP_USER`. Use the SMTP key as `SMTP_PASS`; do not use the Brevo account
password or an API key. Keep unauthorized-IP blocking disabled unless the
hosting provider supplies a stable outbound IP. Never commit the SMTP key.

The working production path was verified on 2026-09-12: Render connected to
Brevo on port 2525, Brevo accepted the message, and the reset email arrived in a
real recipient inbox.

The backend applies its additive MySQL migration on startup. It adds `users.email`, `users.session_version`, `password_reset_tokens`, and `password_reset_rate_limits` without deleting existing records. Existing users can continue logging in, but need a unique email address before they can receive password-reset messages. Resetting a password invalidates their previously issued sessions.

For deployments that run migrations separately, execute `npm run migrate` in `backend`. The SQL reference migration is `database/20260907_add_password_reset.sql`.
