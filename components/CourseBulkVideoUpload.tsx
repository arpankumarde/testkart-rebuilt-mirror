import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, RotateCcw, UploadCloud, X } from 'lucide-react';
import { Dialog, DialogTrigger } from './Dialog';
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from './ConsoleDialog';
import { Button } from './Button';
import { Input } from './Input';
import { Progress } from './Progress';
import { Spinner } from './Spinner';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { useUploadLimits } from '../helpers/useUploadLimits';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import styles from './CourseBulkVideoUpload.module.css';

export const MAX_BULK_VIDEOS = 10;
const PARALLEL_UPLOADS = 2;

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};
const ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov';

type Status = 'ready' | 'queued' | 'uploading' | 'uploaded' | 'saving' | 'added' | 'failed';

type Item = {
  id: number;
  file: File;
  title: string;
  durationMinutes: number | null;
  status: Status;
  progress: number;
  error: string | null;
  url: string | null;
  fileKey: string | null;
};

const ACTIVE: Status[] = ['queued', 'uploading', 'uploaded', 'saving'];
const TITLE_LOCKED: Status[] = ['saving', 'added'];

const videoMimeType = (file: File): string | null => {
  if (Object.values(VIDEO_TYPES).includes(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_TYPES[extension] ?? null;
};

// "Lecture 1 - Basics.mp4" keeps its hyphen; slug-style "lecture_1-basics.mp4" gets spaces.
const titleFromFileName = (name: string) => {
  const base = name.replace(/\.[^.]+$/, '');
  const spaced = /\s/.test(base) ? base.replace(/_+/g, ' ') : base.replace(/[_-]+/g, ' ');
  return spaced.replace(/\s+/g, ' ').trim() || 'Untitled video';
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;

const formatLimit = (megabytes: number) =>
  megabytes >= 1024 ? `${Number((megabytes / 1024).toFixed(1))} GB` : `${megabytes} MB`;

const pluralVideos = (count: number) => `${count} ${count === 1 ? 'video' : 'videos'}`;

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// Transfer errors read like "Upload failed with status code 403"; limit and session messages pass through.
const uploadErrorMessage = (error: unknown) => {
  const message = errorMessage(error, '');
  return !message || /status code|with status|network error|part \d+/i.test(message)
    ? 'The upload did not finish. Check your internet connection and retry.'
    : message;
};

const saveErrorMessage = (error: unknown) => {
  const message = errorMessage(error, '');
  return !message || message === 'Failed to create lesson'
    ? 'The video uploaded, but its lesson was not saved. Retry to save it.'
    : message;
};

const readDurationMinutes = (file: File) =>
  new Promise<number | null>((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (minutes: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(minutes);
    };
    const timer = window.setTimeout(() => finish(null), 15000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      finish(Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });

type CourseBulkVideoUploadProps = {
  courseId: number;
  sectionId: number;
  sectionTitle: string;
};

/*
 * Uploads up to 10 videos into one course section, each as its own video lesson.
 * Lessons are saved in list order as their uploads finish, so a closed tab keeps
 * every lesson saved so far. A failed video is skipped; retrying it adds it at the
 * end of the section.
 */
export const CourseBulkVideoUpload: React.FC<CourseBulkVideoUploadProps> = ({ courseId, sectionId, sectionTitle }) => {
  const limits = useUploadLimits();
  const { createLessonMutation } = useTeacherCourseMutations();
  const createLessonRef = useRef(createLessonMutation.mutateAsync);
  createLessonRef.current = createLessonMutation.mutateAsync;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [showTitleErrors, setShowTitleErrors] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const nextIdRef = useRef(1);
  const activeUploadsRef = useRef(0);
  const savingRef = useRef(false);

  const commit = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const patch = (id: number, changes: Partial<Item>) =>
    commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const counts = {
    ready: items.filter((item) => item.status === 'ready').length,
    queued: items.filter((item) => item.status === 'queued').length,
    active: items.filter((item) => ACTIVE.includes(item.status)).length,
    added: items.filter((item) => item.status === 'added').length,
    failed: items.filter((item) => item.status === 'failed').length,
  };
  const isRunning = counts.active > 0;
  const hasStarted = counts.active + counts.added + counts.failed > 0;

  useEffect(() => {
    if (!isRunning) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning]);

  // Leaving the page lets running uploads finish and save, but starts no new ones.
  useEffect(
    () => () => {
      itemsRef.current = itemsRef.current.map((item) =>
        item.status === 'queued' ? { ...item, status: 'ready' } : item
      );
    },
    []
  );

  const saveInOrder = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((item) => ACTIVE.includes(item.status));
        if (!next || next.status !== 'uploaded' || !next.url) break;
        patch(next.id, { status: 'saving' });
        try {
          await createLessonRef.current({
            sectionId,
            title: next.title.trim(),
            contentType: 'video',
            contentUrl: next.url,
            contentFileId: next.fileKey,
            durationMinutes: next.durationMinutes,
            isPreview: false,
          });
          patch(next.id, { status: 'added' });
        } catch (error) {
          patch(next.id, { status: 'failed', error: saveErrorMessage(error) });
        }
      }
    } finally {
      savingRef.current = false;
    }
  };

  const startUpload = (item: Item) => {
    activeUploadsRef.current += 1;
    patch(item.id, { status: 'uploading', progress: 0, error: null });
    let lastPercent = -1;
    uploadFileToR2(item.file, `course/${courseId}`, item.file.name, (percent) => {
      if (percent === lastPercent) return;
      lastPercent = percent;
      patch(item.id, { progress: percent });
    })
      .then((result) => patch(item.id, { status: 'uploaded', progress: 100, url: result.url, fileKey: result.key }))
      .catch((error) => patch(item.id, { status: 'failed', error: uploadErrorMessage(error) }))
      .finally(() => {
        activeUploadsRef.current -= 1;
        pump();
      });
  };

  const pump = () => {
    for (;;) {
      const next = itemsRef.current.find((item) => item.status === 'queued');
      if (!next) break;
      if (next.url) {
        patch(next.id, { status: 'uploaded' });
        continue;
      }
      if (activeUploadsRef.current >= PARALLEL_UPLOADS) break;
      startUpload(next);
    }
    void saveInOrder();
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || isRunning) return;
    const maxBytes = limits.lessonVideoMaxMb * 1024 * 1024;
    const seen = new Set(itemsRef.current.map((item) => `${item.file.name}:${item.file.size}`));
    const problems: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(fileList)) {
      const type = videoMimeType(file);
      const key = `${file.name}:${file.size}`;
      if (!type) {
        problems.push(`${file.name} is not an MP4, WebM or MOV video.`);
      } else if (file.size > maxBytes) {
        problems.push(`${file.name} is larger than ${formatLimit(limits.lessonVideoMaxMb)}.`);
      } else if (seen.has(key)) {
        problems.push(`${file.name} is already in the list.`);
      } else {
        seen.add(key);
        // A file the browser left untyped gets its type from the extension, so the size limit still applies.
        accepted.push(type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified }));
      }
    }

    accepted.sort((a, b) =>
      titleFromFileName(a.name).localeCompare(titleFromFileName(b.name), undefined, { numeric: true, sensitivity: 'base' })
    );
    const room = Math.max(0, MAX_BULK_VIDEOS - itemsRef.current.length);
    const kept = accepted.slice(0, room);
    if (accepted.length > kept.length) {
      problems.push(
        `You can upload ${MAX_BULK_VIDEOS} videos at a time, so ${pluralVideos(accepted.length - kept.length)} did not fit: ${accepted
          .slice(room)
          .map((file) => file.name)
          .join(', ')}.`
      );
    }

    const newItems: Item[] = kept.map((file) => ({
      id: nextIdRef.current++,
      file,
      title: titleFromFileName(file.name),
      durationMinutes: null,
      status: 'ready',
      progress: 0,
      error: null,
      url: null,
      fileKey: null,
    }));
    commit([...itemsRef.current, ...newItems]);
    setNotices(problems);

    newItems.forEach((item) => {
      void readDurationMinutes(item.file).then((minutes) => {
        if (minutes !== null) patch(item.id, { durationMinutes: minutes });
      });
    });
  };

  const startUploads = () => {
    const ready = itemsRef.current.filter((item) => item.status === 'ready');
    if (ready.length === 0) return;
    if (ready.some((item) => !item.title.trim())) {
      setShowTitleErrors(true);
      return;
    }
    setShowTitleErrors(false);
    setNotices([]);
    commit(itemsRef.current.map((item) => (item.status === 'ready' ? { ...item, status: 'queued', error: null } : item)));
    pump();
  };

  const stopQueued = () =>
    commit(itemsRef.current.map((item) => (item.status === 'queued' ? { ...item, status: 'ready' } : item)));

  const retry = (ids: number[]) => {
    if (itemsRef.current.some((item) => ids.includes(item.id) && !item.title.trim())) {
      setShowTitleErrors(true);
      return;
    }
    commit(
      itemsRef.current.map((item) =>
        ids.includes(item.id) && item.status === 'failed' ? { ...item, status: 'queued', error: null, progress: 0 } : item
      )
    );
    pump();
  };

  const removeItem = (id: number) => commit(itemsRef.current.filter((item) => item.id !== id));

  const handleOpenChange = (next: boolean) => {
    if (!next && isRunning) return;
    setOpen(next);
    if (!next) {
      commit([]);
      setNotices([]);
      setShowTitleErrors(false);
      setIsDragging(false);
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (isRunning) return;
    setIsDragging(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const canAddMore = !isRunning && items.length < MAX_BULK_VIDEOS;
  const failedIds = items.filter((item) => item.status === 'failed').map((item) => item.id);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UploadCloud size={14} /> Upload videos
        </Button>
      </DialogTrigger>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          icon={<UploadCloud size={20} />}
          title="Upload videos"
          hideClose={isRunning}
          description={
            <>
              Each video becomes a lesson in <strong>{sectionTitle}</strong>, in the order shown. Up to{' '}
              {MAX_BULK_VIDEOS} at a time.
            </>
          }
        />
        <ConsoleDialogBody>
          {canAddMore && (
            <label
              className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className={styles.fileInput}
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <span className={styles.dropzoneIcon} aria-hidden="true">
                <UploadCloud size={22} />
              </span>
              <span className={styles.dropzoneTitle}>
                {items.length === 0 ? 'Choose videos or drag them here' : 'Add more videos'}
              </span>
              <span className={styles.dropzoneHint}>
                MP4, WebM or MOV, up to {formatLimit(limits.lessonVideoMaxMb)} each. {items.length} of {MAX_BULK_VIDEOS}{' '}
                chosen.
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
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.noticeDismiss}
                onClick={() => setNotices([])}
                aria-label="Dismiss"
              >
                <X size={14} />
              </Button>
            </div>
          )}

          {hasStarted && (
            <p className={styles.summary} aria-live="polite">
              {counts.added} of {items.length} added
              {counts.failed > 0 ? ` · ${counts.failed} failed` : ''}
              {isRunning ? ` · ${pluralVideos(counts.active)} in progress` : ''}
            </p>
          )}

          {items.length > 0 && (
            <ol className={styles.list}>
              {items.map((item, index) => (
                <BulkVideoRow
                  key={item.id}
                  item={item}
                  position={index + 1}
                  showTitleError={showTitleErrors && !item.title.trim()}
                  onTitleChange={(title) => patch(item.id, { title })}
                  onRemove={() => removeItem(item.id)}
                  onRetry={() => retry([item.id])}
                />
              ))}
            </ol>
          )}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          {isRunning ? (
            <>
              <p className={styles.footerNote}>
                Keep this page open until the uploads finish. Each video is saved as a lesson, in order, as soon as it
                and the videos above it are done.
              </p>
              <Button variant="outline" onClick={stopQueued} disabled={counts.queued === 0}>
                Stop after current uploads
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={counts.ready === 0 && counts.failed === 0 && counts.added > 0 ? 'primary' : 'outline'}
                onClick={() => handleOpenChange(false)}
              >
                {counts.added > 0 && counts.ready === 0 ? 'Done' : 'Cancel'}
              </Button>
              {counts.failed > 0 && (
                <Button variant={counts.ready === 0 ? 'primary' : 'outline'} onClick={() => retry(failedIds)}>
                  <RotateCcw size={14} /> Retry failed ({counts.failed})
                </Button>
              )}
              {(counts.ready > 0 || (counts.added === 0 && counts.failed === 0)) && (
                <Button onClick={startUploads} disabled={counts.ready === 0}>
                  <UploadCloud size={16} />
                  {counts.ready > 0 ? `Upload ${pluralVideos(counts.ready)}` : 'Upload videos'}
                </Button>
              )}
            </>
          )}
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const BulkVideoRow: React.FC<{
  item: Item;
  position: number;
  showTitleError: boolean;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
  onRetry: () => void;
}> = ({ item, position, showTitleError, onTitleChange, onRemove, onRetry }) => {
  const titleId = `bulk-video-title-${item.id}`;
  const errorId = `${titleId}-error`;
  const canRemove = item.status === 'ready' || item.status === 'failed';

  return (
    <li className={styles.row}>
      <span className={styles.position} aria-hidden="true">
        {position}
      </span>
      <div className={styles.rowMain}>
        <Input
          id={titleId}
          value={item.title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={TITLE_LOCKED.includes(item.status)}
          aria-label={`Lesson title for ${item.file.name}`}
          aria-invalid={showTitleError || undefined}
          aria-describedby={showTitleError ? errorId : undefined}
        />
        {showTitleError && (
          <span id={errorId} className={styles.fieldError}>
            Enter a lesson title.
          </span>
        )}
        <span className={styles.meta}>
          <span className={styles.fileName} title={item.file.name}>
            {item.file.name}
          </span>
          <span>
            {formatBytes(item.file.size)}
            {item.durationMinutes !== null ? ` · ${item.durationMinutes} min` : ''}
          </span>
        </span>
        <BulkVideoStatus item={item} onRetry={onRetry} />
      </div>
      <div className={styles.rowAction}>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove ${item.file.name}`}
          >
            <X size={16} />
          </Button>
        )}
      </div>
    </li>
  );
};

const BulkVideoStatus: React.FC<{ item: Item; onRetry: () => void }> = ({ item, onRetry }) => {
  switch (item.status) {
    case 'queued':
      return <span className={styles.status}>Waiting to upload</span>;
    case 'uploading':
      return (
        <span className={styles.progressRow}>
          <Progress value={item.progress} className={styles.progressBar} aria-label={`Uploading ${item.file.name}`} />
          <span className={styles.progressLabel}>{item.progress}%</span>
        </span>
      );
    case 'uploaded':
      return <span className={styles.status}>Uploaded, waiting for the videos above</span>;
    case 'saving':
      return (
        <span className={styles.status}>
          <Spinner size="sm" /> Saving lesson
        </span>
      );
    case 'added':
      return (
        <span className={`${styles.status} ${styles.statusSuccess}`}>
          <Check size={14} aria-hidden="true" /> Added as a lesson
        </span>
      );
    case 'failed':
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
