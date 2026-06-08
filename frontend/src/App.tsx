import { useEffect, useState } from "react";
import { listFiles, deleteFile } from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import { GalleryGrid } from "./components/GalleryGrid";
import { useFileStore } from "./store/useFileStore";
import "./styles.css";

export const App = () => {
  const files = useFileStore((state) => state.files);
  const setFiles = useFileStore((state) => state.setFiles);
  const [loadError, setLoadError] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      for (const file of files) {
        await deleteFile(file.id);
      }
      setFiles([]);
    } catch (error) {
      console.error("Failed to clear workspace:", error);
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
        {!showConfirm ? (
          <button className="clear-workspace-btn" onClick={() => setShowConfirm(true)}>
            Delete all from workspace
          </button>
        ) : (
          <div className="clear-confirm-box">
            <span className="clear-confirm-text">Are you sure you want to clear your workspace?</span>
            <div className="clear-confirm-buttons">
              <button className="btn-yes" onClick={handleClearAll} disabled={isClearing}>
                {isClearing ? "Clearing..." : "Yes"}
              </button>
              <button className="btn-cancel" onClick={() => setShowConfirm(false)} disabled={isClearing}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {loadError && <p className="app-alert">{loadError}</p>}
      
      <div className="gallery-container">
        <GalleryGrid />
      </div>
    </main>
  );
};

export default App;