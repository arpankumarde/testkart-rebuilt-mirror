import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, FileText, RotateCcw, UploadCloud, Video, X } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Progress } from "./Progress";
import { Spinner } from "./Spinner";
import { uploadFileToR2 } from "../helpers/useR2Upload";
import { useUploadLimits } from "../helpers/useUploadLimits";
import { useAuth } from "../helpers/useAuth";
import { useTeacherAssetMutations } from "../helpers/useTeacherAssets";
import {
  LIBRARY_ACCEPT,
  MAX_LIBRARY_BATCH,
  assetKindForMime,
  formatAssetSize,
  libraryFolder,
  libraryMimeType,
  nameFromFileName,
  type TeacherAssetKindValue,
} from "../helpers/teacherAssetFiles";
import styles from "./TeacherAssetUpload.module.css";

const PARALLEL_UPLOADS = 2;

type Status = "ready" | "queued" | "uploading" | "saving" | "added" | "failed";

type Item = {
  id: number;
  file: File;
  kind: TeacherAssetKindValue;
  name: string;
  durationSeconds: number | null;
  status: Status;
  progress: number;
  error: string | null;
  key: string | null;
};

const ACTIVE: Status[] = ["queued", "uploading", "saving"];

const formatLimit = (megabytes: number) =>
  megabytes >= 1024 ? `${Number((megabytes / 1024).toFixed(1))} GB` : `${megabytes} MB`;

const pluralFiles = (count: number) => `${count} ${count === 1 ? "file" : "files"}`;

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : "");

// Transfer errors read like "Upload failed with status code 403"; limit and session messages pass through.
const uploadErrorMessage = (error: unknown) => {
  const message = errorMessage(error);
  return !message || /status code|with status|network error|part \d+/i.test(message)
    ? "The upload did not finish. Check your internet connection and retry."
    : message;
};

