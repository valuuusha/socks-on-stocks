import { useState, useEffect } from "react";
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

const FORBIDDEN_CHARS_REGEX = /[&#@%!?/*\\]/g;

export const ImageCard = ({ file }: ImageCardProps) => {
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const removeFile = useFileStore((state) => state.removeFile);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(true);

  const sanitizeText = (text: string) => text.replace(FORBIDDEN_CHARS_REGEX, "");

  useEffect(() => {
    getMetadata(file.id)
      .then((data) => {
        setTitle(data.title || "");
        setDescription(data.description || "");
        setKeywords(data.keywords || []);
      })
      .catch(console.error)
      .finally(() => setIsMetaLoading(false));
  }, [file.id]);

  const handleDelete = async () => {
    try {
      await deleteFile(file.id);
      removeFile(file.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleBlur = async () => {
    try {
      await updateMetadata(file.id, { title, description, keywords });
    } catch (error) {
      console.error("Update failed, restoring data from server:", error);
      
      getMetadata(file.id)
        .then((data) => {
          setTitle(data.title || "");
          setDescription(data.description || "");
          setKeywords(data.keywords || []);
        })
        .catch(console.error);
    }
  };

  return (
    <article className="image-row">
      <div className="image-row__media">
        <div className="image-row__preview-wrapper">
          <button
            className="image-row__delete-btn"
            onClick={handleDelete}
            title="Delete"
          >
            ✕
          </button>
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
              className="image-row__preview-image"
            />
          )}
        </div>

        <div className="image-row__meta-info">
          <span title={file.filename} className="filename">
            {file.filename}
          </span>
          <span className="file-size">
            {file.fileFormat} • {formatFileSize(file.fileSizeKb)}
          </span>
        </div>
      </div>

      <div className="image-row__fields">
        {isMetaLoading ? (
          <div className="meta-loader">Loading metadata...</div>
        ) : (
          <>
            <input
              type="text"
              className="meta-input"
              placeholder="Title (max 200 chars)"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(sanitizeText(e.target.value))}
              onBlur={handleBlur}
            />
            <textarea
              className="meta-textarea"
              placeholder="Description (max 2000 chars)"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(sanitizeText(e.target.value))}
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