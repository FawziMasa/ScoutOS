import type { GalleryAlbum } from "../../lib/api";

type GalleryAlbumFilterProps = {
  albums: GalleryAlbum[];
  selectedAlbumId: number | "all";
  totalPhotos: number;
  onSelect: (albumId: number | "all") => void;
};

function albumDetails(album: GalleryAlbum) {
  const details = [album.unit?.name || "All units"];
  if (album.eventDate) {
    details.push(new Date(`${album.eventDate}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }));
  }
  return details.join(" · ");
}

function GalleryAlbumFilter({
  albums,
  selectedAlbumId,
  totalPhotos,
  onSelect,
}: GalleryAlbumFilterProps) {
  return (
    <div className="gallery-album-strip" aria-label="Gallery albums">
      <button
        className={`gallery-album-chip ${selectedAlbumId === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
        type="button"
      >
        <span>All Photos</span>
        <strong>{totalPhotos}</strong>
      </button>

      {albums.map((album) => (
        <button
          className={`gallery-album-chip ${selectedAlbumId === album.id ? "active" : ""}`}
          key={album.id}
          onClick={() => onSelect(album.id)}
          title={album.description || albumDetails(album)}
          type="button"
        >
          <span className="gallery-album-copy">
            <span>{album.name}</span>
            <small>{albumDetails(album)}</small>
          </span>
          <strong>{album.photoCount}</strong>
        </button>
      ))}
    </div>
  );
}

export default GalleryAlbumFilter;
