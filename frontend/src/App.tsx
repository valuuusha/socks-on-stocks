import { useEffect, useState } from "react";
import { listFiles } from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import { GalleryGrid } from "./components/GalleryGrid";
import { useFileStore } from "./store/useFileStore";
import "./styles.css";

export const App = () => {
  const files = useFileStore((state) => state.files);
  const setFiles = useFileStore((state) => state.setFiles);
  const [loadError, setLoadError] = useState("");

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
        <h1>Socks on Stocks</h1>
      </header>

      <div className="thin-dropzone">
        <DropzoneArea />
      </div>

      {loadError && <p className="app-alert">{loadError}</p>}
      
      <div className="gallery-container">
        <GalleryGrid />
      </div>
    </main>
  );
};

export default App;