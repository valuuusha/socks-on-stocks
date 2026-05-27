import { useState } from "react";

import type { ImportedFile } from "../store/useFileStore";

type ImageCardProps = {
  file: ImportedFile;
};

const formatFileSize = (sizeKb: number) => {
  if (sizeKb >= 1024) {
    return `${(sizeKb / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(sizeKb, 1).toFixed(0)} KB`;
};

export const ImageCard = ({ file }: ImageCardProps) => {
  const [hasPreviewError, setHasPreviewError] = useState(false);

  return (
    <article className="image-card">
      <div className="image-card__preview">
        {hasPreviewError ? (
          <div className="image-card__fallback" role="img" aria-label={file.filename}>
            <span>JPG</span>
          </div>
        ) : (
          <img
            alt={file.filename}
            decoding="async"
            loading="lazy"
            onError={() => setHasPreviewError(true)}
            src={file.thumbnailUrl}
          />
        )}
      </div>

      <div className="image-card__meta">
        <h3 title={file.filename}>{file.filename}</h3>
        <p>{formatFileSize(file.fileSizeKb)}</p>
      </div>
    </article>
  );
};

export default ImageCard;
