import db from "../database/db.js";

const checks = [
  {
    area: "Accounts",
    name: "Scout role has a valid active Scout link",
    tables: ["users", "scouts"],
    sql: `SELECT COUNT(*) AS findings
          FROM users account
          LEFT JOIN scouts scout ON scout.id = account.scout_id
          WHERE account.role = 'SCOUT'
            AND (account.scout_id IS NULL OR scout.id IS NULL OR scout.status <> 'Active')`,
  },
  {
    area: "Accounts",
    name: "Only Scout accounts carry Scout links",
    tables: ["users"],
    sql: "SELECT COUNT(*) AS findings FROM users WHERE scout_id IS NOT NULL AND role <> 'SCOUT'",
  },
  {
    area: "Units",
    name: "Active Unit Leaders have assignments",
    tables: ["users", "user_units"],
    sql: `SELECT COUNT(*) AS findings
          FROM users account
          LEFT JOIN user_units assignment ON assignment.user_id = account.id
          WHERE account.role = 'UNIT_LEADER' AND account.active = 1
          GROUP BY account.id
          HAVING COUNT(assignment.unit_id) = 0`,
    countRows: true,
  },
  {
    area: "Units",
    name: "Unit assignments have no duplicate pairs",
    tables: ["user_units"],
    sql: `SELECT COUNT(*) AS findings FROM (
            SELECT user_id, unit_id FROM user_units
            GROUP BY user_id, unit_id HAVING COUNT(*) > 1
          ) duplicates`,
  },
  {
    area: "Attendance",
    name: "Attendance has no duplicate Scout/session pairs",
    tables: ["attendance_records"],
    sql: `SELECT COUNT(*) AS findings FROM (
            SELECT session_id, scout_id FROM attendance_records
            GROUP BY session_id, scout_id HAVING COUNT(*) > 1
          ) duplicates`,
  },
  {
    area: "Attendance",
    name: "Attendance references valid sessions and Scouts",
    tables: ["attendance_records", "attendance_sessions", "scouts"],
    sql: `SELECT COUNT(*) AS findings
          FROM attendance_records record
          LEFT JOIN attendance_sessions session_record ON session_record.id = record.session_id
          LEFT JOIN scouts scout ON scout.id = record.scout_id
          WHERE session_record.id IS NULL OR scout.id IS NULL`,
  },
  {
    area: "Points",
    name: "Point ledger entries are non-zero and linked",
    tables: ["points_ledger", "scouts", "users"],
    sql: `SELECT COUNT(*) AS findings
          FROM points_ledger ledger
          LEFT JOIN scouts scout ON scout.id = ledger.scout_id
          LEFT JOIN users actor ON actor.id = ledger.leader_id
          WHERE ledger.points_change = 0 OR scout.id IS NULL OR actor.id IS NULL`,
  },
  {
    area: "Password reset",
    name: "Reset tokens reference valid accounts",
    tables: ["password_reset_tokens", "users"],
    sql: `SELECT COUNT(*) AS findings
          FROM password_reset_tokens token_record
          LEFT JOIN users account ON account.id = token_record.user_id
          WHERE account.id IS NULL`,
  },
  {
    area: "Accounts",
    name: "Invitation tokens reference valid Scout accounts",
    tables: ["account_invitations", "users"],
    sql: `SELECT COUNT(*) AS findings
          FROM account_invitations invitation
          LEFT JOIN users account ON account.id = invitation.user_id
          WHERE account.id IS NULL OR account.role <> 'SCOUT'`,
  },
  {
    area: "Gallery",
    name: "Gallery photos reference valid albums",
    tables: ["gallery_photos", "gallery_albums"],
    sql: `SELECT COUNT(*) AS findings
          FROM gallery_photos photo
          LEFT JOIN gallery_albums album ON album.id = photo.album_id
          WHERE album.id IS NULL`,
  },
  {
    area: "Gallery",
    name: "Album unit references are valid",
    tables: ["gallery_albums", "units"],
    sql: `SELECT COUNT(*) AS findings
          FROM gallery_albums album
          LEFT JOIN units unit_record ON unit_record.id = album.unit_id
          WHERE album.unit_id IS NOT NULL AND unit_record.id IS NULL`,
  },
  {
    area: "Finance",
    name: "Finance amounts are positive",
    tables: ["finance_transactions"],
    sql: "SELECT COUNT(*) AS findings FROM finance_transactions WHERE amount <= 0",
  },
  {
    area: "Finance",
    name: "Approved transactions carry approval evidence",
    tables: ["finance_transactions"],
    sql: "SELECT COUNT(*) AS findings FROM finance_transactions WHERE status = 'APPROVED' AND (approved_by IS NULL OR approved_at IS NULL)",
  },
  {
    area: "Finance",
    name: "Every transaction has append-only status history",
    tables: ["finance_transactions", "finance_status_history"],
    sql: `SELECT COUNT(*) AS findings
          FROM finance_transactions transaction_record
          LEFT JOIN finance_status_history history ON history.transaction_id = transaction_record.id
          WHERE history.id IS NULL`,
  },
  {
    area: "Finance",
    name: "Reversals offset the linked approved transaction",
    tables: ["finance_transactions"],
    sql: `SELECT COUNT(*) AS findings
          FROM finance_transactions reversal
          LEFT JOIN finance_transactions original ON original.id = reversal.reversal_of_id
          WHERE reversal.reversal_of_id IS NOT NULL
            AND (original.id IS NULL OR original.status <> 'APPROVED'
              OR reversal.status <> 'APPROVED' OR original.amount <> reversal.amount
              OR original.transaction_type = reversal.transaction_type)`,
  },
];

