import { ImageCard } from "./ImageCard";
import { useFileStore } from "../store/useFileStore";

export const GalleryGrid = () => {
  const files = useFileStore((state) => state.files);

  if (files.length === 0) {
    return (
      <section aria-label="Imported images" className="gallery-empty">
        <p>No JPEG files imported.</p>
      </section>
    );
  }

  return (
    <section aria-label="Imported images" className="gallery-grid">
      {files.map((file) => (
        <ImageCard file={file} key={file.id} />
      ))}
    </section>
  );
};

export default GalleryGrid;
