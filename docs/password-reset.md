# Password reset deployment

ScoutOS sends password-reset emails through Gmail SMTP. The sender should be configured as `SCOUT OS <scoutssystem@gmail.com>`.

Set these environment variables in Render for the backend service:

```env
FRONTEND_URL=https://your-frontend-domain.example
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FAMILY=4
SMTP_USER=scoutssystem@gmail.com
SMTP_PASS=your-google-app-password
EMAIL_FROM="SCOUT OS <scoutssystem@gmail.com>"
```

Use Node 20 or newer for the backend service. This is declared in `backend/package.json`.

Enable 2-Step Verification on `scoutssystem@gmail.com`, then generate a Google App Password for ScoutOS. Use that App Password as `SMTP_PASS`; do not use the normal Gmail password or commit it to source control.

The backend applies its additive MySQL migration on startup. It adds `users.email`, `users.session_version`, `password_reset_tokens`, and `password_reset_rate_limits` without deleting existing records. Existing users can continue logging in, but need a unique email address before they can receive password-reset messages. Resetting a password invalidates their previously issued sessions.

For deployments that run migrations separately, execute `npm run migrate` in `backend`. The SQL reference migration is `database/20260907_add_password_reset.sql`.
