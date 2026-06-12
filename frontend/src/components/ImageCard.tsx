import { useEffect, useState } from "react";
import { useFileStore } from "../store/useFileStore";
import { deleteFile, getMetadata, updateMetadata } from "../api/client";
import type { ImportedFile } from "../store/useFileStore";
import { TagsInput } from "./TagsInput";

type ImageCardProps = {
  file: ImportedFile;
  isDuplicateTemplate?: boolean;
  metadataRefreshKey?: number;
};

const formatFileSize = (sizeKb: number) => {
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`;
  return `${Math.max(sizeKb, 1).toFixed(0)} KB`;
};

const FORBIDDEN_CHARS_REGEX = /[&#@%!?/*\\]/g;

export const ImageCard = ({
  file,
  isDuplicateTemplate = false,
  metadataRefreshKey = 0,
}: ImageCardProps) => {
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const removeFile = useFileStore((state) => state.removeFile);
  const selectedFileIds = useFileStore((state) => state.selectedFileIds);
  const toggleSelection = useFileStore((state) => state.toggleSelection);

  const isSelected = selectedFileIds.includes(file.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(true);

  const hasRequiredMetadata = title.trim() !== "" && description.trim() !== "" && keywords.length > 0;
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
  }, [file.id, metadataRefreshKey]);

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
    <article
      className={`image-row ${isSelected ? "image-row--selected" : ""} ${
        isDuplicateTemplate ? "image-row--duplicate-template" : ""
      }`}
    >
      <button
        className="image-row__delete-btn"
        onClick={handleDelete}
        title="Delete"
        type="button"
      >
        x
      </button>

      <div className="image-row__media">
        <div className="image-row__preview-wrapper">
          <button
            aria-label={isSelected ? "Deselect file" : "Select file"}
            className="image-row__select-wrapper"
            onClick={() => toggleSelection(file.id)}
            type="button"
          >
            <span className={`custom-checkbox ${isSelected ? "custom-checkbox--active" : ""}`}>
              {isSelected && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          </button>

          {hasPreviewError ? (
            <div className="image-row__fallback">
              <span>Your photo</span>
            </div>
          ) : (
            <img
              alt={file.filename}
              className="image-row__preview-image"
              loading="lazy"
              onError={() => setHasPreviewError(true)}
              src={file.thumbnailUrl}
            />
          )}
        </div>

        <div className="image-row__meta-info">
          <span title={file.filename} className="filename">
            {file.filename}
          </span>
          <span className="file-size">
            {file.fileFormat} - {formatFileSize(file.fileSizeKb)}
          </span>
          <span className="file-status">
            Status: {isMetaLoading ? "Loading metadata" : hasRequiredMetadata ? "Ready" : "Missing metadata"}
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
              placeholder="Title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(sanitizeText(e.target.value))}
              onBlur={handleBlur}
            />
            <textarea
              className="meta-textarea"
              placeholder="Description"
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
