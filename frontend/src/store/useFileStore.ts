import { create } from "zustand";

import type { ImportedFile } from "../api/client";

export type { ImportedFile };

export type FileStoreState = {
  files: ImportedFile[];
  isImporting: boolean;
};

export type FileStoreActions = {
  addFiles: (files: ImportedFile[]) => void;
  clearFiles: () => void;
  setFiles: (files: ImportedFile[]) => void;
  setIsImporting: (isImporting: boolean) => void;
};

type FileStore = FileStoreState & FileStoreActions;

export const useFileStore = create<FileStore>()((set) => ({
  files: [],
  isImporting: false,
  addFiles: (files) =>
    set((state) => {
      const existingIds = new Set(state.files.map((file) => file.id));
      const newFiles = files.filter((file) => !existingIds.has(file.id));

      return { files: [...state.files, ...newFiles] };
    }),
  clearFiles: () => set({ files: [] }),
  setFiles: (files) => set({ files }),
  setIsImporting: (isImporting) => set({ isImporting }),
}));
