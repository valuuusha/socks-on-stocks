import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";

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

const styles = {
  wrapper: {
    border: "2px dashed #d1d5db",
    borderRadius: "8px",
    padding: "32px",
    textAlign: "center",
    backgroundColor: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    transition: "border-color 160ms ease, background-color 160ms ease",
  },
  wrapperActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  wrapperCompact: {
    padding: "0 16px",
    height: "44px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "16px",
    fontWeight: 600,
  },
  hint: {
    margin: "0 0 16px",
    color: "#6b7280",
    fontSize: "14px",
  },
  message: {
    margin: "16px 0 0",
    color: "#ef4444",
    fontSize: "14px",
  },
  compactContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#6b7280",
  }
} satisfies Record<string, CSSProperties>;

export const DropzoneArea = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const { addFiles, files, isImporting, setIsImporting } = useFileStore();

  const hasFiles = files.length > 0;

  const openFileDialog = () => {
    if (!isImporting) {
      inputRef.current?.click();
    }
  };

  const importSelectedFiles = async (selectedFiles: FileList | File[]) => {
    const filesArray = Array.from(selectedFiles);

    if (filesArray.length === 0) {
      setValidationMessage("");
      return;
    }

    const jpegFiles = filesArray.filter(isJpegFile);
    const rejectedCount = filesArray.length - jpegFiles.length;

    const clientValidationMessage =
      rejectedCount > 0
        ? "Only JPEG files with .jpg or .jpeg extension can be imported."
        : "";

    setValidationMessage(clientValidationMessage);

    if (jpegFiles.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      const result = await uploadFiles(jpegFiles);
      addFiles(result.imported);

      const backendMessage =
        result.rejected.length > 0
          ? `${result.rejected.length} file(s) could not be imported. ${result.rejected[0].reason}`
          : "";

      setValidationMessage(
        [clientValidationMessage, backendMessage].filter(Boolean).join(" "),
      );
    } catch (error) {
      setValidationMessage(
        error instanceof Error ? error.message : "Files could not be imported.",
      );
    } finally {
      setIsImporting(false);
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
    <section
      aria-label="JPEG import area"
      onClick={openFileDialog}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...styles.wrapper,
        ...(hasFiles ? styles.wrapperCompact : {}),
        ...(isDragging ? styles.wrapperActive : {}),
      }}
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
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" style={{ width: "48px", height: "48px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 style={styles.title}>Click to upload or drag and drop</h2>
          <p style={styles.hint}>JPEGs (max. 45MB)</p>
        </>
      )}

      {hasFiles && (
        <div style={styles.compactContent}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: "18px", height: "18px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>{isImporting ? "Importing..." : "Click to upload or drag and drop JPEGs"}</span>
        </div>
      )}

      {validationMessage && <p style={styles.message}>{validationMessage}</p>}
    </section>
  );
};

export default DropzoneArea;