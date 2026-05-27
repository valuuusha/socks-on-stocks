const API_BASE_URL = "http://localhost:8000";

export type ImportFilesResult = {
  paths: string[];
  total: number;
};

export const importFiles = async (
  paths: string[],
): Promise<ImportFilesResult> => {
  return {
    paths,
    total: paths.length,
  };
};

export const apiClient = {
  baseUrl: API_BASE_URL,
  importFiles,
};
