import { Link } from "react-router-dom";
import Icon from "../Icon";
import type { GallerySummary } from "../../lib/api";
import "./Gallery.css";

type DashboardGalleryPreviewProps = {
  error: boolean;
  loading: boolean;
  summary: GallerySummary | null;
};

function DashboardGalleryPreview({ error, loading, summary }: DashboardGalleryPreviewProps) {

  const latestPhotos = summary?.latestPhotos || [];

  return (
    <article className="panel dashboard-gallery-panel">
      <div className="panel-heading dashboard-gallery-heading">
        <div>
          <span className="eyebrow">Shared memories</span>
          <h2>Gallery</h2>
        </div>
        <Link className="button button-secondary" to="/gallery">
          View Gallery
          <Icon name="chevron" size={16} />
        </Link>
      </div>

      {loading && <div className="dashboard-gallery-loading">Loading gallery...</div>}

      {!loading && error && (
        <div className="dashboard-gallery-empty">
          <span>
            <Icon name="image" size={24} />
          </span>
          <strong>Gallery preview unavailable</strong>
        </div>
      )}

      {!loading && !error && latestPhotos.length > 0 && (
        <>
          <div className="dashboard-gallery-strip">
            {latestPhotos.map((photo) => (
              <img
                alt={photo.caption || `Scout Gallery photo uploaded by ${photo.uploadedBy?.fullName || "ScoutOS"}`}
                key={photo.id}
                loading="lazy"
                src={photo.thumbnailUrl}
              />
            ))}
          </div>
          <div className="dashboard-gallery-stats">
            <span>{summary?.totalPhotos || 0} photos</span>
            <span>{summary?.totalAlbums || 0} albums</span>
          </div>
        </>
      )}

      {!loading && !error && latestPhotos.length === 0 && (
        <div className="dashboard-gallery-empty">
          <span>
            <Icon name="image" size={24} />
          </span>
          <strong>No photos yet</strong>
          <Link className="button button-primary" to="/gallery">
            <Icon name="upload" size={17} />
            Add photos
          </Link>
        </div>
      )}
    </article>
  );
}

export default DashboardGalleryPreview;
