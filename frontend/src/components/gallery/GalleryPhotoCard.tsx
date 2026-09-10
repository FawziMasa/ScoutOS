import { useState } from "react";
import Icon from "../Icon";
import type { GalleryPhoto } from "../../lib/api";

type GalleryPhotoCardProps = {
  photo: GalleryPhoto;
  onDelete: (photo: GalleryPhoto) => void;
  onOpen: (photo: GalleryPhoto) => void;
};

function formatUploadedDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GalleryPhotoCard({ photo, onDelete, onOpen }: GalleryPhotoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const altText =
    photo.caption || `Scout Gallery photo uploaded by ${photo.uploadedBy?.fullName || "ScoutOS"}`;

  return (
    <article className="gallery-photo-card">
      <button
        aria-label={`Open ${altText}`}
        className="gallery-photo-button"
        onClick={() => onOpen(photo)}
        type="button"
      >
        {imageFailed ? (
          <span className="gallery-photo-fallback">
            <Icon name="image" size={26} />
            Photo unavailable
          </span>
        ) : (
          <img
            alt={altText}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={photo.thumbnailUrl}
          />
        )}
        <span className="gallery-photo-overlay">
          <strong>{photo.caption || photo.albumName}</strong>
          <small>
            {photo.uploadedBy?.fullName || "ScoutOS"} • {formatUploadedDate(photo.createdAt)}
          </small>
        </span>
      </button>

      {photo.canDelete && (
        <button
          aria-label="Delete photo"
          className="gallery-photo-delete"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(photo);
          }}
          type="button"
        >
          <Icon name="trash" size={17} />
        </button>
      )}
    </article>
  );
}

export default GalleryPhotoCard;
