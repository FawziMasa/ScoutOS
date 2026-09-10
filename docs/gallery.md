# ScoutOS Gallery

The Gallery stores metadata in MySQL. If Cloudinary credentials are configured,
image files are stored in Cloudinary. If Cloudinary is not configured, ScoutOS
stores the image bytes in the MySQL `gallery_photo_files` table so uploads work
without any extra storage service.

## Backend environment

Cloudinary is optional. To use it instead of MySQL-backed image storage, create
a Cloudinary account and add these variables to the Render backend environment:

```env
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_GALLERY_FOLDER=scoutos/gallery
```

`CLOUDINARY_API_SECRET` must stay server-side. Do not add it to Vite frontend
environment variables.

## Database

The Gallery schema is added to the existing self-healing startup schema through
`backend/database/galleryMigration.js`. It creates:

- `gallery_albums`
- `gallery_photos`
- `gallery_photo_files`

The default album is `Scout Moments`. The manual SQL equivalent is available at
`database/20260910_create_gallery_tables.sql`.

## Permissions

All authenticated ScoutOS leader accounts can view and upload photos. Current
ScoutOS roles are `ADMIN`, `GROUP_LEADER`, and `UNIT_LEADER`; there are no
direct scout login accounts in this codebase yet.

Deletion and editing are enforced by the backend:

- `ADMIN` and `GROUP_LEADER` can edit or delete any Gallery photo.
- `UNIT_LEADER` can edit or delete photos they uploaded.

## Upload limits

The backend validates every upload:

- Maximum 10 photos per batch.
- Maximum 12 MB per photo.
- Accepted image types: JPEG, PNG, WebP.
- MIME type and file signature are checked server-side.
- Captions are optional and capped at 500 characters.

HEIC/HEIF is not enabled in this version because the current upload pipeline
does not transform it before validation.
