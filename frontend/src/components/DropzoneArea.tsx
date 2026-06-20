import React, { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import { uploadFiles } from "../api/client";
import { useFileStore } from "../store/useFileStore";

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,image/jpeg";
const POPUP_AUTO_HIDE_MS = 7000;

const isJpegFile = (file: File) => {
  const lowerCaseName = file.name.toLowerCase();
  return (
    file.type === "image/jpeg" ||
    lowerCaseName.endsWith(".jpg") ||
    lowerCaseName.endsWith(".jpeg")
  );
};

export const DropzoneArea = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [popupContent, setPopupContent] = useState<ReactNode | null>(null);
  const { addFiles, files, isImporting, setIsImporting } = useFileStore();

  const hasFiles = files.length > 0;

  React.useEffect(() => {
    if (!popupContent) return;

    const timeoutId = window.setTimeout(() => {
      setPopupContent(null);
    }, POPUP_AUTO_HIDE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [popupContent]);

  const openFileDialog = () => {
    if (!isImporting) {
      inputRef.current?.click();
    }
  };

  const importSelectedFiles = async (selectedFiles: FileList | File[]) => {
    const filesArray = Array.from(selectedFiles);

    if (filesArray.length === 0) return;

    if (filesArray.length > 100) {
      setPopupContent(
        <div className="modal-error-block">
          <strong className="modal-error-title">Upload Limit Exceeded</strong>
          <p>You selected {filesArray.length} files. Please select a maximum of 100 files at once.</p>
        </div>
      );
      return;
    }

    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    const validFiles: File[] = [];
    const oversizedFiles: string[] = [];
    const nonJpegFiles: string[] = [];

    filesArray.forEach((f) => {
      if (!isJpegFile(f)) {
        nonJpegFiles.push(f.name);
      } else if (f.size > MAX_SIZE_BYTES) {
        oversizedFiles.push(f.name);
      } else {
        validFiles.push(f);
      }
    });

    const errors: ReactNode[] = [];

    if (oversizedFiles.length > 0) {
      errors.push(
        <div key="oversized" className="modal-error-block">
          <strong className="modal-error-title">Files exceed 50 MB limit:</strong>
          <ul className="modal-list">
            {oversizedFiles.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
      );
    }

    if (nonJpegFiles.length > 0) {
      errors.push(
        <div key="wrongType" className="modal-error-block">
          <strong className="modal-error-title">Not JPEG files:</strong>
          <ul className="modal-list">
            {nonJpegFiles.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
      );
    }

    if (validFiles.length > 0) {
      setIsImporting(true);
      try {
        const result = await uploadFiles(validFiles);
        addFiles(result.imported);

        if (result.rejected.length > 0) {
          errors.push(
            <div key="backend" className="modal-error-block">
              <strong className="modal-error-title">Failed to import (Server Error):</strong>
              <ul className="modal-list">
                {result.rejected.map((r) => <li key={r.path}>{r.path} - {r.reason}</li>)}
              </ul>
            </div>
          );
        }
      } catch (err) {
        errors.push(
          <div key="fatal" className="modal-error-block">
            <strong className="modal-error-title">Import Error:</strong>
            <p>{err instanceof Error ? err.message : "Files could not be imported."}</p>
          </div>
        );
      } finally {
        setIsImporting(false);
      }
    }

    if (errors.length > 0) {
      setPopupContent(<>{errors}</>);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void importSelectedFiles(event.target.files);
    }
    event.target.value = "";
  };

  const handleImportButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openFileDialog();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    void importSelectedFiles(event.dataTransfer.files);
  };

  return (
    <>
      <section
        aria-label="JPEG import area"
        onClick={openFileDialog}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`dropzone-wrapper ${hasFiles ? "dropzone-compact" : "dropzone-large"} ${isDragging ? "dropzone-active" : ""}`}
      >
        <input
          ref={inputRef}
          accept={ACCEPTED_FILE_TYPES}
          hidden
          multiple
          onChange={handleInputChange}
          type="file"
        />

        {!hasFiles && (
          <>
            <p className="dropzone-welcome-text">
              {isDragging ? "Drop JPEG files here" : "Drag and drop .jpg or .jpeg files here"}
            </p>
            <button
              className="dropzone-import-button"
              disabled={isImporting}
              onClick={handleImportButtonClick}
              type="button"
            >
              {isImporting ? "Importing..." : "Import JPEG"}
            </button>
          </>
        )}

        {hasFiles && (
          <>
            <p className="dropzone-file-import-text">
              {isDragging ? "Drop JPEG files here" : "Drag and drop .jpg or .jpeg files here"}
            </p>
            <button
              className="dropzone-import-button dropzone-import-button--compact"
              disabled={isImporting}
              onClick={handleImportButtonClick}
              type="button"
            >
              {isImporting ? "Importing..." : "Import JPEG"}
            </button>
          </>
        )}
      </section>

      {popupContent && (
        <div className="modal-overlay" onClick={() => setPopupContent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Warnings</h3>
              <button className="modal-close" onClick={() => setPopupContent(null)}>x</button>
            </div>
            <div className="modal-body">
              {popupContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DropzoneArea;
