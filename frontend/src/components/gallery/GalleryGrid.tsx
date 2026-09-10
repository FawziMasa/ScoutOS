import type { GalleryPhoto } from "../../lib/api";
import GalleryPhotoCard from "./GalleryPhotoCard";

type GalleryGridProps = {
  photos: GalleryPhoto[];
  onDelete: (photo: GalleryPhoto) => void;
  onOpen: (photo: GalleryPhoto) => void;
};

function GalleryGrid({ photos, onDelete, onOpen }: GalleryGridProps) {
  return (
    <div className="gallery-grid">
      {photos.map((photo) => (
        <GalleryPhotoCard
          key={photo.id}
          onDelete={onDelete}
          onOpen={onOpen}
          photo={photo}
        />
      ))}
    </div>
  );
}

export default GalleryGrid;
