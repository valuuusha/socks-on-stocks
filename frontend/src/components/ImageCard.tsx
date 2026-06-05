import { memo, useEffect, useRef, useState } from "react";
import { useFileStore } from "../store/useFileStore";
import { deleteFile, getMetadata, updateMetadata } from "../api/client";
import type { ImportedFile } from "../store/useFileStore";
import { TagsInput } from "./TagsInput";

type ImageCardProps = {
  file: ImportedFile;
};

const formatFileSize = (sizeKb: number) => {
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`;
  return `${Math.max(sizeKb, 1).toFixed(0)} KB`;
};

const ImageCardComponent = ({ file }: ImageCardProps) => {
  const rowRef = useRef<HTMLElement | null>(null);
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const removeFile = useFileStore((state) => state.removeFile);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(true);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(row);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    setIsMetaLoading(true);

    getMetadata(file.id)
      .then((data) => {
        if (!isMounted) return;
        setTitle(data.title || "");
        setDescription(data.description || "");
        setKeywords(data.keywords || []);
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setIsMetaLoading(false);
      });

    return () => { isMounted = false; };
  }, [file.id, isVisible]);

  const handleDelete = async () => {
    try {
      await deleteFile(file.id);
      removeFile(file.id);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleBlur = async () => {
    try {
      await updateMetadata(file.id, { title, description, keywords });
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  return (
    <article className="image-row" ref={rowRef}>
      <button className="image-row__delete-btn" onClick={handleDelete} title="Delete">✕</button>

      <div className="image-row__media">
        <div className="image-row__preview">
          {hasPreviewError ? (
            <div className="image-row__fallback">
              <span>JPG</span>
            </div>
          ) : (
            <img
              alt={file.filename}
              loading="lazy"
              onError={() => setHasPreviewError(true)}
              src={file.thumbnailUrl}
            />
          )}
        </div>
        <div className="image-row__meta-info">
          <span title={file.filename} className="filename">{file.filename}</span>
          <span className="file-size">{file.fileFormat} - {formatFileSize(file.fileSizeKb)}</span>
        </div>
      </div>

      <div className="image-row__fields">
        {isMetaLoading ? (
          <div className="text-gray-400 text-sm">Loading metadata...</div>
        ) : (
          <>
            <input
              type="text"
              className="meta-input"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlur}
            />
            <textarea
              className="meta-textarea"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlur}
            />
            <TagsInput 
              tags={keywords} 
              onChange={setKeywords} 
              onBlur={handleBlur} 
            />
          </>
        )}
      </div>
    </article>
  );
};

export const ImageCard = memo(ImageCardComponent);