const readDurationSeconds = (file: File) =>
  new Promise<number | null>((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(seconds);
    };
    const timer = window.setTimeout(() => finish(null), 15000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      finish(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });

/*
 * Bulk upload into the teacher's asset library: up to 20 videos and PDFs per
 * batch, two uploading at a time. Each file is added to the library as soon as
 * its upload finishes, so a closed tab keeps everything finished so far.
 */
export const TeacherAssetUpload: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const limits = useUploadLimits();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const teacherId = user?.actingAsTeacherId ?? user?.id ?? 0;
  const { createAssetMutation } = useTeacherAssetMutations();
  const createAssetRef = useRef(createAssetMutation.mutateAsync);
  createAssetRef.current = createAssetMutation.mutateAsync;

  const [items, setItems] = useState<Item[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [showNameErrors, setShowNameErrors] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const nextIdRef = useRef(1);
  const activeUploadsRef = useRef(0);

  const commit = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const patch = (id: number, changes: Partial<Item>) =>
    commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const counts = {
    ready: items.filter((item) => item.status === "ready").length,
    queued: items.filter((item) => item.status === "queued").length,
    active: items.filter((item) => ACTIVE.includes(item.status)).length,
    added: items.filter((item) => item.status === "added").length,
    failed: items.filter((item) => item.status === "failed").length,
  };
  const isRunning = counts.active > 0;
  const hasStarted = counts.active + counts.added + counts.failed > 0;

  useEffect(() => {
    if (!isRunning) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  // Leaving the page lets running uploads finish and save, but starts no new ones.
  useEffect(
    () => () => {
      itemsRef.current = itemsRef.current.map((item) => (item.status === "queued" ? { ...item, status: "ready" } : item));
    },
    []
  );

  const register = async (item: Item, key: string) => {
    patch(item.id, { status: "saving", key, progress: 100 });
    try {
      await createAssetRef.current({
        key,
        name: item.name.trim(),
        mimeType: item.file.type,
        sizeBytes: item.file.size,
        durationSeconds: item.durationSeconds,
      });
      patch(item.id, { status: "added" });
    } catch (error) {
      patch(item.id, {
        status: "failed",
        error: errorMessage(error) || "The file uploaded, but it was not added to your library. Retry to add it.",
      });
    }
  };

  const startUpload = (item: Item) => {
    activeUploadsRef.current += 1;
    let lastPercent = -1;
    const run = item.key
      ? register(item, item.key)
      : (async () => {
          patch(item.id, { status: "uploading", progress: 0, error: null });
          try {
            const result = await uploadFileToR2(item.file, libraryFolder(teacherId), item.file.name, (percent) => {
              if (percent === lastPercent) return;
              lastPercent = percent;
              patch(item.id, { progress: percent });
            });
            await register(item, result.key);
          } catch (error) {
            patch(item.id, { status: "failed", error: uploadErrorMessage(error) });
          }
        })();
    void run.finally(() => {
      activeUploadsRef.current -= 1;
      pump();
    });
  };

  const pump = () => {
    while (activeUploadsRef.current < PARALLEL_UPLOADS) {
      const next = itemsRef.current.find((item) => item.status === "queued");
      if (!next) break;
      patch(next.id, { status: next.key ? "saving" : "uploading" });
      startUpload(next);
    }
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || isRunning) return;
    const seen = new Set(itemsRef.current.map((item) => `${item.file.name}:${item.file.size}`));
    const problems: string[] = [];
    const accepted: Array<{ file: File; kind: TeacherAssetKindValue }> = [];

    for (const file of Array.from(fileList)) {
      const type = libraryMimeType(file.name, file.type);
      const kind = assetKindForMime(type);
      const maxMb = kind === "pdf" ? limits.coursePdfMaxMb : limits.lessonVideoMaxMb;
      const signature = `${file.name}:${file.size}`;
      if (!type || !kind) {
        problems.push(`${file.name} is not an MP4, WebM or MOV video or a PDF.`);
      } else if (file.size > maxMb * 1024 * 1024) {
        problems.push(`${file.name} is larger than ${formatLimit(maxMb)}.`);
      } else if (seen.has(signature)) {
        problems.push(`${file.name} is already in the list.`);
      } else {
        seen.add(signature);
        // A file the browser left untyped gets its type from the extension, so the size limit still applies.
        accepted.push({
          file: type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified }),
          kind,
        });
      }
    }

    const room = Math.max(0, MAX_LIBRARY_BATCH - itemsRef.current.length);
    const kept = accepted.slice(0, room);
    if (accepted.length > kept.length) {
      problems.push(
        `You can upload ${MAX_LIBRARY_BATCH} files at a time, so ${pluralFiles(accepted.length - kept.length)} did not fit: ${accepted
          .slice(room)
          .map(({ file }) => file.name)
          .join(", ")}.`
      );
    }

    const newItems: Item[] = kept.map(({ file, kind }) => ({
      id: nextIdRef.current++,
      file,
      kind,
      name: nameFromFileName(file.name),
      durationSeconds: null,
      status: "ready",
      progress: 0,
      error: null,
      key: null,
    }));
    commit([...itemsRef.current, ...newItems]);
    setNotices(problems);

    newItems
      .filter((item) => item.kind === "video")
      .forEach((item) => {
        void readDurationSeconds(item.file).then((seconds) => {
          if (seconds !== null) patch(item.id, { durationSeconds: seconds });
        });
      });
  };

  const queue = (ids: number[] | null) => {
    const targets = itemsRef.current.filter((item) =>
      ids ? ids.includes(item.id) && item.status === "failed" : item.status === "ready"
    );
    if (targets.length === 0) return;
    if (targets.some((item) => !item.name.trim())) {
      setShowNameErrors(true);
      return;
    }
    setShowNameErrors(false);
    if (!ids) setNotices([]);
    const targetIds = new Set(targets.map((item) => item.id));
    commit(
      itemsRef.current.map((item) =>
        targetIds.has(item.id) ? { ...item, status: "queued", error: null, progress: item.key ? 100 : 0 } : item
      )
    );
    pump();
  };

  const stopQueued = () =>
    commit(itemsRef.current.map((item) => (item.status === "queued" ? { ...item, status: "ready" } : item)));

  const handleOpenChange = (next: boolean) => {
    if (!next && isRunning) return;
    onOpenChange(next);
    if (!next) {
      commit([]);
      setNotices([]);
      setShowNameErrors(false);
      setIsDragging(false);
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (isRunning) return;
    setIsDragging(event.type === "dragenter" || event.type === "dragover");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const canAddMore = !isRunning && items.length < MAX_LIBRARY_BATCH;
  const failedIds = items.filter((item) => item.status === "failed").map((item) => item.id);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          icon={<UploadCloud size={20} />}
          title="Upload to your library"
          hideClose={isRunning}
          description={`Videos and PDFs, up to ${MAX_LIBRARY_BATCH} at a time. You can add them to course lessons later.`}
        />
        <ConsoleDialogBody>
          {canAddMore && (
            <label
              className={`${styles.dropzone} ${isDragging ? styles.dragging : ""}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={LIBRARY_ACCEPT}
                multiple
                className={styles.fileInput}
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className={styles.dropzoneIcon} aria-hidden="true">
                <UploadCloud size={22} />
              </span>
              <span className={styles.dropzoneTitle}>
                {items.length === 0 ? "Choose files or drag them here" : "Add more files"}
              </span>
              <span className={styles.dropzoneHint}>
                MP4, WebM or MOV up to {formatLimit(limits.lessonVideoMaxMb)}, PDF up to {formatLimit(limits.coursePdfMaxMb)}.{" "}
                {items.length} of {MAX_LIBRARY_BATCH} chosen.
              </span>
            </label>
          )}

          {notices.length > 0 && (
            <div className={styles.notice} role="alert">
              <AlertCircle size={16} className={styles.noticeIcon} aria-hidden="true" />
              <ul className={styles.noticeList}>
                {notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
              <Button variant="ghost" size="icon-sm" className={styles.noticeDismiss} onClick={() => setNotices([])} aria-label="Dismiss">
                <X size={14} />
              </Button>
            </div>
          )}

          {hasStarted && (
            <p className={styles.summary} aria-live="polite">
              {counts.added} of {items.length} added
              {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
              {isRunning ? ` · ${pluralFiles(counts.active)} in progress` : ""}
            </p>
          )}

          {items.length > 0 && (
            <ul className={styles.list}>
              {items.map((item) => (
                <UploadRow
                  key={item.id}
                  item={item}
                  showNameError={showNameErrors && !item.name.trim()}
                  onNameChange={(name) => patch(item.id, { name })}
                  onRemove={() => commit(itemsRef.current.filter((entry) => entry.id !== item.id))}
                  onRetry={() => queue([item.id])}
                />
              ))}
            </ul>
          )}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          {isRunning ? (
            <>
              <p className={styles.footerNote}>Keep this page open until the uploads finish.</p>
              <Button variant="outline" onClick={stopQueued} disabled={counts.queued === 0}>
                Stop after current uploads
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={counts.ready === 0 && counts.failed === 0 && counts.added > 0 ? "primary" : "outline"}
                onClick={() => handleOpenChange(false)}
              >
                {counts.added > 0 && counts.ready === 0 ? "Done" : "Cancel"}
              </Button>
              {counts.failed > 0 && (
                <Button variant={counts.ready === 0 ? "primary" : "outline"} onClick={() => queue(failedIds)}>
                  <RotateCcw size={14} /> Retry failed ({counts.failed})
                </Button>
              )}
              {(counts.ready > 0 || (counts.added === 0 && counts.failed === 0)) && (
                <Button onClick={() => queue(null)} disabled={counts.ready === 0}>
                  <UploadCloud size={16} />
                  {counts.ready > 0 ? `Upload ${pluralFiles(counts.ready)}` : "Upload files"}
                </Button>
              )}
            </>
          )}
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const UploadRow: React.FC<{
  item: Item;
  showNameError: boolean;
  onNameChange: (name: string) => void;
  onRemove: () => void;
  onRetry: () => void;
}> = ({ item, showNameError, onNameChange, onRemove, onRetry }) => {
  const nameId = `library-upload-name-${item.id}`;
  const errorId = `${nameId}-error`;
  const canEdit = item.status === "ready" || item.status === "failed";

  return (
    <li className={styles.row}>
      <span className={`${styles.kindIcon} ${item.kind === "pdf" ? styles.kindPdf : ""}`} aria-hidden="true">
        {item.kind === "pdf" ? <FileText size={16} /> : <Video size={16} />}
      </span>
      <div className={styles.rowMain}>
        <Input
          id={nameId}
          value={item.name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={!canEdit}
          maxLength={200}
          aria-label={`Name for ${item.file.name}`}
          aria-invalid={showNameError || undefined}
          aria-describedby={showNameError ? errorId : undefined}
        />
        {showNameError && (
          <span id={errorId} className={styles.fieldError}>
            Enter a name.
          </span>
        )}
        <span className={styles.meta}>
          <span className={styles.fileName} title={item.file.name}>
            {item.file.name}
          </span>
          <span>{formatAssetSize(item.file.size)}</span>
        </span>
        <UploadStatus item={item} onRetry={onRetry} />
      </div>
      <div className={styles.rowAction}>
        {canEdit && !item.key && (
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
            <X size={16} />
          </Button>
        )}
      </div>
    </li>
  );
};

const UploadStatus: React.FC<{ item: Item; onRetry: () => void }> = ({ item, onRetry }) => {
  switch (item.status) {
    case "queued":
      return <span className={styles.status}>Waiting to upload</span>;
    case "uploading":
      return (
        <span className={styles.progressRow}>
          <Progress value={item.progress} className={styles.progressBar} aria-label={`Uploading ${item.file.name}`} />
          <span className={styles.progressLabel}>{item.progress}%</span>
        </span>
      );
    case "saving":
      return (
        <span className={styles.status}>
          <Spinner size="sm" /> Adding to library
        </span>
      );
    case "added":
      return (
        <span className={`${styles.status} ${styles.statusSuccess}`}>
          <Check size={14} aria-hidden="true" /> Added to library
        </span>
      );
    case "failed":
      return (
        <span className={`${styles.status} ${styles.statusError}`}>
          <AlertCircle size={14} aria-hidden="true" className={styles.statusIcon} />
          <span className={styles.statusText}>{item.error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw size={14} /> Retry
          </Button>
        </span>
      );
    default:
      return null;
  }
};