const requiredIndexes = [
  "attendance_records.uq_attendance_session_scout",
  "account_invitations.uq_account_invitations_token_hash",
  "finance_transactions.idx_finance_transactions_unit_date",
  "finance_transactions.uq_finance_transactions_reversal",
  "finance_status_history.idx_finance_history_transaction",
  "gallery_albums.idx_gallery_albums_unit",
  "gallery_photos.idx_gallery_photos_album",
  "password_reset_tokens.uq_password_reset_token_hash",
  "points_ledger.uq_points_request_actor",
  "units.uq_units_name",
  "user_units.PRIMARY",
  "user_units.idx_user_units_unit_user",
  "users.uq_users_email",
  "users.uq_users_scout_id",
  "users.uq_users_username",
];

function resultRow(area, check, findings, status, note = "") {
  return { area, check, findings, status, note };
}

let hasFailures = false;
const results = [];

try {
  const [tableRows] = await db.execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const tables = new Set(tableRows.map((row) => row.table_name));

  for (const check of checks) {
    const missingTables = check.tables.filter((table) => !tables.has(table));
    if (missingTables.length > 0) {
      hasFailures = true;
      results.push(resultRow(
        check.area,
        check.name,
        "-",
        "FAIL",
        `Missing table(s): ${missingTables.join(", ")}`,
      ));
      continue;
    }

    const [rows] = await db.execute(check.sql);
    const findings = check.countRows ? rows.length : Number(rows[0]?.findings || 0);
    const status = findings === 0 ? "PASS" : "FAIL";
    if (status === "FAIL") hasFailures = true;
    results.push(resultRow(check.area, check.name, findings, status));
  }

  const [indexRows] = await db.execute(
    `SELECT table_name, index_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()`,
  );
  const indexes = new Set(indexRows.map((row) => `${row.table_name}.${row.index_name}`));
  const missingIndexes = requiredIndexes.filter((index) => !indexes.has(index));
  if (missingIndexes.length > 0) hasFailures = true;
  results.push(resultRow(
    "Indexes",
    "Required authorization and lookup indexes exist",
    missingIndexes.length,
    missingIndexes.length === 0 ? "PASS" : "FAIL",
    missingIndexes.join(", "),
  ));

  const [expiredRows] = tables.has("password_reset_tokens")
    ? await db.execute(
        "SELECT COUNT(*) AS findings FROM password_reset_tokens WHERE used_at IS NULL AND expires_at < NOW()",
      )
    : [[{ findings: 0 }]];
  results.push(resultRow(
    "Maintenance",
    "Expired unused reset tokens awaiting cleanup",
    Number(expiredRows[0]?.findings || 0),
    "INFO",
    "Expired tokens are rejected by the reset flow; periodic cleanup is optional.",
  ));

  console.table(results);
  if (hasFailures) {
    console.error("ScoutOS data-integrity audit found failures.");
    process.exitCode = 1;
  } else {
    console.log("ScoutOS data-integrity audit passed.");
  }
} finally {
  await db.end();
}
