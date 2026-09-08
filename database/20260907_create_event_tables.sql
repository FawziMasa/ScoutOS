-- ScoutOS Events module migration.

CREATE TABLE IF NOT EXISTS events (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  event_type ENUM(
    'Weekly Meeting',
    'Camp',
    'Hike',
    'Training',
    'Competition',
    'Service',
    'Community Project',
    'Other'
  ) NOT NULL DEFAULT 'Weekly Meeting',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  location VARCHAR(150) NULL,
  capacity INT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_events_start_date (start_date),
  INDEX idx_events_created_by (created_by),
  CONSTRAINT fk_events_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_registrations (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL,
  scout_id VARCHAR(36) NOT NULL,
  created_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_registration_scout (event_id, scout_id),
  INDEX idx_event_registrations_event (event_id),
  INDEX idx_event_registrations_scout (scout_id),
  CONSTRAINT fk_event_registrations_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_registrations_scout
    FOREIGN KEY (scout_id) REFERENCES scouts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
