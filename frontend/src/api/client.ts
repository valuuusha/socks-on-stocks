const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");

export type ApiFileResponse = {
  id: number;
  filename: string;
  absolute_path: string;
  file_size_kb: number;
  file_format: string;
  status: string;
};

export type ImportedFile = {
  id: number;
  filename: string;
  absolutePath: string;
  fileSizeKb: number;
  fileFormat: string;
  status: string;
  thumbnailUrl: string;
};

export type RejectedFile = {
  path: string;
  reason: string;
};

type ApiImportFilesResult = {
  imported: ApiFileResponse[];
  rejected: RejectedFile[];
  total: number;
};

export type ImportFilesResult = {
  imported: ImportedFile[];
  rejected: RejectedFile[];
  total: number;
};

export type FileMetadata = {
  file_id: number;
  title: string;
  description: string;
  keywords: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (body: unknown, fallback: string) => {
  if (!isRecord(body) || !("detail" in body)) {
    return fallback;
  }

  const { detail } = body;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        isRecord(item) && typeof item.msg === "string" ? item.msg : "",
      )
      .filter(Boolean);

    return messages.length > 0 ? messages.join(" ") : fallback;
  }

  return fallback;
};

const requestJson = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorBody: unknown = null;

    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }

    throw new Error(
      getErrorMessage(errorBody, `Request failed with status ${response.status}.`),
    );
  }

  return response.json() as Promise<T>;
};

export const getThumbnailUrl = (fileId: number) =>
  `${API_BASE_URL}/api/files/${fileId}/thumbnail`;

const toImportedFile = (file: ApiFileResponse): ImportedFile => ({
  id: file.id,
  filename: file.filename,
  absolutePath: file.absolute_path,
  fileSizeKb: file.file_size_kb,
  fileFormat: file.file_format,
  status: file.status,
  thumbnailUrl: getThumbnailUrl(file.id),
});

export const importFiles = async (
  paths: string[],
): Promise<ImportFilesResult> => {
  const result = await requestJson<ApiImportFilesResult>("/api/files/import", {
    method: "POST",
    body: JSON.stringify({ paths }),
  });

  return {
    imported: result.imported.map(toImportedFile),
    rejected: result.rejected,
    total: result.total,
  };
};

export const uploadFiles = async (
  files: File[],
): Promise<ImportFilesResult> => {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorBody: unknown = null;

    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }

    throw new Error(
      getErrorMessage(errorBody, `Request failed with status ${response.status}.`),
    );
  }

  const result = (await response.json()) as ApiImportFilesResult;

  return {
    imported: result.imported.map(toImportedFile),
    rejected: result.rejected,
    total: result.total,
  };
};

export const listFiles = async (): Promise<ImportedFile[]> => {
  const files = await requestJson<ApiFileResponse[]>("/api/files/");
  return files.map(toImportedFile);
};

export const apiClient = {
  baseUrl: API_BASE_URL,
  getThumbnailUrl,
  importFiles,
  uploadFiles,
  listFiles,
};

export const deleteFile = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/files/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }
    throw new Error(
      getErrorMessage(errorBody, `Failed to delete file with status ${response.status}.`)
    );
  }
};

export const getMetadata = async (fileId: number): Promise<FileMetadata> => {
  const response = await fetch(`${API_BASE_URL}/api/metadata/${fileId}`);
  if (!response.ok) throw new Error("Failed to fetch metadata");
  return response.json();
};

export const updateMetadata = async (fileId: number, data: Partial<FileMetadata>): Promise<FileMetadata> => {
  const response = await fetch(`${API_BASE_URL}/api/metadata/${fileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update metadata");
  return response.json();
};

export const pickFiles = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/api/files/pick`);
  if (!response.ok) throw new Error("Failed to open file picker");
  const data = await response.json();
  return data.paths;
};

export const exportSelectedFiles = async (fileIds: number[]) => {
  const response = await fetch(`${API_BASE_URL}/api/files/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Export failed");
  }

  return response.json();
};

export type FtpProfile = {
  id?: number;
  platform_name: string;
  host: string;
  port: number;
  login: string;
  directory: string;
};

export const getFtpProfiles = async (): Promise<FtpProfile[]> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp`);
  if (!response.ok) throw new Error("Failed to fetch FTP profiles");
  return response.json();
};

export const saveFtpProfile = async (profile: FtpProfile & { password?: string }): Promise<FtpProfile> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error("Failed to save FTP profile");
  return response.json();
};

export const updateFtpProfile = async (
  id: number,
  profile: FtpProfile & { password?: string }
): Promise<FtpProfile> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error("Failed to update FTP profile");
  return response.json();
};

export const deleteFtpProfile = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete FTP profile");
};

export const testFtpConnection = async (profile: FtpProfile & { password?: string }): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Connection failed");
  }
  return response.json();
};

export type FtpUploadRequest = {
  platform_name: string;
  host: string;
  port: number;
  login: string;
  password?: string;
  directory: string;
  file_ids: number[];
};

export type FtpUploadResponse = {
  success_count: number;
  total: number;
  errors: string[];
};

export const uploadToFtp = async (data: FtpUploadRequest): Promise<FtpUploadResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/ftp/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "Upload failed");
  }
  return response.json();
};

export type ConflictData = {
  file_id: number;
  filename: string;
  file_meta: { title: string; description: string; keywords: string[] };
  db_meta: { title: string; description: string; keywords: string[] };
};

export const syncMetadata = async (): Promise<ConflictData[]> => {
  const response = await fetch(`${API_BASE_URL}/api/metadata/sync`);
  if (!response.ok) return [];
  return response.json();
};

export const resolveConflict = async (fileId: number, targetData: { title: string; description: string; keywords: string[] }) => {
  return updateMetadata(fileId, targetData);
};
