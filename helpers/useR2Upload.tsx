import { useState, useCallback } from "react";
import { postUploadPresign } from "../endpoints/upload/presign_POST.schema";
import { postUploadDelete } from "../endpoints/upload/delete_POST.schema";
import { postUploadMultipartInitiate } from "../endpoints/upload/multipart/initiate_POST.schema";
import {
  postUploadMultipartComplete,
  UploadIncompleteError,
} from "../endpoints/upload/multipart/complete_POST.schema";
import {
  postUploadMultipartParts,
  UploadNotFoundError,
  type OutputType as PartsOutput,
} from "../endpoints/upload/multipart/parts_POST.schema";
import { isNotAuthenticatedError, reportAuthFailure, SESSION_ENDED_UPLOAD_MESSAGE } from "./sessionSync";

/*
 * Uploads go straight from the browser to R2. Anything above one part is sent
 * as a multipart upload in small parts, so a dropped connection costs at most
 * the parts in flight. Requests that stall or were opened on a network the
 * device has left are restarted, failures retry with backoff until nothing has
 * moved for several minutes, and the upload is remembered per file so picking
 * the same file again (even after a reload) continues where it stopped.
 */

const MiB = 1024 * 1024;
const MIN_PART_SIZE = 5 * MiB;
const MAX_PART_COUNT = 200;
const CONCURRENT_PARTS = 3;
const STALL_TIMEOUT_MS = 45_000;
const RESPONSE_TIMEOUT_MS = 90_000;
const GIVE_UP_ONLINE_MS = 5 * 60_000;
const GIVE_UP_OFFLINE_MS = 15 * 60_000;
const MAX_RETRY_DELAY_MS = 20_000;
// Upload URLs are signed for an hour.
const URL_REFRESH_MS = 50 * 60_000;
// R2 drops unfinished multipart uploads after 7 days.
const RESUME_TTL_MS = 5 * 24 * 60 * 60_000;
const RESUME_STORAGE_PREFIX = "tk-r2-upload:v1:";
const FINGERPRINT_BYTES = 64 * 1024;

export type UploadStatus = "uploading" | "reconnecting" | "offline";

export interface UploadOptions {
  /** Reports connection trouble while the upload retries on its own. */
  onStatus?: (status: UploadStatus) => void;
}

/** The upload gave up on a dead connection. Uploading the same file again resumes a multipart upload. */
export class UploadInterruptedError extends Error {}

type PutFailure = "network" | "stalled" | "interrupted" | "rejected";

class PutError extends Error {
  constructor(public reason: PutFailure, public status = 0) {
    super(`Upload request ${reason}${status ? ` (${status})` : ""}`);
  }
}

type NetworkInformationLike = EventTarget & { type?: string };

function createUploadMonitor(onStatus?: (status: UploadStatus) => void) {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  let connectionType = connection?.type;
  let lastProgressAt = Date.now();
  let failures = 0;
  let status: UploadStatus = "uploading";
  let wakers: Array<() => void> = [];
  const inflight = new Set<() => void>();

  const setStatus = (next: UploadStatus) => {
    if (next === status) return;
    status = next;
    onStatus?.(next);
  };
  const wakeAll = () => {
    const pending = wakers;
    wakers = [];
    pending.forEach((wake) => wake());
  };
  // A socket opened on the old network can hang without ever failing, so
  // requests restart as soon as the device switches networks or reconnects.
  const restartRequests = () => {
    [...inflight].forEach((interrupt) => interrupt());
    wakeAll();
  };
  const handleOnline = () => {
    setStatus("reconnecting");
    restartRequests();
  };
  const handleOffline = () => {
    setStatus("offline");
    restartRequests();
  };
  const handleConnectionChange = () => {
    if (connection?.type === connectionType) return;
    connectionType = connection?.type;
    restartRequests();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  connection?.addEventListener("change", handleConnectionChange);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        wakers = wakers.filter((wake) => wake !== done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      wakers.push(done);
    });

  return {
    inflight,
    progressed() {
      lastProgressAt = Date.now();
      failures = 0;
      setStatus("uploading");
    },
    failed() {
      failures++;
      setStatus(navigator.onLine === false ? "offline" : "reconnecting");
    },
    shouldGiveUp() {
      const limit = navigator.onLine === false ? GIVE_UP_OFFLINE_MS : GIVE_UP_ONLINE_MS;
      return Date.now() - lastProgressAt > limit;
    },
    /** Waits before the next retry; cut short when the connection comes back. */
    backoff() {
      return wait(Math.min(1000 * 2 ** Math.min(failures, 5), MAX_RETRY_DELAY_MS));
    },
    stopAll() {
      [...inflight].forEach((interrupt) => interrupt());
    },
    dispose() {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      connection?.removeEventListener("change", handleConnectionChange);
      wakeAll();
    },
  };
}

