import { useEffect, useState } from "react";
import {
  listFiles,
  deleteFile,
  exportSelectedFiles,
  getMetadata,
  updateMetadata,
} from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import { GalleryGrid } from "./components/GalleryGrid";
import { useFileStore } from "./store/useFileStore";
import welcomeLogo from "./assets/logo.svg";
import "./styles.css";

type WorkspaceTopbarProps = {
  importedCount: number;
};

const WorkspaceTopbar = ({ importedCount }: WorkspaceTopbarProps) => (
  <header className="workspace-topbar">
    <div className="workspace-brand">
      <div className="workspace-brand-pill">Socks on stocks</div>
      <p>Prepare and upload stock images faster</p>
    </div>

    <nav className="workspace-nav" aria-label="Workspace sections">
      <span aria-current="page">Files</span>
      <span>|</span>
      <span>Metadata</span>
      <span>|</span>
      <span>FTP</span>
      <span>|</span>
      <span>Uploads</span>
      <span>|</span>
      <span>Log</span>
    </nav>

    <div className="workspace-import-count">{importedCount} imported</div>
  </header>
);

export const App = () => {
  const files = useFileStore((state) => state.files);
  const setFiles = useFileStore((state) => state.setFiles);
  const selectedFileIds = useFileStore((state) => state.selectedFileIds);
  const selectAll = useFileStore((state) => state.selectAll);
  const deselectAll = useFileStore((state) => state.deselectAll);

  const [loadError, setLoadError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [duplicateTemplateId, setDuplicateTemplateId] = useState<number | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0);

  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;
  const duplicateTemplateFile = duplicateTemplateId
    ? files.find((file) => file.id === duplicateTemplateId)
    : null;
  const duplicateTargetIds = duplicateTemplateId
    ? selectedFileIds.filter((id) => id !== duplicateTemplateId)
    : [];

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

  const handleStartDuplicate = () => {
    setExportMessage("");

    if (selectedFileIds.length !== 1) {
      setDuplicateMessage("Select one template photo first.");
      return;
    }

    const templateId = selectedFileIds[0];
    const templateFile = files.find((file) => file.id === templateId);
    setDuplicateTemplateId(templateId);
    setDuplicateMessage(
      `Template: ${templateFile?.filename ?? "selected photo"}. Select target photos, then apply metadata.`,
    );
    deselectAll();
  };

  const handleCancelDuplicate = () => {
    setDuplicateTemplateId(null);
    setDuplicateMessage("");
    setExportMessage("");
    deselectAll();
  };

  const handleExportSelected = async () => {
    if (selectedFileIds.length === 0) return;

    setIsExporting(true);
    setExportMessage("");
    setDuplicateMessage("");

    try {
      await exportSelectedFiles(selectedFileIds);
      setExportMessage(`Exported ${selectedFileIds.length} file(s) to ZIP.`);
    } catch (error) {
      console.error("Failed to export selected files:", error);
      setExportMessage("Selected files could not be exported.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyDuplicate = async () => {
    if (!duplicateTemplateId) return;
    if (duplicateTargetIds.length === 0) {
      setDuplicateMessage("Select at least one target photo.");
      return;
    }

    setIsDuplicating(true);
    setExportMessage("");
    try {
      const templateMetadata = await getMetadata(duplicateTemplateId);
      await Promise.all(
        duplicateTargetIds.map((id) =>
          updateMetadata(id, {
            title: templateMetadata.title,
            description: templateMetadata.description,
            keywords: templateMetadata.keywords,
          }),
        ),
      );
      setMetadataRefreshKey((key) => key + 1);
      setDuplicateMessage(`Metadata duplicated to ${duplicateTargetIds.length} file(s).`);
      setDuplicateTemplateId(null);
      deselectAll();
    } catch (error) {
      console.error("Failed to duplicate metadata:", error);
      setDuplicateMessage("Metadata could not be duplicated.");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteSelected = async () => {
    const idsToDelete = [...selectedFileIds];

    setIsClearing(true);
    try {
      for (const id of idsToDelete) {
        await deleteFile(id);
      }
      const remainingFiles = files.filter(f => !idsToDelete.includes(f.id));
      setFiles(remainingFiles);
      deselectAll();

      if (duplicateTemplateId && idsToDelete.includes(duplicateTemplateId)) {
        setDuplicateTemplateId(null);
        setDuplicateMessage("");
      }
    } catch (error) {
      console.error("Failed to delete selected files:", error);
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  if (files.length === 0) {
    return (
      <main className="welcome-screen">
        <WorkspaceTopbar importedCount={files.length} />

        {loadError && <p className="app-alert welcome-alert">{loadError}</p>}

        <section className="welcome-stage" aria-label="Welcome import workspace">
          <img className="welcome-logo" src={welcomeLogo} alt="" />
          <DropzoneArea />
          <GalleryGrid />
        </section>
      </main>
    );
  }

  return (
    <main className="file-import-screen">
      <WorkspaceTopbar importedCount={files.length} />

      <section className="file-import-dropzone" aria-label="Add more JPEG files">
        <DropzoneArea />
      </section>

      <div className="file-import-actions">
        <button className="file-action-button file-action-button--select" onClick={handleSelectAllToggle}>
          {isAllSelected ? "Deselect all" : "Select all"}
        </button>

        <div className="file-import-actions__right">
          {duplicateTemplateId ? (
            <>
              <button
                className="file-action-button"
                disabled={duplicateTargetIds.length === 0 || isDuplicating}
                onClick={handleApplyDuplicate}
                type="button"
              >
                {isDuplicating ? "Applying..." : "Apply metadata"}
              </button>
              <button
                className="file-action-button"
                disabled={isDuplicating}
                onClick={handleCancelDuplicate}
                type="button"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="file-action-button"
                onClick={handleStartDuplicate}
                disabled={selectedFileIds.length === 0}
                type="button"
              >
                Duplicate as...
              </button>
              <button
                className="file-action-button"
                disabled={selectedFileIds.length === 0 || isExporting}
                onClick={handleExportSelected}
                type="button"
              >
                {isExporting ? "Exporting..." : "Export selected"}
              </button>
            </>
          )}
          {!showConfirm ? (
            <button
              className="file-action-button file-action-button--delete"
              disabled={selectedFileIds.length === 0}
              onClick={() => setShowConfirm(true)}
              type="button"
            >
              Delete
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
          <button
            className="file-action-button"
            disabled
            type="button"
          >
            Upload to FTP
          </button>
        </div>
      </div>

      {duplicateMessage && (
        <p className="file-import-status">
          {duplicateMessage}
          {duplicateTemplateFile ? ` Targets selected: ${duplicateTargetIds.length}.` : ""}
        </p>
      )}

      {exportMessage && <p className="file-import-status">{exportMessage}</p>}

      {loadError && <p className="app-alert file-import-alert">{loadError}</p>}
      
      <section className="file-import-list" aria-label="Imported JPEG files">
        <GalleryGrid
          duplicateTemplateId={duplicateTemplateId}
          metadataRefreshKey={metadataRefreshKey}
        />
      </section>
    </main>
  );
};

export default App;
