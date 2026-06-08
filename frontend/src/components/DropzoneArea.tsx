import React, { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

import { uploadFiles } from "../api/client";
import { useFileStore } from "../store/useFileStore";

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,image/jpeg";

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
            <div className="dropzone-icon-large">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#9ca3af">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="dropzone-title">Click to upload or drag and drop</h2>
            <p className="dropzone-hint">JPEGs (max. 50MB)</p>
          </>
        )}

        {hasFiles && (
          <div className="dropzone-content-compact">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="dropzone-icon-small">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>{isImporting ? "Importing..." : "Click to upload or drag and drop JPEGs"}</span>
          </div>
        )}
      </section>

      {popupContent && (
        <div className="modal-overlay" onClick={() => setPopupContent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Warnings</h3>
              <button className="modal-close" onClick={() => setPopupContent(null)}>✕</button>
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