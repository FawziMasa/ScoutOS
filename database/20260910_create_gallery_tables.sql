-- ScoutOS Gallery schema. Stores photo metadata and storage references only.
-- Image binaries live in the configured object/image storage provider.

CREATE TABLE IF NOT EXISTS gallery_albums (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  description VARCHAR(255) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gallery_albums_slug (slug),
  INDEX idx_gallery_albums_created_by (created_by),
  CONSTRAINT fk_gallery_albums_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gallery_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  storage_key VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  caption VARCHAR(500) NULL,
  album_id INT NOT NULL,
  uploaded_by INT NULL,
  event_date DATE NULL,
  original_filename VARCHAR(255) NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  status ENUM('active', 'deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gallery_photos_storage_key (storage_key),
  INDEX idx_gallery_photos_created_at (created_at),
  INDEX idx_gallery_photos_album (album_id),
  INDEX idx_gallery_photos_uploaded_by (uploaded_by),
  INDEX idx_gallery_photos_status (status),
  INDEX idx_gallery_photos_event_date (event_date),
  CONSTRAINT fk_gallery_photos_album
    FOREIGN KEY (album_id) REFERENCES gallery_albums(id),
  CONSTRAINT fk_gallery_photos_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_gallery_photos_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO gallery_albums (name, slug, description, created_at, updated_at)
SELECT
  'Scout Moments',
  'scout-moments',
  'Shared ScoutOS gallery photos that are not assigned to a specific event.',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gallery_albums WHERE slug = 'scout-moments' LIMIT 1
);
