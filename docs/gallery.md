# ScoutOS Gallery

The Gallery provides albums, a responsive photo grid, search and album filters,
batch upload, a keyboard-friendly lightbox, and photo detail editing. Scouts can
view Gallery content; mutations remain leader-only and are enforced by the API.
Raw media is exposed only through signed links that expire after one hour.

## Data model

`gallery_albums` stores the album title, optional description, optional event
date, optional canonical `unit_id`, creator, and timestamps. `gallery_photos`
stores the album reference, storage reference/URL, optional caption and event
date, uploader, image metadata, lifecycle status, and timestamps.

The startup migration in `backend/database/galleryMigration.js` adds missing
album metadata columns and indexes without deleting existing Gallery records.
The fresh-install SQL reference is
`database/20260910_create_gallery_tables.sql`.

## Permissions

| Action | Admin | Group Leader | Unit Leader | Scout |
| --- | --- | --- | --- | --- |
| View albums and photos | Yes | Yes | Yes | Yes |
| Create group-wide album | Yes | Yes | No | No |
| Create assigned-unit album | Yes | Yes | Yes | No |
| Upload to group-wide album | Yes | Yes | No | No |
| Upload to assigned-unit album | Yes | Yes | Assigned units | No |
| Edit/delete a photo | Any | Any | Own photo in assigned unit | No |

For compatibility, a Unit Leader may still edit or delete a photo they uploaded
to a legacy album that has no unit association. New Unit Leader uploads require
an album associated with one of their current assignments. Album and photo
authorization is recalculated from the authenticated database account; the API
does not trust a unit submitted by the browser.

## Storage

Cloudinary is the recommended production provider. When its credentials are
present, original files are uploaded through the Gallery storage abstraction.
When it is not configured, ScoutOS uses the dedicated MySQL
`gallery_photo_files` LONGBLOB table. That fallback is persistent and avoids
Render's ephemeral filesystem, but it increases database size and backup cost;
Cloudinary is preferable as the Gallery grows.

Set these backend variables in Render to enable Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_GALLERY_FOLDER=scoutos/gallery
BACKEND_PUBLIC_URL=https://your-scoutos-backend.onrender.com
GALLERY_MEDIA_SECRET=replace-with-a-long-random-secret
```

`CLOUDINARY_API_SECRET` stays on the backend. Never expose it through a Vite
environment variable. `BACKEND_PUBLIC_URL` is used for MySQL-backed media URLs
when ScoutOS is behind Render.

Cloudinary delivery URLs are proxied through ScoutOS so public provider URLs are
not returned to browsers. `GALLERY_MEDIA_SECRET` signs temporary media links;
when omitted it falls back to `JWT_SECRET`.

## Upload validation

- Up to 10 files per request and 12 MB per file.
- JPEG, PNG, and WebP only.
- MIME type and file signature are checked server-side.
- Captions are optional and limited to 500 characters.
- Album descriptions are limited to 255 characters.
- Dates use the database-safe `YYYY-MM-DD` form.

HEIC/HEIF remains intentionally disabled because this pipeline does not yet
perform image conversion.
