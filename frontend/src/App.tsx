import { useEffect, useState } from "react";
import { listFiles, deleteFile, exportSelectedFiles } from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import { GalleryGrid } from "./components/GalleryGrid";
import { useFileStore } from "./store/useFileStore";
import "./styles.css";

export const App = () => {
  const files = useFileStore((state) => state.files);
  const setFiles = useFileStore((state) => state.setFiles);
  const selectedFileIds = useFileStore((state) => state.selectedFileIds);
  const selectAll = useFileStore((state) => state.selectAll);
  const deselectAll = useFileStore((state) => state.deselectAll);

  const [loadError, setLoadError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;

  useEffect(() => {
    let isMounted = true;
    listFiles()
      .then((workspaceFiles) => {
        if (isMounted) setFiles(workspaceFiles);
      })
      .catch(() => {
        if (isMounted) setLoadError("Workspace files could not be loaded.");
      });
    return () => { isMounted = false; };
  }, [setFiles]);

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const handleExportSelected = async () => {
    setIsExporting(true);
    try {
      await exportSelectedFiles(selectedFileIds);
    } catch (error) {
      console.error("Failed to export files:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSelected = async () => {
    setIsClearing(true);
    try {
      for (const id of selectedFileIds) {
        await deleteFile(id);
      }
      const remainingFiles = files.filter(f => !selectedFileIds.includes(f.id));
      setFiles(remainingFiles);
      deselectAll();
    } catch (error) {
      console.error("Failed to delete selected files:", error);
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  if (files.length === 0) {
    return (
      <main className="app-shell empty-workspace">
        <div className="empty-workspace__content">
          <h1>Socks on Stocks</h1>
          <p>No files in workspace. Add JPEGs to start editing.</p>
          <div className="empty-dropzone">
             <DropzoneArea />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell" style={{ maxWidth: "1000px" }}>
      <header className="app-header">
        <div>
          <h1>Socks on Stocks</h1>
          <p>Workspace ({files.length} files)</p>
        </div>
      </header>

      <div className="thin-dropzone">
        <DropzoneArea />
      </div>

      <div className="workspace-actions">
        <button className="select-all-btn" onClick={handleSelectAllToggle}>
          {isAllSelected ? "Deselect all" : "Select all"}
        </button>

        <div className="workspace-actions-right" style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="export-selected-btn" 
            onClick={handleExportSelected}
            disabled={selectedFileIds.length === 0 || isExporting}
          >
            {isExporting ? "Exporting..." : "Export selected"}
          </button>
          {!showConfirm ? (
            <button 
              className="clear-workspace-btn" 
              onClick={() => setShowConfirm(true)}
              disabled={selectedFileIds.length === 0}
            >
              Delete selected ({selectedFileIds.length})
            </button>
          ) : (
            <div className="clear-confirm-box">
              <span className="clear-confirm-text">Delete {selectedFileIds.length} file(s)?</span>
              <div className="clear-confirm-buttons">
                <button className="btn-yes" onClick={handleDeleteSelected} disabled={isClearing}>
                  {isClearing ? "Deleting..." : "Yes"}
                </button>
                <button className="btn-cancel" onClick={() => setShowConfirm(false)} disabled={isClearing}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loadError && <p className="app-alert">{loadError}</p>}
      
      <div className="gallery-container">
        <GalleryGrid />
      </div>
    </main>
  );
};

export default App;