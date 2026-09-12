# Scout account invitations

Scout accounts are created only by an Admin and linked one-to-one with an
existing active Scout record. ScoutOS does not provide open registration.

## Admin flow

1. Open **Manage Accounts** and create an account with role **Scout**.
2. Select the linked Scout and enter the Scout's email address.
3. Save. The account is inactive and ScoutOS sends a one-time invitation.
4. Use **Resend** to invalidate the old link and issue a new one, or **Revoke**
   to invalidate the pending link without deleting the account.

The Admin never chooses or sees the Scout's password. An inactive Scout can be
activated only by accepting a valid invitation. An already-active Scout can use
the normal password-reset flow.

## Security behavior

- Invitation tokens are random, stored only as SHA-256 hashes, single-use, and
  expire after 24 hours.
- The token is carried in the URL fragment so it is not sent in the initial web
  request or Vercel route logs.
- Resending, revoking, editing, or deactivating the account revokes outstanding
  invitations.
- Acceptance verifies that the account is still an inactive Scout account and
  is still linked to an active Scout record.
- Acceptance activates the account, changes its session version, consumes the
  selected invitation, and revokes every other outstanding invitation.
- Logs contain only a masked recipient reference and never contain invitation
  tokens or SMTP credentials.

Account states shown to Admins are **Invited**, **Active**, **Inactive**,
**Expired**, and **Invite failed**.

## Deployment check

The invitation sender uses the same verified Brevo SMTP configuration as
password reset. After deployment, create a disposable inactive Scout account,
confirm receipt, activate it, verify Scout-only access, then deactivate or
remove the disposable data according to the normal retention policy.
