import { useEffect, useState } from "react";
import Icon from "../Icon";
import { api, type GalleryAlbum, type GalleryPhoto } from "../../lib/api";

type GalleryViewerProps = {
  albums: GalleryAlbum[];
  hasNext: boolean;
  hasPrevious: boolean;
  onClose: () => void;
  onDelete: (photo: GalleryPhoto) => void;
  onNext: () => void;
  onPrevious: () => void;
  onUpdated: (photo: GalleryPhoto) => void;
  photo: GalleryPhoto;
};

function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GalleryViewer({
  albums,
  hasNext,
  hasPrevious,
  onClose,
  onDelete,
  onNext,
  onPrevious,
  onUpdated,
  photo,
}: GalleryViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption);
  const [albumId, setAlbumId] = useState(String(photo.albumId));
  const [eventDate, setEventDate] = useState(photo.eventDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editingField = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (event.key === "Escape") onClose();
      if (editingField) return;
      if (event.key === "ArrowLeft" && hasPrevious) onPrevious();
      if (event.key === "ArrowRight" && hasNext) onNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious]);

  const saveDetails = async () => {
    try {
      setSaving(true);
      setError("");
      const result = await api.gallery.update(photo.id, {
        caption,
        albumId: Number(albumId),
        eventDate,
      });
      onUpdated(result.photo);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update photo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gallery-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Gallery photo viewer"
        aria-modal="true"
        className="gallery-viewer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close photo viewer" className="gallery-viewer-close" onClick={onClose} type="button">
          <Icon name="x" size={20} />
        </button>

        <div className="gallery-viewer-stage">
          <button
            aria-label="Previous photo"
            className="gallery-viewer-nav previous"
            disabled={!hasPrevious}
            onClick={onPrevious}
            type="button"
          >
            <Icon name="arrowLeft" size={22} />
          </button>

          {imageFailed ? (
            <div className="gallery-viewer-fallback">
              <Icon name="image" size={34} />
              Photo unavailable
            </div>
          ) : (
            <img
              alt={photo.caption || `Scout Gallery photo uploaded by ${photo.uploadedBy?.fullName || "ScoutOS"}`}
              onError={() => setImageFailed(true)}
              src={photo.imageUrl}
            />
          )}

          <button
            aria-label="Next photo"
            className="gallery-viewer-nav next"
            disabled={!hasNext}
            onClick={onNext}
            type="button"
          >
            <Icon name="arrowRight" size={22} />
          </button>
        </div>

        <aside className="gallery-viewer-details">
          {editing ? (
            <div className="gallery-edit-form">
              {error && <div className="form-error">{error}</div>}
              <label className="field">
                <span>Caption</span>
                <textarea maxLength={500} onChange={(event) => setCaption(event.target.value)} value={caption} />
              </label>
              <label className="field">
                <span>Album</span>
                <select onChange={(event) => setAlbumId(event.target.value)} value={albumId}>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Event date</span>
                <input onChange={(event) => setEventDate(event.target.value)} type="date" value={eventDate} />
              </label>
              <div className="form-actions">
                <button className="button button-secondary" disabled={saving} onClick={() => setEditing(false)} type="button">
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving} onClick={saveDetails} type="button">
                  <Icon name="check" size={17} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="eyebrow">{photo.albumName}</span>
              <h2>{photo.caption || "Scout Gallery photo"}</h2>
              <dl>
                <div>
                  <dt>Uploaded by</dt>
                  <dd>{photo.uploadedBy?.fullName || "ScoutOS user"}</dd>
                </div>
                <div>
                  <dt>Uploaded</dt>
                  <dd>{formatDate(photo.createdAt)}</dd>
                </div>
                <div>
                  <dt>Event date</dt>
                  <dd>{formatDate(photo.eventDate)}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>
                    {photo.width && photo.height ? `${photo.width} x ${photo.height} • ` : ""}
                    {(photo.fileSize / 1024 / 1024).toFixed(1)} MB
                  </dd>
                </div>
              </dl>
              {(photo.canEdit || photo.canDelete) && (
                <div className="gallery-viewer-actions">
                  {photo.canEdit && (
                    <button className="button button-secondary" onClick={() => setEditing(true)} type="button">
                      <Icon name="edit" size={17} />
                      Edit details
                    </button>
                  )}
                  {photo.canDelete && (
                    <button className="button gallery-danger-button" onClick={() => onDelete(photo)} type="button">
                      <Icon name="trash" size={17} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </section>
    </div>
  );
}

export default GalleryViewer;
