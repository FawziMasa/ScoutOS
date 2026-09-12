import db from "./db.js";

export const DEFAULT_GALLERY_ALBUM_NAME = "Scout Moments";
export const DEFAULT_GALLERY_ALBUM_SLUG = "scout-moments";

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.execute(
    `SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await db.execute(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
    [tableName, constraintName],
  );
  return rows.length > 0;
}

export async function ensureGallerySchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS gallery_albums (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(140) NOT NULL,
      description VARCHAR(255) NULL,
      event_date DATE NULL,
      unit_id INT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gallery_albums_slug (slug),
      INDEX idx_gallery_albums_event_date (event_date),
      INDEX idx_gallery_albums_unit (unit_id),
      INDEX idx_gallery_albums_created_by (created_by),
      CONSTRAINT fk_gallery_albums_unit
        FOREIGN KEY (unit_id) REFERENCES units(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_gallery_albums_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
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
  `);

  if (!(await columnExists("gallery_albums", "event_date"))) {
    await db.execute("ALTER TABLE gallery_albums ADD COLUMN event_date DATE NULL AFTER description");
  }
  if (!(await columnExists("gallery_albums", "unit_id"))) {
    await db.execute("ALTER TABLE gallery_albums ADD COLUMN unit_id INT NULL AFTER event_date");
  }
  if (!(await indexExists("gallery_albums", "idx_gallery_albums_event_date"))) {
    await db.execute("ALTER TABLE gallery_albums ADD INDEX idx_gallery_albums_event_date (event_date)");
  }
  if (!(await indexExists("gallery_albums", "idx_gallery_albums_unit"))) {
    await db.execute("ALTER TABLE gallery_albums ADD INDEX idx_gallery_albums_unit (unit_id)");
  }
  if (!(await constraintExists("gallery_albums", "fk_gallery_albums_unit"))) {
    await db.execute(
      "ALTER TABLE gallery_albums ADD CONSTRAINT fk_gallery_albums_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL",
    );
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS gallery_photo_files (
      storage_key VARCHAR(255) NOT NULL,
      photo_id BIGINT UNSIGNED NOT NULL,
      content_type VARCHAR(80) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      image_data LONGBLOB NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (storage_key),
      UNIQUE KEY uq_gallery_photo_files_photo_id (photo_id),
      CONSTRAINT fk_gallery_photo_files_photo
        FOREIGN KEY (photo_id) REFERENCES gallery_photos(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(
    `
      INSERT INTO gallery_albums (name, slug, description, created_at, updated_at)
      SELECT ?, ?, ?, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM gallery_albums WHERE slug = ? LIMIT 1
      )
    `,
    [
      DEFAULT_GALLERY_ALBUM_NAME,
      DEFAULT_GALLERY_ALBUM_SLUG,
      "Shared ScoutOS gallery photos that are not assigned to a specific event.",
      DEFAULT_GALLERY_ALBUM_SLUG,
    ],
  );
}
