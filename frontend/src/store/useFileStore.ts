import { create } from "zustand";

import type { ImportedFile } from "../api/client";

export type { ImportedFile };

export type FileStoreState = {
  files: ImportedFile[];
  isImporting: boolean;
  selectedFileId: number | null;
  selectedFileIds: number[];
};

export type FileStoreActions = {
  addFiles: (files: ImportedFile[]) => void;
  clearFiles: () => void;
  setFiles: (files: ImportedFile[]) => void;
  setIsImporting: (isImporting: boolean) => void;
  removeFile: (id: number) => void;
  setSelectedFileId: (id: number | null) => void;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
};

type FileStore = FileStoreState & FileStoreActions;

const getInitialSelectedId = (): number | null => {
  const saved = localStorage.getItem("lastSelectedFileId");
  return saved ? parseInt(saved, 10) : null;
};

export const useFileStore = create<FileStore>()((set) => ({
  files: [],
  isImporting: false,
  selectedFileId: getInitialSelectedId(),
  selectedFileIds: [],
  addFiles: (newFiles) =>
    set((state) => {
      const existingIds = new Set(state.files.map((f) => f.id));
      const uniqueNewFiles = newFiles.filter((f) => !existingIds.has(f.id));

      return {
        files: [...state.files, ...uniqueNewFiles],
      };
    }),
  clearFiles: () => set({ files: [], selectedFileIds: [] }),
  setFiles: (files) => set({ files }),
  setIsImporting: (isImporting) => set({ isImporting }),
  removeFile: (id) => 
    set((state) => ({
      files: state.files.filter((file) => file.id !== id),
      selectedFileIds: state.selectedFileIds.filter((selectedId) => selectedId !== id),
    })),
  setSelectedFileId: (id) => {
    if (id !== null) {
      localStorage.setItem("lastSelectedFileId", id.toString());
    }
    set({ selectedFileId: id });
  },
  toggleSelection: (id) =>
    set((state) => ({
      selectedFileIds: state.selectedFileIds.includes(id)
        ? state.selectedFileIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedFileIds, id],
    })),
  selectAll: () => set((state) => ({ selectedFileIds: state.files.map((f) => f.id) })),
  deselectAll: () => set({ selectedFileIds: [] }),
}));