import { randomUUID } from "node:crypto";
import db from "../database/db.js";
import {
  DEFAULT_GALLERY_ALBUM_NAME,
  DEFAULT_GALLERY_ALBUM_SLUG,
} from "../database/galleryMigration.js";
import {
  deleteGalleryImage,
  getDatabaseGalleryImage,
  persistGalleryImage,
  uploadGalleryImage,
} from "./galleryStorage.js";
import { isGlobalLeader, isOperationalLeader } from "./authorizationService.js";

export const MAX_GALLERY_FILES = 10;
export const MAX_GALLERY_FILE_SIZE = 12 * 1024 * 1024;
export const MAX_GALLERY_UPLOAD_BYTES = MAX_GALLERY_FILES * MAX_GALLERY_FILE_SIZE + 1_000_000;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function firstField(fields, name) {
  const value = fields?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function trimOptional(value, maxLength, fieldName) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw createHttpError(400, `${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function normalizeDate(value, fieldName) {
  const date = String(value || "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }
  return date;
}

function normalizePositiveInt(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw createHttpError(400, `${fieldName} is invalid.`);
  }
  return id;
}

function normalizePhotoId(value) {
  return normalizePositiveInt(value, "Photo ID");
}

function normalizeLimit(value) {
  const limit = Number(value || 24);
  if (!Number.isInteger(limit) || limit < 1) return 24;
  return Math.min(limit, 48);
}

function canCreateAlbums(user) {
  return isGlobalLeader(user);
}

function canManagePhoto(user, photo) {
  return isOperationalLeader(user) && (
    isGlobalLeader(user) || String(user.id) === String(photo.uploaded_by)
  );
}

function formatDateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function safeOriginalFilename(value) {
  const cleaned = String(value || "photo")
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_")
    .trim()
    .slice(0, 255);
  return cleaned || "photo";
}

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || randomUUID();
}

async function findAlbumById(albumId) {
  const [rows] = await db.execute("SELECT * FROM gallery_albums WHERE id = ? LIMIT 1", [albumId]);
  return rows[0] || null;
}

async function findAlbumByName(name) {
  const [rows] = await db.execute("SELECT * FROM gallery_albums WHERE name = ? LIMIT 1", [name]);
  return rows[0] || null;
}

async function findDefaultAlbum() {
  const [rows] = await db.execute(
    "SELECT * FROM gallery_albums WHERE slug = ? LIMIT 1",
    [DEFAULT_GALLERY_ALBUM_SLUG],
  );

  if (rows[0]) return rows[0];

  const [result] = await db.execute(
    `
      INSERT INTO gallery_albums (name, slug, description, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `,
    [
      DEFAULT_GALLERY_ALBUM_NAME,
      DEFAULT_GALLERY_ALBUM_SLUG,
      "Shared ScoutOS gallery photos that are not assigned to a specific event.",
    ],
  );
  return findAlbumById(result.insertId);
}

async function uniqueAlbumSlug(name) {
  const base = slugify(name);

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const [rows] = await db.execute("SELECT id FROM gallery_albums WHERE slug = ? LIMIT 1", [slug]);
    if (rows.length === 0) return slug;
  }

  return `${base}-${randomUUID()}`;
}

async function createAlbumFromName(name, user, { reuseExisting = false } = {}) {
  const albumName = trimOptional(name, 120, "Album name");
  if (!albumName || albumName.length < 2) {
    throw createHttpError(400, "Album name must be between 2 and 120 characters.");
  }

  const existing = await findAlbumByName(albumName);
  if (existing) {
    if (reuseExisting) return existing;
    throw createHttpError(409, "An album with that name already exists.");
  }

  const slug = await uniqueAlbumSlug(albumName);
  const createdBy = Number.isInteger(Number(user.id)) ? Number(user.id) : null;
  const [result] = await db.execute(
    `
      INSERT INTO gallery_albums (name, slug, created_by, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `,
    [albumName, slug, createdBy],
  );

  return findAlbumById(result.insertId);
}

async function resolveAlbum(fields, user, fallbackAlbumId = null) {
  const albumName = trimOptional(firstField(fields, "albumName"), 120, "Album name");
  if (albumName) {
    if (!canCreateAlbums(user)) {
      throw createHttpError(403, "Only Admins and Group Leaders can create albums.");
    }
    return createAlbumFromName(albumName, user, { reuseExisting: true });
  }

  const albumId = normalizePositiveInt(firstField(fields, "albumId"), "Album");
  if (albumId) {
    const album = await findAlbumById(albumId);
    if (!album) throw createHttpError(400, "Selected album does not exist.");
    return album;
  }

  if (fallbackAlbumId) {
    const album = await findAlbumById(fallbackAlbumId);
    if (!album) throw createHttpError(400, "Selected album does not exist.");
    return album;
  }

  return findDefaultAlbum();
}

function mapAlbum(row) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    photoCount: Number(row.photo_count || 0),
    coverThumbnailUrl: row.cover_thumbnail_url || null,
    latestPhotoAt: formatDateTime(row.latest_photo_at),
    createdBy: row.created_by === null || row.created_by === undefined ? null : Number(row.created_by),
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

function mapPhoto(row, user = null) {
  return {
    id: Number(row.id),
    storageKey: row.storage_key,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url || row.image_url,
    caption: row.caption || "",
    albumId: Number(row.album_id),
    albumName: row.album_name || DEFAULT_GALLERY_ALBUM_NAME,
    eventDate: formatDateOnly(row.event_date),
    uploadedBy: row.uploaded_by
      ? {
          id: String(row.uploaded_by),
          fullName: row.uploader_name || row.uploader_username || "ScoutOS user",
          username: row.uploader_username || "",
          role: row.uploader_role || "",
        }
      : null,
    originalFilename: row.original_filename || "",
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    width: row.width === null || row.width === undefined ? null : Number(row.width),
    height: row.height === null || row.height === undefined ? null : Number(row.height),
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    canEdit: user ? canManagePhoto(user, row) : false,
    canDelete: user ? canManagePhoto(user, row) : false,
  };
}

export async function getGalleryMedia(storageKey) {
  const image = await getDatabaseGalleryImage(storageKey);
  if (!image) {
    throw createHttpError(404, "Gallery image not found.");
  }

  return image;
}

async function getPhotoRow(id) {
  const [rows] = await db.execute(
    `
      SELECT
        p.*,
        a.name AS album_name,
        a.slug AS album_slug,
        u.full_name AS uploader_name,
        u.username AS uploader_username,
        u.role AS uploader_role
      FROM gallery_photos p
      INNER JOIN gallery_albums a ON a.id = p.album_id
      LEFT JOIN users u ON u.id = p.uploaded_by
      WHERE p.id = ? AND p.status = 'active'
      LIMIT 1
    `,
    [id],
  );
  return rows[0] || null;
}

function validateImageSignature(file) {
  const buffer = file.buffer;
  if (file.contentType === "image/jpeg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (file.contentType === "image/png") {
    return (
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (file.contentType === "image/webp") {
    return (
      buffer.length > 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function getImageDimensions(file) {
  const buffer = file.buffer;

  if (file.contentType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (file.contentType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame = [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
      ].includes(marker);

      if (isStartOfFrame && offset + 8 < buffer.length) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }

      if (length < 2) break;
      offset += 2 + length;
    }
  }

  if (file.contentType === "image/webp" && buffer.length >= 30) {
    const chunkType = buffer.toString("ascii", 12, 16);
    if (chunkType === "VP8X") {
      return { width: readUInt24LE(buffer, 24) + 1, height: readUInt24LE(buffer, 27) + 1 };
    }
    if (chunkType === "VP8 " && buffer.length >= 30) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunkType === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }

  return { width: null, height: null };
}

function validateImageFile(file) {
  const originalFilename = safeOriginalFilename(file.filename);

  if (!allowedImageTypes.has(file.contentType)) {
    throw createHttpError(400, "Only JPEG, PNG, and WebP photos are supported.");
  }

  if (!file.size) {
    throw createHttpError(400, "This photo is empty.");
  }

  if (file.size > MAX_GALLERY_FILE_SIZE) {
    throw createHttpError(413, "Each photo must be 12 MB or smaller.");
  }

  if (!validateImageSignature(file)) {
    throw createHttpError(400, "The selected file is not a valid image.");
  }

  return {
    ...file,
    originalFilename,
    ...getImageDimensions(file),
  };
}

function failureMessage(error) {
  const status = Number(error.status);
  if (status >= 400 && status < 500) return error.message;
  return "ScoutOS could not upload this photo.";
}

export async function listGalleryAlbums() {
  const [rows] = await db.execute(
    `
      SELECT
        a.id,
        a.name,
        a.slug,
        a.description,
        a.created_by,
        a.created_at,
        a.updated_at,
        COALESCE(stats.photo_count, 0) AS photo_count,
        cover.thumbnail_url AS cover_thumbnail_url,
        cover.created_at AS latest_photo_at
      FROM gallery_albums a
      LEFT JOIN (
        SELECT album_id, COUNT(*) AS photo_count, MAX(id) AS latest_photo_id
        FROM gallery_photos
        WHERE status = 'active'
        GROUP BY album_id
      ) stats ON stats.album_id = a.id
      LEFT JOIN gallery_photos cover ON cover.id = stats.latest_photo_id
      ORDER BY (a.slug = ?) DESC, stats.latest_photo_id DESC, a.name ASC
    `,
    [DEFAULT_GALLERY_ALBUM_SLUG],
  );

  return rows.map(mapAlbum);
}

export async function createGalleryAlbum(body, user) {
  if (!canCreateAlbums(user)) {
    throw createHttpError(403, "Only Admins and Group Leaders can create Gallery albums.");
  }

  return mapAlbum(await createAlbumFromName(body?.name, user));
}

export async function listGalleryPhotos(params, user) {
  const limit = normalizeLimit(params.limit);
  const cursor = normalizePositiveInt(params.cursor, "Gallery cursor");
  const albumId = normalizePositiveInt(params.albumId, "Album");
  const onlyMine = String(params.mine || "") === "true";
  const search = trimOptional(params.search, 100, "Search");
  const where = ["p.status = 'active'"];
  const values = [];

  if (albumId) {
    where.push("p.album_id = ?");
    values.push(albumId);
  }

  if (onlyMine) {
    where.push("p.uploaded_by = ?");
    values.push(Number(user.id));
  }

  if (cursor) {
    where.push("p.id < ?");
    values.push(cursor);
  }

  if (search) {
    const query = `%${search}%`;
    where.push("(p.caption LIKE ? OR a.name LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)");
    values.push(query, query, query, query);
  }

  const [rows] = await db.execute(
    `
      SELECT
        p.*,
        a.name AS album_name,
        a.slug AS album_slug,
        u.full_name AS uploader_name,
        u.username AS uploader_username,
        u.role AS uploader_role
      FROM gallery_photos p
      INNER JOIN gallery_albums a ON a.id = p.album_id
      LEFT JOIN users u ON u.id = p.uploaded_by
      WHERE ${where.join(" AND ")}
      ORDER BY p.id DESC
      LIMIT ${limit + 1}
    `,
    values,
  );

  const visibleRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    photos: visibleRows.map((row) => mapPhoto(row, user)),
    nextCursor: hasMore ? String(visibleRows[visibleRows.length - 1].id) : null,
  };
}

export async function getGallerySummary(user, limit = 4) {
  const [photoCountRows] = await db.execute(
    "SELECT COUNT(*) AS total FROM gallery_photos WHERE status = 'active'",
  );
  const [albumCountRows] = await db.execute("SELECT COUNT(*) AS total FROM gallery_albums");
  const latest = await listGalleryPhotos({ limit }, user);

  return {
    totalPhotos: Number(photoCountRows[0]?.total || 0),
    totalAlbums: Number(albumCountRows[0]?.total || 0),
    latestPhotos: latest.photos,
  };
}

export async function uploadGalleryPhotos({ fields, files }, user) {
  if (!isOperationalLeader(user)) {
    throw createHttpError(403, "Scout accounts can view Gallery photos but cannot upload them.");
  }
  const photoFiles = files.filter((file) =>
    ["photos", "photos[]", "images", "image"].includes(file.fieldName),
  );

  if (photoFiles.length === 0) {
    throw createHttpError(400, "Select at least one photo to upload.");
  }
  if (photoFiles.length > MAX_GALLERY_FILES) {
    throw createHttpError(400, `Upload at most ${MAX_GALLERY_FILES} photos at a time.`);
  }
  const caption = trimOptional(firstField(fields, "caption"), 500, "Caption");
  const eventDate = normalizeDate(firstField(fields, "eventDate"), "Event date");
  const album = await resolveAlbum(fields, user);
  const uploaded = [];
  const failed = [];

  for (const [index, file] of photoFiles.entries()) {
    let storageKey = null;
    let insertedPhotoId = null;

    try {
      const validatedFile = validateImageFile(file);
      const storage = await uploadGalleryImage(validatedFile, randomUUID());
      storageKey = storage.storageKey;

      const [result] = await db.execute(
        `
          INSERT INTO gallery_photos
            (
              storage_key,
              image_url,
              thumbnail_url,
              caption,
              album_id,
              uploaded_by,
              event_date,
              original_filename,
              mime_type,
              file_size,
              width,
              height,
              status,
              created_at,
              updated_at
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
        `,
        [
          storage.storageKey,
          storage.imageUrl,
          storage.thumbnailUrl,
          caption,
          album.id,
          Number(user.id),
          eventDate,
          validatedFile.originalFilename,
          validatedFile.contentType,
          storage.bytes || validatedFile.size,
          storage.width || validatedFile.width,
          storage.height || validatedFile.height,
        ],
      );
      insertedPhotoId = result.insertId;
      await persistGalleryImage(storage, result.insertId);

      uploaded.push(mapPhoto(await getPhotoRow(result.insertId), user));
    } catch (error) {
      if (insertedPhotoId) {
        await db.execute(
          "UPDATE gallery_photos SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id = ?",
          [insertedPhotoId],
        ).catch((cleanupError) => {
          console.error("Gallery metadata cleanup failed:", cleanupError);
        });
      }

      if (storageKey) {
        await deleteGalleryImage(storageKey).catch((cleanupError) => {
          console.error("Gallery upload cleanup failed:", cleanupError);
        });
      }

      failed.push({
        index,
        filename: safeOriginalFilename(file.filename),
        error: failureMessage(error),
      });
    }
  }

  return { uploaded, failed };
}

export async function updateGalleryPhoto(id, body, user) {
  const photoId = normalizePhotoId(id);
  const existing = await getPhotoRow(photoId);
  if (!existing) throw createHttpError(404, "Photo not found.");
  if (!canManagePhoto(user, existing)) {
    throw createHttpError(403, "You do not have permission to edit this photo.");
  }

  const albumFields = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, "albumId")) {
    albumFields.albumId = [body.albumId];
  }
  const album = await resolveAlbum(albumFields, user, existing.album_id);
  const caption = trimOptional(body?.caption, 500, "Caption");
  const eventDate = normalizeDate(body?.eventDate, "Event date");

  await db.execute(
    `
      UPDATE gallery_photos
      SET caption = ?, album_id = ?, event_date = ?, updated_at = NOW()
      WHERE id = ? AND status = 'active'
    `,
    [caption, album.id, eventDate, photoId],
  );

  return mapPhoto(await getPhotoRow(photoId), user);
}

export async function deleteGalleryPhoto(id, user) {
  const photoId = normalizePhotoId(id);
  const existing = await getPhotoRow(photoId);
  if (!existing) throw createHttpError(404, "Photo not found.");
  if (!canManagePhoto(user, existing)) {
    throw createHttpError(403, "You do not have permission to delete this photo.");
  }

  await db.execute(
    `
      UPDATE gallery_photos
      SET status = 'deleted', deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
      WHERE id = ? AND status = 'active'
    `,
    [Number(user.id), photoId],
  );

  try {
    await deleteGalleryImage(existing.storage_key);
    return { warning: null };
  } catch (error) {
    console.error("Gallery storage deletion failed:", error);
    return {
      warning:
        "The photo was removed from ScoutOS, but the storage provider did not confirm file deletion.",
    };
  }
}
