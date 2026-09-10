import {
  createGalleryAlbum,
  deleteGalleryPhoto,
  getGallerySummary,
  listGalleryAlbums,
  listGalleryPhotos,
  MAX_GALLERY_FILES,
  MAX_GALLERY_UPLOAD_BYTES,
  updateGalleryPhoto,
  uploadGalleryPhotos,
} from "../services/galleryService.js";
import { parseMultipartRequest } from "../services/multipartForm.js";

function errorStatus(error) {
  const status = Number(error.status);
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }
  return 500;
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    console.error("Gallery error:", error);
    send(response, errorStatus(error), { error: error.message || "Gallery request failed." });
  }
}

function queryParams(request) {
  const url = new URL(request.url, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export async function listGalleryPhotoRecords(request, response, context) {
  await run(response, context.send, async () => {
    context.send(response, 200, await listGalleryPhotos(queryParams(request), context.user));
  });
}

export async function uploadGalleryPhotoRecords(request, response, context) {
  await run(response, context.send, async () => {
    const form = await parseMultipartRequest(request, {
      maxBytes: MAX_GALLERY_UPLOAD_BYTES,
      maxFiles: MAX_GALLERY_FILES,
    });
    const result = await uploadGalleryPhotos(form, context.user);
    if (result.uploaded.length === 0) {
      context.send(response, 400, {
        ...result,
        error: result.failed[0]?.error || "No photos were uploaded.",
      });
      return;
    }

    context.send(response, 201, result);
  });
}

export async function updateGalleryPhotoRecord(request, response, context, id) {
  await run(response, context.send, async () => {
    const photo = await updateGalleryPhoto(id, await context.readJson(request), context.user);
    context.send(response, 200, { photo });
  });
}

export async function deleteGalleryPhotoRecord(_request, response, context, id) {
  await run(response, context.send, async () => {
    const result = await deleteGalleryPhoto(id, context.user);
    context.send(response, 200, result);
  });
}

export async function listGalleryAlbumRecords(_request, response, context) {
  await run(response, context.send, async () => {
    context.send(response, 200, { albums: await listGalleryAlbums() });
  });
}

export async function createGalleryAlbumRecord(request, response, context) {
  await run(response, context.send, async () => {
    const album = await createGalleryAlbum(await context.readJson(request), context.user);
    context.send(response, 201, { album });
  });
}

export async function getGallerySummaryRecord(request, response, context) {
  await run(response, context.send, async () => {
    const params = queryParams(request);
    context.send(response, 200, { summary: await getGallerySummary(context.user, params.limit) });
  });
}
