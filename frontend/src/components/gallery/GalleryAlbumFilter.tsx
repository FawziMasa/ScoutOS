import type { GalleryAlbum } from "../../lib/api";

type GalleryAlbumFilterProps = {
  albums: GalleryAlbum[];
  selectedAlbumId: number | "all";
  totalPhotos: number;
  onSelect: (albumId: number | "all") => void;
};

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
          type="button"
        >
          <span>{album.name}</span>
          <strong>{album.photoCount}</strong>
        </button>
      ))}
    </div>
  );
}

export default GalleryAlbumFilter;
