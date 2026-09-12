# ScoutOS Finance architecture

ScoutOS already contains the Finance foundation and an operational transaction
screen. This document records the implemented contract and the safe extension
path for receipts, approvals, and exports.

## Implemented schema

`finance_transactions` stores:

- unit, transaction type (`INCOME` or `EXPENSE`), category, and description;
- vendor/recipient, positive decimal amount, payment method, and status;
- transaction date, reference number, and internal notes;
- creating/editing account IDs and timestamps.

The table indexes unit/date, status, category, and both actor references. Actor
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
| `DELETE` | `/api/finance/transactions/:id` | Delete one authorized transaction |
| `GET` | `/api/finance/summary` | Income, expenses, balance, debt, month, pending, count |

The Finance page provides live/manual refresh, a full or clearly filtered scope
label, balance/debt state, totals, filters, transaction table, and create/view/
edit dialogs. Cancelled transactions do not affect income, expenses, or balance.

## Permission matrix

| Capability | Admin | Group Leader | Unit Leader | Scout |
| --- | --- | --- | --- | --- |
| View totals and transactions | All units | All units | Assigned units | Denied |
| Create/edit/delete | All units | All units | Assigned units | Denied |
| Move a transaction to another unit | Any unit | Any unit | Assigned units only | Denied |

The backend derives the actor from the bearer session and derives Unit Leader
scope from `user_units`. A submitted role, actor ID, or unauthorized unit is not
trusted.

## Proposed next extension

Receipt files should use the same storage-provider boundary as Gallery rather
than Render's filesystem. Add a `finance_attachments` table with: `id`,
`transaction_id`, `storage_key`, `file_url`, `original_filename`, `mime_type`,
`file_size`, `uploaded_by`, and timestamps. Restrict types to PDF/JPEG/PNG,
validate signatures server-side, cap file/request size, and cascade attachment
metadata when a transaction is removed.

For a formal approval workflow, add nullable `submitted_by`, `approved_by`,
`approved_at`, and `rejection_reason` fields and migrate the status model to
`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, and `CANCELLED`. Keep historical
status changes in a separate append-only `finance_status_history` table.

Proposed routes:

- `POST /api/finance/transactions/:id/attachments`
- `GET /api/finance/transactions/:id/attachments`
- `DELETE /api/finance/attachments/:id`
- `POST /api/finance/transactions/:id/submit`
- `POST /api/finance/transactions/:id/approve`
- `POST /api/finance/transactions/:id/reject`
- `GET /api/finance/export.csv` using the same authorized filters as the table

Proposed frontend additions are a receipt preview/download panel, approval
inbox, status timeline, and CSV export action. These additions should preserve
the current summary and filter contract rather than create a competing Finance
module.
