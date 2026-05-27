import { useEffect, useState } from "react";

import { listFiles } from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import GalleryGrid from "./components/GalleryGrid";
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
        if (isMounted) {
          setFiles(workspaceFiles);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadError("Workspace files could not be loaded.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [setFiles]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Socks on Stocks</h1>
          <p>Workspace import foundation</p>
        </div>
        <span className="file-counter">{files.length} imported</span>
      </header>

      {loadError && <p className="app-alert">{loadError}</p>}
      <DropzoneArea />
      <GalleryGrid />
    </main>
  );
};

export default App;
