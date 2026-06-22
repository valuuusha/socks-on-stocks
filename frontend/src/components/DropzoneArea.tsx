import React, { ReactNode } from "react";
import { importFiles, pickFiles } from "../api/client";
import { useFileStore } from "../store/useFileStore";

export const DropzoneArea = () => {
  const { addFiles, files, isImporting, setIsImporting, setImportWarnings } = useFileStore();
  const hasFiles = files.length > 0;

  const handleNativeImport = async () => {
    if (isImporting) return;
    
    try {
      const selectedPaths = await pickFiles();
      if (!selectedPaths || selectedPaths.length === 0) return;
      
      if (selectedPaths.length > 100) {
        setImportWarnings(
          <div className="modal-error-block">
            <strong className="modal-error-title">Upload Limit Exceeded</strong>
            <p>Please select a maximum of 100 files at once.</p>
          </div>
        );
        return;
      }

      setIsImporting(true);
      const result = await importFiles(selectedPaths);
      addFiles(result.imported);

      const errors: ReactNode[] = [];
      
      if (result.rejected.length > 0) {
        const tooLarge = result.rejected.filter(r => r.reason.includes("50 MB"));
        const others = result.rejected.filter(r => !r.reason.includes("50 MB"));

        if (tooLarge.length > 0) {
          errors.push(
            <div key="oversized" className="modal-error-block">
              <strong className="modal-error-title">Files exceed 50 MB limit:</strong>
              <ul className="modal-list">
                {tooLarge.map((r) => <li key={r.path}>{r.path.split(/[\/\\]/).pop()}</li>)}
              </ul>
            </div>
          );
        }

        if (others.length > 0) {
          errors.push(
            <div key="others" className="modal-error-block">
              <strong className="modal-error-title">Failed to import:</strong>
              <ul className="modal-list">
                {others.map((r) => <li key={r.path}>{r.path.split(/[\/\\]/).pop()} - {r.reason}</li>)}
              </ul>
            </div>
          );
        }
      }

      if (errors.length > 0) {
        setImportWarnings(<>{errors}</>);
      }

    } catch (err) {
      console.error(err);
      setImportWarnings(
        <div className="modal-error-block">
          <strong className="modal-error-title">Import Error</strong>
          <p>Could not load files. Check connection to backend.</p>
        </div>
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
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
  );
};

export default DropzoneArea;