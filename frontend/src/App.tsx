import { useEffect, useState } from "react";
import {
  listFiles,
  deleteFile,
  exportSelectedFiles,
  getMetadata,
  updateMetadata,
  syncMetadata,
  ConflictData,
  resolveConflict
} from "./api/client";
import DropzoneArea from "./components/DropzoneArea";
import { GalleryGrid } from "./components/GalleryGrid";
import { FtpWorkspace } from "./components/FtpWorkspace";
import { useFileStore } from "./store/useFileStore";
import welcomeLogo from "./assets/logo.svg";
import "./styles.css";

const NOTIFICATION_AUTO_HIDE_MS = 7000;

type WorkspaceTopbarProps = {
  importedCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const WorkspaceTopbar = ({ importedCount, activeTab, setActiveTab }: WorkspaceTopbarProps) => (
  <header className="workspace-topbar">
    <div className="workspace-brand">
      <div className="workspace-brand-pill">Socks on stocks</div>
      <p>Prepare and upload stock images faster</p>
    </div>

    <nav className="workspace-nav" aria-label="Workspace sections">
      <span 
        aria-current={activeTab === "files" ? "page" : undefined}
        onClick={() => setActiveTab("files")}
        style={{ cursor: "pointer" }}
      >
        Files
      </span>
      <span>|</span>
      <span 
        aria-current={activeTab === "metadata" ? "page" : undefined}
        onClick={() => setActiveTab("files")}
        style={{ cursor: "pointer" }}
      >
        Metadata
      </span>
      <span>|</span>
      <span 
        aria-current={activeTab === "ftp" ? "page" : undefined}
        onClick={() => setActiveTab("ftp")}
        style={{ cursor: "pointer" }}
      >
        FTP
      </span>
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

  const [activeTab, setActiveTab] = useState("files");
  const [loadError, setLoadError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [duplicateTemplateId, setDuplicateTemplateId] = useState<number | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [currentConflict, setCurrentConflict] = useState<ConflictData | null>(null);

  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;
  const duplicateTemplateFile = duplicateTemplateId ? files.find((file) => file.id === duplicateTemplateId) : null;
  const duplicateTargetIds = duplicateTemplateId ? selectedFileIds.filter((id) => id !== duplicateTemplateId) : [];

  const handleSyncAndCheck = async () => {
    try {
      const detected = await syncMetadata();
      setConflicts(detected);
      if (detected.length > 0) setCurrentConflict(detected[0]);
      setMetadataRefreshKey(k => k + 1);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    listFiles().then((workspaceFiles) => {
      if (isMounted) setFiles(workspaceFiles);
    }).catch(() => {
      if (isMounted) setLoadError("Workspace files could not be loaded.");
    });
    return () => { isMounted = false; };
  }, [setFiles]);

  useEffect(() => {
    if (files.length > 0) {
      handleSyncAndCheck();
    }
  }, [files.length]);

  useEffect(() => {
    if (!loadError) return;
    const timeoutId = window.setTimeout(() => setLoadError(""), NOTIFICATION_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [loadError]);

  useEffect(() => {
    if (!duplicateMessage) return;
    const timeoutId = window.setTimeout(() => setDuplicateMessage(""), NOTIFICATION_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [duplicateMessage]);

  useEffect(() => {
    if (!exportMessage) return;
    const timeoutId = window.setTimeout(() => setExportMessage(""), NOTIFICATION_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [exportMessage]);

  const handleResolveConflict = async (dataToKeep: { title: string; description: string; keywords: string[] }) => {
    if (!currentConflict) return;
    try {
      await resolveConflict(currentConflict.file_id, dataToKeep);
      const remaining = conflicts.filter(c => c.file_id !== currentConflict.file_id);
      setConflicts(remaining);
      setCurrentConflict(remaining.length > 0 ? remaining[0] : null);
      setMetadataRefreshKey(k => k + 1);
    } catch (error) {
      console.error("Failed to resolve conflict", error);
    }
  };

  const handleSelectAllToggle = () => {
    if (isAllSelected) deselectAll();
    else selectAll();
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
    setDuplicateMessage(`Template: ${templateFile?.filename ?? "selected photo"}. Select target photos, then apply metadata.`);
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
      const res = await exportSelectedFiles(selectedFileIds);
      setExportMessage(res.message || `Saved metadata to ${selectedFileIds.length} original file(s).`);
      deselectAll(); 
    } catch (error: any) {
      setExportMessage(`Export error: ${error.message}`);
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
          updateMetadata(id, { title: templateMetadata.title, description: templateMetadata.description, keywords: templateMetadata.keywords })
        )
      );
      setMetadataRefreshKey((key) => key + 1);
      setDuplicateMessage(`Metadata duplicated to ${duplicateTargetIds.length} file(s).`);
      setDuplicateTemplateId(null);
      deselectAll();
    } catch (error) {
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
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  if (files.length === 0) {
    return (
      <main className="welcome-screen">
        <WorkspaceTopbar importedCount={files.length} activeTab={activeTab} setActiveTab={setActiveTab} />
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
      <WorkspaceTopbar importedCount={files.length} activeTab={activeTab} setActiveTab={setActiveTab} />

      {currentConflict && (
        <div className="modal-overlay" style={{ zIndex: 100000 }}>
          <div className="modal-content" style={{ maxWidth: "800px", padding: "24px" }}>
            <h2 style={{ marginTop: 0, color: "#071a2d", fontSize: "20px" }}>Metadata Conflict Detected</h2>
            <p style={{ fontSize: "13px", lineHeight: "1.5" }}>
              <strong>{currentConflict.filename}</strong> has different metadata in the physical file versus your saved database. Choose which one to keep:
            </p>
            
            <div style={{ display: "flex", gap: "20px", marginTop: "24px" }}>
              <div style={{ flex: 1, border: "1px solid #7393b3", padding: "16px", borderRadius: "8px", background: "#f8fafc" }}>
                <h3 style={{ marginTop: 0, color: "#7393b3", fontSize: "16px" }}>Data from File (EXIF)</h3>
                <p style={{ fontSize: "12px" }}><strong>Title:</strong> {currentConflict.file_meta.title || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <p style={{ fontSize: "12px" }}><strong>Desc:</strong> {currentConflict.file_meta.description || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <p style={{ fontSize: "12px", marginBottom: "20px" }}><strong>Keywords:</strong> {currentConflict.file_meta.keywords.join(", ") || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <button 
                  style={{ width: "100%", padding: "12px", background: "#7393b3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                  onClick={() => handleResolveConflict(currentConflict.file_meta)}
                >
                  Keep File Data
                </button>
              </div>

              <div style={{ flex: 1, border: "1px solid #a9b4c0", padding: "16px", borderRadius: "8px", background: "#ffffff" }}>
                <h3 style={{ marginTop: 0, fontSize: "16px" }}>Data from Database</h3>
                <p style={{ fontSize: "12px" }}><strong>Title:</strong> {currentConflict.db_meta.title || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <p style={{ fontSize: "12px" }}><strong>Desc:</strong> {currentConflict.db_meta.description || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <p style={{ fontSize: "12px", marginBottom: "20px" }}><strong>Keywords:</strong> {currentConflict.db_meta.keywords.join(", ") || <i style={{color: "#9ca3af"}}>empty</i>}</p>
                <button 
                  style={{ width: "100%", padding: "12px", background: "#071a2d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                  onClick={() => handleResolveConflict(currentConflict.db_meta)}
                >
                  Keep Database Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ftp" ? (
        <FtpWorkspace onBack={() => setActiveTab("files")} />
      ) : (
        <>
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
                  <button className="file-action-button" disabled={duplicateTargetIds.length === 0 || isDuplicating} onClick={handleApplyDuplicate} type="button">
                    {isDuplicating ? "Applying..." : "Apply metadata"}
                  </button>
                  <button className="file-action-button" disabled={isDuplicating} onClick={handleCancelDuplicate} type="button">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="file-action-button" onClick={handleStartDuplicate} disabled={selectedFileIds.length === 0} type="button">
                    Duplicate as...
                  </button>
                  <button className="file-action-button" disabled={selectedFileIds.length === 0 || isExporting} onClick={handleExportSelected} type="button">
                    {isExporting ? "Exporting..." : "Export selected"}
                  </button>
                </>
              )}
              {!showConfirm ? (
                <button className="file-action-button file-action-button--delete" disabled={selectedFileIds.length === 0} onClick={() => setShowConfirm(true)} type="button">
                  Delete
                </button>
              ) : (
                <div className="clear-confirm-box">
                  <span className="clear-confirm-text">Delete {selectedFileIds.length} file(s)?</span>
                  <div className="clear-confirm-buttons">
                    <button className="btn-yes" onClick={handleDeleteSelected} disabled={isClearing}>{isClearing ? "Deleting..." : "Yes"}</button>
                    <button className="btn-cancel" onClick={() => setShowConfirm(false)} disabled={isClearing}>Cancel</button>
                  </div>
                </div>
              )}
              <button className="file-action-button" onClick={() => setActiveTab("ftp")} disabled={selectedFileIds.length === 0} type="button">Upload to FTP</button>
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
            <GalleryGrid duplicateTemplateId={duplicateTemplateId} metadataRefreshKey={metadataRefreshKey} />
          </section>
        </>
      )}
    </main>
  );
};

export default App;