import React, { useState } from "react";
import type { ReactNode } from "react";
import { importFiles, pickFiles } from "../api/client";
import { useFileStore } from "../store/useFileStore";

const POPUP_AUTO_HIDE_MS = 7000;

export const DropzoneArea = () => {
  const [popupContent, setPopupContent] = useState<ReactNode | null>(null);
  const { addFiles, files, isImporting, setIsImporting } = useFileStore();

  const hasFiles = files.length > 0;

  React.useEffect(() => {
    if (!popupContent) return;
    const timeoutId = window.setTimeout(() => setPopupContent(null), POPUP_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [popupContent]);

  const handleNativeImport = async () => {
    if (isImporting) return;
    
    try {
      // 1. Відкриваємо нативне вікно через бекенд
      const selectedPaths = await pickFiles();
      
      if (!selectedPaths || selectedPaths.length === 0) return;
      
      if (selectedPaths.length > 100) {
        setPopupContent(
          <div className="modal-error-block">
            <strong className="modal-error-title">Upload Limit Exceeded</strong>
            <p>Please select a maximum of 100 files at once.</p>
          </div>
        );
        return;
      }

      setIsImporting(true);
      
      // 2. Відправляємо АБСОЛЮТНІ шляхи на бекенд для імпорту
      const result = await importFiles(selectedPaths);
      addFiles(result.imported);

      if (result.rejected.length > 0) {
        setPopupContent(
          <div className="modal-error-block">
            <strong className="modal-error-title">Failed to import:</strong>
            <ul className="modal-list">
              {result.rejected.map((r) => <li key={r.path}>{r.path} - {r.reason}</li>)}
            </ul>
          </div>
        );
      }
    } catch (err) {
      console.error(err);
      setPopupContent(
        <div className="modal-error-block">
          <strong className="modal-error-title">Import Error:</strong>
          <p>Could not open file picker or import files.</p>
        </div>
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <section
        aria-label="JPEG import area"
        onClick={handleNativeImport}
        className={`dropzone-wrapper ${hasFiles ? "dropzone-compact" : "dropzone-large"}`}
      >
        {!hasFiles ? (
          <>
            <p className="dropzone-welcome-text">Click to select .jpg or .jpeg files from your computer</p>
            <button className="dropzone-import-button" disabled={isImporting} type="button">
              {isImporting ? "Importing..." : "Select Files"}
            </button>
          </>
        ) : (
          <>
            <p className="dropzone-file-import-text">Click to select more files</p>
            <button className="dropzone-import-button dropzone-import-button--compact" disabled={isImporting} type="button">
              {isImporting ? "Importing..." : "Add Files"}
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
            <div className="modal-body">{popupContent}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default DropzoneArea;