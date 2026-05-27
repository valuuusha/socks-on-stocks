import { create } from "zustand";

export type ImportedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  file: File;
};

export type FileStoreState = {
  files: ImportedFile[];
  isImporting: boolean;
};

export type FileStoreActions = {
  addFiles: (files: File[]) => void;
  clearFiles: () => void;
  setIsImporting: (isImporting: boolean) => void;
};

const createFileId = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

const toImportedFile = (file: File): ImportedFile => ({
  id: createFileId(file),
  name: file.name,
  size: file.size,
  type: file.type || "image/jpeg",
  lastModified: file.lastModified,
  file,
});

type FileStore = FileStoreState & FileStoreActions;

export const useFileStore = create<FileStore>()((set) => ({
  files: [],
  isImporting: false,
  addFiles: (files) =>
    set((state) => {
      const existingIds = new Set(state.files.map((file) => file.id));
      const newFiles = files
        .map(toImportedFile)
        .filter((file) => !existingIds.has(file.id));

      return { files: [...state.files, ...newFiles] };
    }),
  clearFiles: () => set({ files: [] }),
  setIsImporting: (isImporting) => set({ isImporting }),
}));
