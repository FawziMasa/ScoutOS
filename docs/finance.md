# ScoutOS Finance architecture

ScoutOS already contains the Finance foundation and an operational transaction
screen. This document records the implemented contract and the safe extension
path for receipts, approvals, and exports.

## Implemented schema

`finance_transactions` stores:

- unit, transaction type (`INCOME` or `EXPENSE`), category, and description;
- vendor/recipient, positive decimal amount, payment method, and workflow status;
- transaction date, reference number, and internal notes;
- creating/editing/approving account IDs and timestamps, rejection evidence,
  and an optional link to the approved record being reversed.

`finance_status_history` is append-only and records every state change, reason,
actor, and timestamp. The transaction table indexes unit/date, status, category,
actors, and reversal links. Actor
foreign keys use `ON DELETE SET NULL`, so account removal does not erase the
financial audit context. The schema bootstrap is
`backend/database/financeMigration.js`; the SQL reference is
`database/20260911_create_finance_transactions.sql`.

## Implemented API and screen

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/finance/transactions` | Scoped list with unit/type/category/status/date/search filters |
| `POST` | `/api/finance/transactions` | Create a scoped transaction |
| `GET` | `/api/finance/transactions/:id` | Read one authorized transaction |
| `PUT` | `/api/finance/transactions/:id` | Correct one authorized transaction |
| `POST` | `/api/finance/transactions/:id/submit` | Submit a draft for approval |
| `POST` | `/api/finance/transactions/:id/approve` | Admin approval |
| `POST` | `/api/finance/transactions/:id/reject` | Admin rejection with a reason |
| `POST` | `/api/finance/transactions/:id/cancel` | Cancel an unapproved record without deleting it |
| `POST` | `/api/finance/transactions/:id/reverse` | Create an offsetting approved reversal |
| `GET` | `/api/finance/transactions/:id/history` | Read append-only status history |
| `GET` | `/api/finance/summary` | Income, expenses, balance, debt, month, pending, count |
| `GET` | `/api/finance/export.csv` | Export the same authorized/filtered rows as UTF-8 CSV |

The Finance page provides live/manual refresh, a full or clearly filtered scope
label, balance/debt state, totals, filters, transaction table, and create/view/
edit dialogs, approval actions, reversal actions, status history, and CSV export.
Only approved transactions affect income, expenses, and balance.

New records always start as `DRAFT`. Drafts can be edited and submitted.
`SUBMITTED` records can be approved or rejected by an Admin. Editing a rejected
record returns it to draft. Unapproved records can be cancelled but are never
deleted. Approved records are immutable; an Admin corrects one by creating a
single linked transaction of the opposite type and equal amount.

## Permission matrix

| Capability | Admin | Group Leader | Unit Leader | Scout |
| --- | --- | --- | --- | --- |
| View totals and transactions | All units | All units | Assigned units | Denied |
| Create/edit/submit/cancel | All units | All units | Assigned units | Denied |
| Approve/reject/reverse | All units | Denied | Denied | Denied |
| Move a transaction to another unit | Any unit | Any unit | Assigned units only | Denied |

The backend derives the actor from the bearer session and derives Unit Leader
scope from `user_units`. A submitted role, actor ID, or unauthorized unit is not
trusted.

## Receipt extension still required

Receipt files should use the same storage-provider boundary as Gallery rather
than Render's filesystem. Add a `finance_attachments` table with: `id`,
`transaction_id`, `storage_key`, `file_url`, `original_filename`, `mime_type`,
`file_size`, `uploaded_by`, and timestamps. Restrict types to PDF/JPEG/PNG,
validate signatures server-side, cap file/request size, and cascade attachment
metadata when a transaction is removed.

Planned receipt routes:

- `POST /api/finance/transactions/:id/attachments`
- `GET /api/finance/transactions/:id/attachments`
- `DELETE /api/finance/attachments/:id`

Receipt storage should preserve the current authorization and audit contract
rather than create a competing Finance module.