type UploadMonitor = ReturnType<typeof createUploadMonitor>;

function putBlob(
  url: string,
  body: Blob,
  contentType: string,
  monitor: UploadMonitor,
  onBytes: (loaded: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const finish = (error?: PutError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      monitor.inflight.delete(interrupt);
      if (error) reject(error);
      else resolve();
    };
    const interrupt = () => {
      finish(new PutError("interrupted"));
      xhr.abort();
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish(new PutError("stalled"));
        xhr.abort();
      }, ms);
    };

    monitor.inflight.add(interrupt);
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      arm(STALL_TIMEOUT_MS);
      monitor.progressed();
      onBytes(event.loaded);
    };
    // Every byte has left the device; R2 still has to answer.
    xhr.upload.onload = () => arm(RESPONSE_TIMEOUT_MS);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) finish();
      else finish(new PutError("rejected", xhr.status));
    };
    // R2 error responses carry no CORS header, so a rejected PUT also lands here.
    xhr.onerror = () => finish(new PutError("network"));
    xhr.onabort = () => finish(new PutError("interrupted"));
    arm(STALL_TIMEOUT_MS);
    xhr.send(body);
  });
}

/** fetch rejects with TypeError when the request never got an answer; a gateway error page fails to parse. */
function isRetryableRequestError(error: unknown): boolean {
  return error instanceof TypeError || error instanceof SyntaxError;
}

async function withRetries<T>(monitor: UploadMonitor, request: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (!isRetryableRequestError(error) || monitor.shouldGiveUp()) throw error;
      monitor.failed();
      await monitor.backoff();
    }
  }
}

interface ResumeRecord {
  key: string;
  uploadId: string;
  publicUrl: string;
  partSize: number;
  fingerprint: string;
  savedAt: number;
}

// Kept in memory too, for browsers that refuse localStorage.
const memoryResumeRecords = new Map<string, ResumeRecord>();

function readResumeRecord(storageKey: string): ResumeRecord | null {
  let record = memoryResumeRecords.get(storageKey) ?? null;
  if (!record) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      record = raw ? (JSON.parse(raw) as ResumeRecord) : null;
    } catch {
      record = null;
    }
  }
  if (!record || Date.now() - record.savedAt > RESUME_TTL_MS) return null;
  return record;
}

function writeResumeRecord(storageKey: string, record: ResumeRecord) {
  memoryResumeRecords.set(storageKey, record);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Resuming after a reload is a bonus; the in-memory copy still covers this page.
  }
}

function clearResumeRecord(storageKey: string) {
  memoryResumeRecords.delete(storageKey);
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing stored.
  }
}

