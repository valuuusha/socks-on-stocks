import { ImageCard } from "./ImageCard";
import { useFileStore } from "../store/useFileStore";

type GalleryGridProps = {
  duplicateTemplateId?: number | null;
  metadataRefreshKey?: number;
};

export const GalleryGrid = ({
  duplicateTemplateId = null,
  metadataRefreshKey = 0,
}: GalleryGridProps) => {
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
        <ImageCard
          file={file}
          isDuplicateTemplate={file.id === duplicateTemplateId}
          key={file.id}
          metadataRefreshKey={metadataRefreshKey}
        />
      ))}
    </section>
  );
};

export default GalleryGrid;
