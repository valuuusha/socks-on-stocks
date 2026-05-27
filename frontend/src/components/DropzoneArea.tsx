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
    border: "2px dashed #7a8aa0",
    borderRadius: "8px",
    padding: "32px",
    textAlign: "center",
    backgroundColor: "#f8fafc",
    color: "#172033",
    transition: "border-color 160ms ease, background-color 160ms ease",
  },
  wrapperActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 700,
  },
  hint: {
    margin: "0 0 20px",
    color: "#5d6b82",
    fontSize: "14px",
  },
  button: {
    border: 0,
    borderRadius: "6px",
    padding: "10px 16px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },
  buttonDisabled: {
    cursor: "not-allowed",
    opacity: 0.7,
  },
  message: {
    margin: "16px 0 0",
    color: "#b42318",
    fontSize: "14px",
  },
} satisfies Record<string, CSSProperties>;

export const DropzoneArea = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const { addFiles, files, isImporting, setIsImporting } = useFileStore();

  const openFileDialog = () => {
    inputRef.current?.click();
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
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...styles.wrapper,
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

      <h2 style={styles.title}>Import JPEG</h2>
      <p style={styles.hint}>Drag and drop .jpg or .jpeg files here.</p>

      <button
        disabled={isImporting}
        onClick={openFileDialog}
        style={{
          ...styles.button,
          ...(isImporting ? styles.buttonDisabled : {}),
        }}
        type="button"
      >
        {isImporting ? "Importing..." : "Import JPEG"}
      </button>

      {validationMessage && <p style={styles.message}>{validationMessage}</p>}
      {files.length > 0 && (
        <p style={styles.hint}>{files.length} JPEG file(s) imported.</p>
      )}
    </section>
  );
};

export default DropzoneArea;
