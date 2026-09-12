import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import GalleryAlbumFilter from "../components/gallery/GalleryAlbumFilter";
import GalleryGrid from "../components/gallery/GalleryGrid";
import GalleryUploadModal from "../components/gallery/GalleryUploadModal";
import GalleryViewer from "../components/gallery/GalleryViewer";
import { api, getStoredUser, type GalleryAlbum, type GalleryPhoto } from "../lib/api";
import "../components/gallery/Gallery.css";

const pageSize = 24;

function Gallery() {
  const user = getStoredUser();
  const canCreateAlbum = Boolean(user && user.role !== "SCOUT");
  const canUpload = Boolean(user && user.role !== "SCOUT");
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerPhotoId, setViewerPhotoId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const totalPhotos = useMemo(
    () => albums.reduce((total, album) => total + album.photoCount, 0),
    [albums],
  );

  const viewerIndex = photos.findIndex((photo) => photo.id === viewerPhotoId);
  const viewerPhoto = viewerIndex >= 0 ? photos[viewerIndex] : null;

  const loadAlbums = async () => {
    const result = await api.gallery.albums();
    setAlbums(result.albums);
  };

  const loadPhotos = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.gallery.photos({
        albumId: selectedAlbumId === "all" ? null : selectedAlbumId,
        limit: pageSize,
        mine: mineOnly,
        search,
      });
      setPhotos(result.photos);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the Gallery.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.gallery
      .albums()
      .then((result) => setAlbums(result.albums))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load albums.");
      });
  }, []);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setError("");
        return api.gallery.photos({
          albumId: selectedAlbumId === "all" ? null : selectedAlbumId,
          limit: pageSize,
          mine: mineOnly,
          search,
        });
      })
      .then((result) => {
        if (!active || !result) return;
        setPhotos(result.photos);
        setNextCursor(result.nextCursor);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the Gallery.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedAlbumId, mineOnly, search]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadMore = async () => {
    if (!nextCursor) return;

    try {
      setLoadingMore(true);
      setError("");
      const result = await api.gallery.photos({
        albumId: selectedAlbumId === "all" ? null : selectedAlbumId,
        cursor: nextCursor,
        limit: pageSize,
        mine: mineOnly,
        search,
      });
      setPhotos((current) => [...current, ...result.photos]);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more photos.");
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshGallery = async () => {
    await Promise.all([loadAlbums(), loadPhotos()]);
  };

  const deletePhoto = async (photo: GalleryPhoto) => {
    if (!window.confirm("Delete this photo? This will remove it from the ScoutOS Gallery.")) return;

    try {
      setError("");
      const result = await api.gallery.remove(photo.id);
      const remaining = photos.filter((record) => record.id !== photo.id);
      setPhotos(remaining);
      setViewerPhotoId((current) => {
        if (current !== photo.id) return current;
        return remaining[viewerIndex] ? remaining[viewerIndex].id : remaining[viewerIndex - 1]?.id || null;
      });
      await loadAlbums();
      setToast(result.warning || "Photo removed from the Gallery.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete photo.");
    }
  };

  const updatePhoto = (photo: GalleryPhoto) => {
    setPhotos((current) => current.map((record) => (record.id === photo.id ? photo : record)));
    loadAlbums().catch(() => undefined);
    setToast("Photo details updated.");
  };

  const handleUploaded = (_uploaded: GalleryPhoto[], message: string) => {
    setUploadOpen(false);
    setToast(message);
    refreshGallery().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not refresh Gallery.");
    });
  };

  return (
    <div className="page gallery-page">
      <header className="page-header gallery-header">
        <div>
          <span className="eyebrow">Our Gallery</span>
          <h1>Gallery</h1>
          <p>Moments from meetings, camps, trips, ceremonies, and service days shared across ScoutOS.</p>
        </div>
        {canUpload && <button className="button button-primary" onClick={() => setUploadOpen(true)} type="button">
          <Icon name="upload" size={18} />
          Upload Photos
        </button>}
      </header>

      {error && <div className="form-error page-error">{error}</div>}

      <section className="gallery-control-panel panel">
        <div className="gallery-toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search captions, albums, or uploaders..."
              value={searchInput}
            />
          </label>
          {canUpload && <button
            className={`gallery-filter-button ${mineOnly ? "active" : ""}`}
            onClick={() => setMineOnly((current) => !current)}
            type="button"
          >
            <Icon name="users" size={17} />
            My Uploads
          </button>}
        </div>

        <GalleryAlbumFilter
          albums={albums}
          onSelect={setSelectedAlbumId}
          selectedAlbumId={selectedAlbumId}
          totalPhotos={totalPhotos}
        />
      </section>

      {loading && photos.length === 0 && (
        <section className="panel">
          <div className="empty-state">
            <span>
              <Icon name="image" size={25} />
            </span>
            <h3>Loading Gallery...</h3>
            <p>ScoutOS is gathering the newest shared photos.</p>
          </div>
        </section>
      )}

      {!loading && photos.length === 0 && (
        <section className="panel">
          <div className="empty-state">
            <span>
              <Icon name={search || mineOnly || selectedAlbumId !== "all" ? "search" : "image"} size={25} />
            </span>
            <h3>{search || mineOnly || selectedAlbumId !== "all" ? "No photos found" : "No Gallery photos yet"}</h3>
            <p>
              {search || mineOnly || selectedAlbumId !== "all"
                ? "Try a different search or album filter."
                : canUpload ? "Add the first shared ScoutOS photos for the group." : "No shared ScoutOS photos have been added yet."}
            </p>
            {canUpload && !search && !mineOnly && selectedAlbumId === "all" && (
              <button className="button button-primary empty-state-button" onClick={() => setUploadOpen(true)} type="button">
                <Icon name="upload" size={17} />
                Upload Photos
              </button>
            )}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <GalleryGrid onDelete={deletePhoto} onOpen={(photo) => setViewerPhotoId(photo.id)} photos={photos} />
          {nextCursor && (
            <div className="gallery-load-more">
              <button className="button button-secondary" disabled={loadingMore} onClick={loadMore} type="button">
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </section>
      )}

      {canUpload && uploadOpen && (
        <GalleryUploadModal
          albums={albums}
          canCreateAlbum={canCreateAlbum}
          onClose={() => setUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}

      {viewerPhoto && (
        <GalleryViewer
          albums={albums}
          hasNext={viewerIndex < photos.length - 1}
          hasPrevious={viewerIndex > 0}
          key={viewerPhoto.id}
          onClose={() => setViewerPhotoId(null)}
          onDelete={deletePhoto}
          onNext={() => setViewerPhotoId(photos[viewerIndex + 1]?.id || viewerPhoto.id)}
          onPrevious={() => setViewerPhotoId(photos[viewerIndex - 1]?.id || viewerPhoto.id)}
          onUpdated={updatePhoto}
          photo={viewerPhoto}
        />
      )}

      {toast && (
        <div className="toast toast-success">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default Gallery;
