import { createHash } from "node:crypto";
import db from "../database/db.js";

const databaseStoragePrefix = "mysql-";

function createStorageError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw createStorageError(
      500,
      "Gallery storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend.",
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: process.env.CLOUDINARY_GALLERY_FOLDER || "scoutos/gallery",
  };
}

export function galleryStorageConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function galleryStorageMode() {
  return galleryStorageConfigured() ? "cloudinary" : "mysql";
}

function signCloudinaryParams(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

function transformCloudinaryUrl(url, transformation) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${transformation}/`);
}

async function readCloudinaryResponse(response, fallbackMessage) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createStorageError(
      response.status >= 400 && response.status < 500 ? 400 : 502,
      body?.error?.message || fallbackMessage,
    );
  }
  return body;
}

function publicBackendUrl() {
  const configured =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "";
  return String(configured).replace(/\/$/, "");
}

function databaseMediaUrl(storageKey, variant) {
  const path = `/api/gallery/media/${encodeURIComponent(storageKey)}/${variant}`;
  const baseUrl = publicBackendUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

async function uploadCloudinaryGalleryImage(file, publicId) {
  const config = cloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    folder: config.folder,
    public_id: publicId,
    timestamp,
  };
  const signature = signCloudinaryParams(params, config.apiSecret);
  const formData = new FormData();

  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }
  formData.append("api_key", config.apiKey);
  formData.append("signature", signature);
  formData.append("file", new Blob([file.buffer], { type: file.contentType }), file.originalFilename);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
    { method: "POST", body: formData },
  );
  const body = await readCloudinaryResponse(response, "Cloudinary could not store this image.");
  const secureUrl = body.secure_url || body.url;

  if (!body.public_id || !secureUrl) {
    throw createStorageError(502, "Cloudinary returned an incomplete image response.");
  }

  return {
    provider: "cloudinary",
    storageKey: body.public_id,
    imageUrl: transformCloudinaryUrl(secureUrl, "f_auto,q_auto,w_1800,c_limit"),
    thumbnailUrl: transformCloudinaryUrl(secureUrl, "f_auto,q_auto,c_fill,g_auto,w_640,h_480"),
    width: Number(body.width) || null,
    height: Number(body.height) || null,
    bytes: Number(body.bytes) || file.size,
  };
}

function uploadDatabaseGalleryImage(file, publicId) {
  const storageKey = `${databaseStoragePrefix}${publicId}`;

  return {
    provider: "mysql",
    storageKey,
    imageUrl: databaseMediaUrl(storageKey, "image"),
    thumbnailUrl: databaseMediaUrl(storageKey, "thumbnail"),
    width: file.width,
    height: file.height,
    bytes: file.size,
    contentType: file.contentType,
    buffer: file.buffer,
  };
}

export async function uploadGalleryImage(file, publicId) {
  if (galleryStorageConfigured()) {
    return uploadCloudinaryGalleryImage(file, publicId);
  }

  return uploadDatabaseGalleryImage(file, publicId);
}

export async function persistGalleryImage(storage, photoId) {
  if (storage.provider !== "mysql") return;

  await db.execute(
    `
      INSERT INTO gallery_photo_files
        (storage_key, photo_id, content_type, file_size, image_data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      storage.storageKey,
      photoId,
      storage.contentType,
      storage.bytes,
      storage.buffer,
    ],
  );
}

export async function getDatabaseGalleryImage(storageKey) {
  if (!String(storageKey || "").startsWith(databaseStoragePrefix)) {
    return null;
  }

  const [rows] = await db.execute(
    `
      SELECT
        f.content_type,
        f.file_size,
        f.image_data,
        p.original_filename,
        p.updated_at
      FROM gallery_photo_files f
      INNER JOIN gallery_photos p ON p.storage_key = f.storage_key
      WHERE f.storage_key = ? AND p.status = 'active'
      LIMIT 1
    `,
    [storageKey],
  );

  const image = rows[0];
  if (!image) return null;

  return {
    contentType: image.content_type,
    fileSize: Number(image.file_size || 0),
    buffer: image.image_data,
    filename: image.original_filename || "gallery-photo",
    updatedAt: image.updated_at,
  };
}

export async function deleteGalleryImage(storageKey) {
  if (!storageKey) return { deleted: false };

  if (String(storageKey).startsWith(databaseStoragePrefix)) {
    const [result] = await db.execute(
      "DELETE FROM gallery_photo_files WHERE storage_key = ?",
      [storageKey],
    );
    return { deleted: result.affectedRows > 0, result: "mysql" };
  }

  const config = cloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    invalidate: "true",
    public_id: storageKey,
    timestamp,
  };
  const signature = signCloudinaryParams(params, config.apiSecret);
  const formData = new FormData();

  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }
  formData.append("api_key", config.apiKey);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`,
    { method: "POST", body: formData },
  );
  const body = await readCloudinaryResponse(response, "Cloudinary could not delete this image.");

  return { deleted: body.result === "ok" || body.result === "not found", result: body.result };
}