/** Hash of the first and last 64 KB, so a different file with the same name and size never resumes. */
async function fingerprintFile(file: Blob): Promise<string | null> {
  try {
    const head = await file.slice(0, FINGERPRINT_BYTES).arrayBuffer();
    const tail = await file.slice(Math.max(0, file.size - FINGERPRINT_BYTES)).arrayBuffer();
    const bytes = new Uint8Array(head.byteLength + tail.byteLength);
    bytes.set(new Uint8Array(head), 0);
    bytes.set(new Uint8Array(tail), head.byteLength);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function partSizeFor(fileSize: number): number {
  return Math.max(MIN_PART_SIZE, Math.ceil(fileSize / MAX_PART_COUNT / MiB) * MiB);
}

async function keepScreenAwake(): Promise<() => void> {
  try {
    if (!("wakeLock" in navigator)) return () => {};
    const lock = await navigator.wakeLock.request("screen");
    return () => {
      lock.release().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

async function uploadSingle(
  file: Blob,
  folder: string,
  fileName: string,
  contentType: string,
  monitor: UploadMonitor,
  onProgress?: (pct: number) => void
): Promise<{ url: string; key: string }> {
  const presign = () => withRetries(monitor, () => postUploadPresign({ fileName, contentType, folder, fileSize: file.size }));
  let presigned = await presign();
  let presignedAt = Date.now();

  for (;;) {
    try {
      await putBlob(presigned.presignedUrl, file, contentType, monitor, (loaded) =>
        onProgress?.(Math.min(99, Math.floor((loaded / file.size) * 100)))
      );
      onProgress?.(100);
      return { url: presigned.publicUrl, key: presigned.key };
    } catch (error) {
      if (!(error instanceof PutError)) throw error;
      if (monitor.shouldGiveUp()) {
        throw new UploadInterruptedError("The upload stopped because the connection dropped. Check your internet and try again.");
      }
      monitor.failed();
      if (error.reason !== "interrupted") await monitor.backoff();
      if (Date.now() - presignedAt > URL_REFRESH_MS) {
        presigned = await presign();
        presignedAt = Date.now();
      }
    }
  }
}

async function uploadMultipart(
  file: Blob,
  folder: string,
  fileName: string,
  contentType: string,
  monitor: UploadMonitor,
  onProgress?: (pct: number) => void
): Promise<{ url: string; key: string }> {
  const partSize = partSizeFor(file.size);
  const partCount = Math.ceil(file.size / partSize);
  const sizeOf = (partNumber: number) =>
    partNumber < partCount ? partSize : file.size - partSize * (partCount - 1);
  const allPartNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

  const resumeKey = file instanceof File ? `${RESUME_STORAGE_PREFIX}${folder}:${fileName}:${file.size}` : null;
  const fingerprint = resumeKey ? await fingerprintFile(file) : null;

  const done = new Set<number>();
  const inflightBytes = new Map<number, number>();
  const urls = new Map<number, string>();
  let urlsAt = 0;
  let percent = 0;

  const report = () => {
    let bytes = 0;
    done.forEach((partNumber) => (bytes += sizeOf(partNumber)));
    inflightBytes.forEach((loaded) => (bytes += loaded));
    percent = Math.min(99, Math.floor((bytes / file.size) * 100));
    onProgress?.(percent);
  };

  // Returns false when R2 holds parts that do not fit this file, so it must start over.
  const applyServerParts = (result: PartsOutput, replaceDone: boolean): boolean => {
    if (result.uploadedParts.some((p) => p.partNumber > partCount || p.size !== sizeOf(p.partNumber))) return false;
    if (replaceDone) done.clear();
    result.uploadedParts.forEach((p) => done.add(p.partNumber));
    result.urls.forEach((u) => urls.set(u.partNumber, u.presignedUrl));
    urlsAt = Date.now();
    return true;
  };

  let session: { key: string; uploadId: string; publicUrl: string } | null = null;

  try {
    const stored = resumeKey && fingerprint ? readResumeRecord(resumeKey) : null;
    if (resumeKey && stored && stored.fingerprint === fingerprint && stored.partSize === partSize) {
      try {
        const result = await withRetries(monitor, () =>
          postUploadMultipartParts({ key: stored.key, uploadId: stored.uploadId, partNumbers: allPartNumbers })
        );
        if (applyServerParts(result, true)) session = stored;
        else clearResumeRecord(resumeKey);
      } catch (error) {
        if (!(error instanceof UploadNotFoundError)) throw error;
        clearResumeRecord(resumeKey);
      }
    }

    if (!session) {
      const init = await withRetries(monitor, () =>
        postUploadMultipartInitiate({ fileName, contentType, folder, fileSize: file.size, partSize })
      );
      if (init.partSize !== partSize || init.parts.length !== partCount) {
        throw new Error("The upload could not be prepared. Please refresh the page and try again.");
      }
      session = { key: init.key, uploadId: init.uploadId, publicUrl: init.publicUrl };
      init.parts.forEach((p) => urls.set(p.partNumber, p.presignedUrl));
      urlsAt = Date.now();
      if (resumeKey && fingerprint) {
        writeResumeRecord(resumeKey, { ...session, partSize, fingerprint, savedAt: Date.now() });
      }
    }
    const { key, uploadId, publicUrl } = session;
    report();

    // One lookup at a time, shared by every part waiting on it.
    let refreshing: Promise<void> | null = null;
    const refresh = (replaceDone = false) => {
      if (!refreshing) {
        const partNumbers = replaceDone ? allPartNumbers : allPartNumbers.filter((n) => !done.has(n));
        refreshing = withRetries(monitor, () => postUploadMultipartParts({ key, uploadId, partNumbers }))
          .then((result) => {
            if (!applyServerParts(result, replaceDone)) {
              throw new UploadNotFoundError("The saved upload does not match this file.");
            }
          })
          .finally(() => {
            refreshing = null;
          });
      }
      return refreshing;
    };

    const sendMissingParts = async () => {
      const queue = allPartNumbers.filter((n) => !done.has(n));
      let failure: unknown = null;

      const worker = async () => {
        for (let partNumber = queue.shift(); partNumber !== undefined && !failure; partNumber = queue.shift()) {
          const current = partNumber;
          while (!done.has(current) && !failure) {
            try {
              if (!urls.has(current) || Date.now() - urlsAt > URL_REFRESH_MS) await refresh();
              const url = urls.get(current);
              if (done.has(current) || failure) break;
              if (!url) throw new Error("The upload could not continue. Please try again.");
              const start = (current - 1) * partSize;
              await putBlob(url, file.slice(start, start + sizeOf(current)), contentType, monitor, (loaded) => {
                inflightBytes.set(current, loaded);
                report();
              });
              done.add(current);
            } catch (error) {
              if (!(error instanceof PutError)) throw error;
              if (failure) break;
              if (monitor.shouldGiveUp()) throw error;
              monitor.failed();
              if (error.reason !== "interrupted") {
                await monitor.backoff();
                // The part may have landed with its answer lost; the lookup tells, and re-signs the URL.
                urls.delete(current);
              }
            } finally {
              inflightBytes.delete(current);
              report();
            }
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENT_PARTS, queue.length) }, () =>
          worker().catch((error) => {
            if (!failure) {
              failure = error;
              monitor.stopAll();
            }
          })
        )
      );
      if (failure) throw failure;
    };

    for (let round = 0; ; round++) {
      await sendMissingParts();
      try {
        await withRetries(monitor, () => postUploadMultipartComplete({ key, uploadId, partCount }));
        break;
      } catch (error) {
        if (!(error instanceof UploadIncompleteError) || round >= 2) throw error;
        await refresh(true);
      }
    }

    if (resumeKey) clearResumeRecord(resumeKey);
    onProgress?.(100);
    return { url: publicUrl, key };
  } catch (error) {
    if (error instanceof UploadNotFoundError && resumeKey) clearResumeRecord(resumeKey);
    if (error instanceof PutError || isRetryableRequestError(error)) {
      const canResume = !!(resumeKey && fingerprint && session);
      throw new UploadInterruptedError(
        canResume
          ? `The connection dropped at ${percent}%. Your progress is saved - pick the same file again to continue from there.`
          : "The upload stopped because the connection dropped. Check your internet and try again.",
        { cause: error }
      );
    }
    throw error;
  }
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
  onProgress?: (pct: number) => void,
  options?: UploadOptions
): Promise<{ url: string; key: string }> => {
  try {
    return await uploadWithPresignedUrls(file, folder, fileName, onProgress, options);
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
  onProgress?: (pct: number) => void,
  options?: UploadOptions
): Promise<{ url: string; key: string }> => {
  const actualFileName = fileName || (file instanceof File ? file.name : "upload.bin");
  const contentType = file.type || "application/octet-stream";
  const monitor = createUploadMonitor(options?.onStatus);
  const releaseScreen = await keepScreenAwake();

  try {
    return file.size > MIN_PART_SIZE
      ? await uploadMultipart(file, folder, actualFileName, contentType, monitor, onProgress)
      : await uploadSingle(file, folder, actualFileName, contentType, monitor, onProgress);
  } finally {
    monitor.dispose();
    releaseScreen();
  }
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
      onProgress?: (pct: number) => void,
      options?: UploadOptions
    ): Promise<{ url: string; key: string }> => {
      setIsUploading(true);
      try {
        const result = await uploadFileToR2(file, folder, undefined, onProgress, options);
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return { uploadFile, isUploading };
}
