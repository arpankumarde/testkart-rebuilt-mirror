import { useState, useCallback } from "react";
import { postUploadPresign } from "../endpoints/upload/presign_POST.schema";
import { postUploadDelete } from "../endpoints/upload/delete_POST.schema";
import { postUploadMultipartInitiate } from "../endpoints/upload/multipart/initiate_POST.schema";
import { postUploadMultipartComplete } from "../endpoints/upload/multipart/complete_POST.schema";
import { isNotAuthenticatedError, reportAuthFailure, SESSION_ENDED_UPLOAD_MESSAGE } from "./sessionSync";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const CONCURRENT_UPLOADS = 3;
const PART_SIZE = 50 * 1024 * 1024; // 50 MB

async function uploadFileMultipart(
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; key: string }> {
  const actualFileName = fileName || (file instanceof File ? file.name : "upload.bin");
  const contentType = file.type || "application/octet-stream";
  const fileSize = file.size;

  const { uploadId, key, publicUrl, parts } = await postUploadMultipartInitiate({
    fileName: actualFileName,
    contentType,
    folder,
    fileSize,
  });

  const partBytesUploaded: number[] = new Array(parts.length).fill(0);
  let uploadedPartsCount = 0;

  const queue = parts.map((part, index) => ({
    partNumber: part.partNumber,
    presignedUrl: part.presignedUrl,
    index,
  }));

  let hasError = false;
  let uploadError: Error | null = null;

  async function worker() {
    while (queue.length > 0 && !hasError) {
      const task = queue.shift();
      if (!task) continue;

      const { partNumber, presignedUrl, index } = task;
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, fileSize);
      const blob = file.slice(start, end);

      let success = false;
      let retries = 3;
      let lastError: Error = new Error("Unknown error");

      while (retries > 0 && !success && !hasError) {
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl, true);
            xhr.setRequestHeader("Content-Type", contentType);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                partBytesUploaded[index] = event.loaded;
                if (onProgress) {
                  const totalUploaded = partBytesUploaded.reduce((a, b) => a + b, 0);
                  onProgress(Math.min(Math.round((totalUploaded / fileSize) * 100), 100));
                }
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Part ${partNumber} upload failed with status ${xhr.status}`));
              }
            };

            xhr.onerror = () => {
              reject(new Error(`Network error uploading part ${partNumber}`));
            };

            xhr.send(blob);
          });

          uploadedPartsCount++;
          success = true;
        } catch (error) {
          retries--;
          lastError = error instanceof Error ? error : new Error(String(error));
          partBytesUploaded[index] = 0; // Reset progress on failure
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!success && !hasError) {
        hasError = true;
        uploadError = lastError;
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENT_UPLOADS, parts.length) }).map(() =>
    worker()
  );
  await Promise.all(workers);

  if (hasError && uploadError) {
    throw uploadError;
  }

  if (uploadedPartsCount === 0) {
    throw new Error("No parts were uploaded successfully");
  }

  await postUploadMultipartComplete({
    key,
    uploadId,
  });

  return { url: publicUrl, key };
}

/**
 * Standalone asynchronous function to upload a file directly to R2 via presigned URLs.
 * Suitable for use in callbacks outside of React components (e.g., Tiptap/Quill image handlers).
 * A signed-out session is reported to AuthProvider and rethrown as a sign-in prompt.
 */
export const uploadFileToR2 = async (
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; key: string }> => {
  try {
    return await uploadWithPresignedUrls(file, folder, fileName, onProgress);
  } catch (error) {
    if (isNotAuthenticatedError(error)) {
      reportAuthFailure(error);
      throw new Error(SESSION_ENDED_UPLOAD_MESSAGE);
    }
    throw error;
  }
};

const uploadWithPresignedUrls = async (
  file: File | Blob,
  folder: string,
  fileName?: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; key: string }> => {
  if (file.size > MULTIPART_THRESHOLD) {
    return uploadFileMultipart(file, folder, fileName, onProgress);
  }

  const actualFileName = fileName || (file instanceof File ? file.name : "upload.bin");
  const contentType = file.type || "application/octet-stream";

  // 1. Get Presigned URL and Key from Backend
  const { presignedUrl, key, publicUrl } = await postUploadPresign({
    fileName: actualFileName,
    contentType,
    folder,
    fileSize: file.size,
  });

  // 2. Upload directly to Cloudflare R2 using XMLHttpRequest for progress tracking
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded / event.total) * 100);
          onProgress(percentCompleted);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status code ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error occurred during the upload process"));
    };

    xhr.send(file);
  });

  return { url: publicUrl, key };
};

/**
 * Standalone function to delete a file from R2 using its key.
 */
export const deleteR2File = async (key: string): Promise<void> => {
  await postUploadDelete({ key });
};

/**
 * React Hook for handling R2 file uploads with built-in uploading state tracking.
 */
export function useR2Upload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (
      file: File | Blob,
      folder: string,
      onProgress?: (pct: number) => void
    ): Promise<{ url: string; key: string }> => {
      setIsUploading(true);
      try {
        const result = await uploadFileToR2(file, folder, undefined, onProgress);
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return { uploadFile, isUploading };
}