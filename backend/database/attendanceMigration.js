import db from "./db.js";

const meetingTypeValues = [
  "Weekly Meeting",
  "Camp",
  "Hike",
  "Training",
  "Competition",
  "Service",
  "Other",
];

const statusValues = ["present", "absent", "late", "excused"];

function enumList(values) {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

export async function ensureAttendanceSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INT NOT NULL AUTO_INCREMENT,
      meeting_name VARCHAR(150) NOT NULL,
      meeting_type ENUM(${enumList(meetingTypeValues)}) NOT NULL DEFAULT 'Weekly Meeting',
      meeting_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      location VARCHAR(150) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      PRIMARY KEY (id),
      INDEX idx_attendance_sessions_date (meeting_date),
      INDEX idx_attendance_sessions_created_by (created_by),
      CONSTRAINT fk_attendance_sessions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT NOT NULL AUTO_INCREMENT,
      session_id INT NOT NULL,
      scout_id VARCHAR(36) NOT NULL,
      status ENUM(${enumList(statusValues)}) NOT NULL DEFAULT 'absent',
      arrival_time TIME NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_attendance_session_scout (session_id, scout_id),
      INDEX idx_attendance_records_session (session_id),
      INDEX idx_attendance_records_scout (scout_id),
      INDEX idx_attendance_records_status (status),
      CONSTRAINT fk_attendance_records_session
        FOREIGN KEY (session_id) REFERENCES attendance_sessions(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_attendance_records_scout
        FOREIGN KEY (scout_id) REFERENCES scouts(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export { meetingTypeValues, statusValues };
