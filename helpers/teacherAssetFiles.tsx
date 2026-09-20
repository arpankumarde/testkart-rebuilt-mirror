/*
 * Shared by the asset library endpoints and the teacher console: which files
 * the library takes, how they are typed, and the shape of one library item.
 */

export type TeacherAssetKindValue = "video" | "pdf";

export type TeacherAsset = {
  id: number;
  key: string;
  url: string;
  name: string;
  kind: TeacherAssetKindValue;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  /** Course lessons of this teacher that use the file. */
  lessonCount: number;
  /** Study notes of this teacher that include the file. */
  notesCount: number;
};

export const ASSET_NAME_MAX = 200;
export const MAX_LIBRARY_BATCH = 20;

const EXTENSION_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

export const LIBRARY_ACCEPT =
  "video/mp4,video/webm,video/quicktime,application/pdf,.mp4,.m4v,.webm,.mov,.pdf";

export const libraryFolder = (teacherId: number) => `library/${teacherId}`;

export const isLibraryFolder = (folder: string) =>
  folder.replace(/^\/+/, "").startsWith("library/");

/** The accepted MIME type for a library file, taken from the extension when the browser left it untyped. */
export function libraryMimeType(fileName: string, type: string): string | null {
  const accepted = Object.values(EXTENSION_TYPES);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fromExtension = EXTENSION_TYPES[extension] ?? null;
  if (type && accepted.includes(type)) {
    // A PDF must still be named .pdf, since the lesson viewer is picked by type.
    return type === "application/pdf" && fromExtension !== "application/pdf" ? null : type;
  }
  return fromExtension;
}

export function assetKindForMime(mimeType: string | null | undefined): TeacherAssetKindValue | null {
  if (!mimeType) return null;
  if (mimeType === "application/pdf") return "pdf";
  if (Object.values(EXTENSION_TYPES).includes(mimeType) && mimeType.startsWith("video/")) return "video";
  return null;
}

// "Lecture 1 - Basics.mp4" keeps its hyphen; slug-style "lecture_1-basics.mp4" gets spaces.
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const spaced = /\s/.test(base) ? base.replace(/_+/g, " ") : base.replace(/[_-]+/g, " ");
  return spaced.replace(/\s+/g, " ").trim().slice(0, ASSET_NAME_MAX) || "Untitled file";
}

export function formatAssetSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatAssetDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(secs).padStart(2, "0")}`;
}