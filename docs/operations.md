# Production operations

## Release gate

Before each production deploy:

1. Confirm the database provider reports a recent successful automated backup.
2. Run `npm run migrate` from the Render service environment.
3. Run `npm run audit:data` from the same Render environment.
4. Deploy only when the migration and every `PASS` audit row succeed.
5. Check `/api/health`, sign-in, one role-restricted page, and Gallery media.

Do not run a migration against a database whose identity or environment is
uncertain. The audit is read-only, but its result is meaningful only when run
with the production service's database variables.

## Backup and restore drill

Enable automated backups in the managed database provider and retain enough
history to recover from an unnoticed bad deploy. At least quarterly:

1. Restore the newest backup into a temporary, isolated database.
2. point a temporary backend environment at that restored database.
3. Run `npm run audit:data` and a basic Admin/Leader/Scout smoke test.
4. Record the backup timestamp, restore duration, and audit result.
5. Remove the temporary environment after verification.

Never test restoration by overwriting the live database. Provider-side backup
configuration and a completed restore drill require an operator with database
dashboard access; repository code cannot prove either one happened.

## Secret rotation

- Rotate SMTP keys in Brevo, update `SMTP_PASS` in Render, redeploy, verify one
  real delivery, then revoke the old key.
- Rotate database credentials in the provider, update Render, redeploy, verify
  health and the integrity audit, then revoke the old credential.
- Rotating `JWT_SECRET` signs every user out. Schedule it, update Render, and
  verify login and password reset afterward.
- Rotate `GALLERY_MEDIA_SECRET` by updating Render and redeploying. Existing
  signed Gallery links expire immediately and new API responses issue new ones.
- Rotate Cloudinary credentials in Cloudinary and Render, then verify upload,
  view, and delete behavior before revoking the old credential.

Store secrets only in provider environment settings. Never place them in Git,
logs, screenshots, support messages, or test fixtures.
