-- ScoutOS core schema for a fresh hosted MySQL database such as Aiven.

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(254) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'UNIT_LEADER',
  unit VARCHAR(50) NULL,
  scout_id VARCHAR(36) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  session_version INT NOT NULL DEFAULT 0,
  created_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_scout_id (scout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS units (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_name (name),
  INDEX idx_units_active_order (active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_units (
  user_id INT NOT NULL,
  unit_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, unit_id),
  INDEX idx_user_units_unit_user (unit_id, user_id),
  CONSTRAINT fk_user_units_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_units_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scouts (
  id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NULL,
  guardian VARCHAR(100) NULL,
  joined_at DATE NULL,
  status VARCHAR(20) NULL DEFAULT 'Active',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_scouts_unit (unit),
  INDEX idx_scouts_status (status),
  INDEX idx_scouts_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD CONSTRAINT fk_users_scout
  FOREIGN KEY (scout_id) REFERENCES scouts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT NOT NULL AUTO_INCREMENT,
  meeting_name VARCHAR(150) NOT NULL,
  meeting_type ENUM(
    'Weekly Meeting',
    'Camp',
    'Hike',
    'Training',
    'Competition',
    'Service',
    'Other'
  ) NOT NULL DEFAULT 'Weekly Meeting',
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

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT NOT NULL AUTO_INCREMENT,
  session_id INT NOT NULL,
  scout_id VARCHAR(36) NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'absent',
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
