import {
  createGalleryAlbumRecord,
  deleteGalleryPhotoRecord,
  getGallerySummaryRecord,
  listGalleryAlbumRecords,
  listGalleryPhotoRecords,
  serveGalleryMediaRecord,
  updateGalleryPhotoRecord,
  uploadGalleryPhotoRecords,
} from "../controllers/galleryController.js";

export async function handleGalleryRoute(request, response, context) {
  const { path } = context;
  if (!path.startsWith("/api/gallery")) return false;

  const mediaMatch = path.match(/^\/api\/gallery\/media\/([^/]+)\/(image|thumbnail)$/);
  if (request.method === "GET" && mediaMatch) {
    await serveGalleryMediaRecord(
      request,
      response,
      context,
      decodeURIComponent(mediaMatch[1]),
      mediaMatch[2],
    );
    return true;
  }

  if (request.method === "GET" && path === "/api/gallery/summary") {
    await getGallerySummaryRecord(request, response, context);
    return true;
  }

  if (request.method === "GET" && path === "/api/gallery/albums") {
    await listGalleryAlbumRecords(request, response, context);
    return true;
  }

  if (request.method === "POST" && path === "/api/gallery/albums") {
    await createGalleryAlbumRecord(request, response, context);
    return true;
  }

  if (request.method === "GET" && path === "/api/gallery/photos") {
    await listGalleryPhotoRecords(request, response, context);
    return true;
  }

  if (request.method === "POST" && path === "/api/gallery/photos") {
    await uploadGalleryPhotoRecords(request, response, context);
    return true;
  }

  const photoMatch = path.match(/^\/api\/gallery\/photos\/(\d+)$/);
  if (photoMatch) {
    if (request.method === "PUT") {
      await updateGalleryPhotoRecord(request, response, context, photoMatch[1]);
      return true;
    }

    if (request.method === "DELETE") {
      await deleteGalleryPhotoRecord(request, response, context, photoMatch[1]);
      return true;
    }
  }

  context.send(response, 404, { error: "Gallery route not found." });
  return true;
}
