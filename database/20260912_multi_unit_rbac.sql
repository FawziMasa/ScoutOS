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

ALTER TABLE users ADD COLUMN scout_id VARCHAR(36) NULL AFTER unit;
ALTER TABLE users ADD UNIQUE KEY uq_users_scout_id (scout_id);
ALTER TABLE users ADD CONSTRAINT fk_users_scout
  FOREIGN KEY (scout_id) REFERENCES scouts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_units (
  user_id INT NOT NULL,
  unit_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, unit_id),
  INDEX idx_user_units_unit_user (unit_id, user_id),
  CONSTRAINT fk_user_units_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_units_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO user_units (user_id, unit_id, created_at)
SELECT users.id, units.id, NOW()
FROM users INNER JOIN units ON units.name = users.unit
WHERE users.unit IS NOT NULL AND TRIM(users.unit) <> '';
