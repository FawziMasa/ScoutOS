import { useRef, useState, useEffect } from "react";
import Icon from "../Icon";
import { api, type GalleryAlbum, type GalleryPhoto } from "../../lib/api";

type GalleryUploadModalProps = {
  albums: GalleryAlbum[];
  canCreateAlbum: boolean;
  onClose: () => void;
  onUploaded: (photos: GalleryPhoto[], message: string) => void;
};

type SelectedUpload = {
  id: string;
  file: File;
  previewUrl: string;
};

const maxFiles = 10;
const maxFileSize = 12 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function uploadId(file: File) {
  const randomId = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${file.name}-${file.size}-${file.lastModified}-${randomId}`;
}

function readableFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileValidationError(file: File) {
  if (!acceptedTypes.has(file.type)) return "JPEG, PNG, and WebP photos are supported.";
  if (!file.size) return "Empty files cannot be uploaded.";
  if (file.size > maxFileSize) return "Each photo must be 12 MB or smaller.";
  return "";
}

function GalleryUploadModal({
  albums,
  canCreateAlbum,
  onClose,
  onUploaded,
}: GalleryUploadModalProps) {
  const [selected, setSelected] = useState<SelectedUpload[]>([]);
  const [caption, setCaption] = useState("");
  const [albumId, setAlbumId] = useState("default");
  const [albumName, setAlbumName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedRef = useRef<SelectedUpload[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(
    () => () => {
      selectedRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setError("");
    setSelected((current) => {
      const existingKeys = new Set(current.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const next = [...current];
      const rejected: string[] = [];

      for (const file of incoming) {
        const duplicateKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (existingKeys.has(duplicateKey)) continue;

        const validationError = fileValidationError(file);
        if (validationError) {
          rejected.push(`${file.name}: ${validationError}`);
          continue;
        }

        if (next.length >= maxFiles) {
          rejected.push(`Upload at most ${maxFiles} photos at a time.`);
          break;
        }

        existingKeys.add(duplicateKey);
        next.push({
          id: uploadId(file),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (rejected.length > 0) setError(rejected[0]);
      return next;
    });
  };

  const removeSelected = (id: string) => {
    setSelected((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const closeModal = () => {
    selectedRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    selectedRef.current = [];
    onClose();
  };

  const submitUpload = async () => {
    if (selected.length === 0) {
      setError("Select at least one photo.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const result = await api.gallery.upload({
        files: selected.map((item) => item.file),
        caption,
        albumId: albumName.trim() ? null : albumId === "default" ? null : Number(albumId),
        albumName: albumName.trim(),
        eventDate,
      });

      if (result.uploaded.length > 0) {
        const albumLabel = albumName.trim() || albums.find((album) => String(album.id) === albumId)?.name || "Scout Moments";
        onUploaded(
          result.uploaded,
          `${result.uploaded.length} ${result.uploaded.length === 1 ? "photo" : "photos"} added to ${albumLabel}.`,
        );
      }

      if (result.failed.length > 0) {
        const failedIndexes = new Set(result.failed.map((failure) => failure.index));
        setSelected((current) => {
          current.forEach((item, index) => {
            if (!failedIndexes.has(index)) URL.revokeObjectURL(item.previewUrl);
          });
          return current.filter((_, index) => failedIndexes.has(index));
        });
        setError(result.failed[0].error);
        return;
      }

      closeModal();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload photos.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <div
        aria-labelledby="gallery-upload-title"
        aria-modal="true"
        className="modal gallery-upload-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Shared Gallery</span>
            <h2 id="gallery-upload-title">Upload Photos</h2>
          </div>
          <button aria-label="Close" className="round-button" onClick={closeModal} type="button">
            <Icon name="x" size={18} />
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div
          className={`gallery-dropzone ${dragging ? "dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Select gallery photos"
            multiple
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
            ref={inputRef}
            type="file"
          />
          <span className="gallery-dropzone-icon">
            <Icon name="upload" size={28} />
          </span>
          <button className="button button-primary" onClick={() => inputRef.current?.click()} type="button">
            <Icon name="plus" size={17} />
            Select Photos
          </button>
          <small>JPEG, PNG, or WebP • up to 12 MB each • {maxFiles} photos per batch</small>
        </div>

        {selected.length > 0 && (
          <div className="gallery-upload-preview">
            <div className="gallery-upload-preview-heading">
              <strong>{selected.length} selected</strong>
              <button
                className="button button-secondary"
                onClick={() => {
                  selected.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                  setSelected([]);
                }}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="gallery-upload-preview-grid">
              {selected.map((item) => (
                <figure key={item.id}>
                  <img alt={item.file.name} src={item.previewUrl} />
                  <button
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removeSelected(item.id)}
                    type="button"
                  >
                    <Icon name="x" size={15} />
                  </button>
                  <figcaption>
                    <span>{item.file.name}</span>
                    <small>{readableFileSize(item.file.size)}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        <div className="gallery-upload-fields">
          <label className="field field-wide">
            <span>Caption</span>
            <textarea
              maxLength={500}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Summer camp opening ceremony"
              value={caption}
            />
          </label>

          <label className="field">
            <span>Album</span>
            <select
              disabled={Boolean(albumName.trim())}
              onChange={(event) => setAlbumId(event.target.value)}
              value={albumId}
            >
              <option value="default">Scout Moments</option>
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

          {canCreateAlbum && (
            <label className="field field-wide">
              <span>New album</span>
              <input
                maxLength={120}
                onChange={(event) => setAlbumName(event.target.value)}
                placeholder="Summer Camp 2026"
                value={albumName}
              />
            </label>
          )}
        </div>

        <div className="form-actions">
          <button className="button button-secondary" disabled={uploading} onClick={closeModal} type="button">
            Cancel
          </button>
          <button className="button button-primary" disabled={uploading || selected.length === 0} onClick={submitUpload} type="button">
            <Icon name="upload" size={18} />
            {uploading
              ? `Uploading ${selected.length}...`
              : `Upload ${selected.length || ""} ${selected.length === 1 ? "Photo" : "Photos"}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GalleryUploadModal;
