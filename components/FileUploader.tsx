import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, X, AlertCircle, CheckCircle, RotateCw } from 'lucide-react';
import { uploadFileToR2, UploadInterruptedError, type UploadStatus } from '../helpers/useR2Upload';
import { Button } from './Button';
import { Spinner } from './Spinner';
import styles from './FileUploader.module.css';

export interface FileUploaderProps {
  folder: string;
  onSuccess: (result: { url: string; fileId: string; size: number; name: string }) => void;
  onError?: (error: Error) => void;
  onUploadStart?: () => void;
  currentFileUrl?: string;
  // Kept for callers; the uploader never deletes the saved file. A replacement
  // is only an upload until the form is saved, and a saved file stays live.
  currentFileId?: string;
  acceptedTypes?: string; // e.g. "application/pdf"
  maxSizeInMB?: number;
  /** Runs after the type and size checks. Returns an error to show, or the file to upload in its place. */
  validateFile?: (file: File) => Promise<{ error: string } | { file: File }>;
  label?: string;
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  folder,
  onSuccess,
  onError,
  onUploadStart,
  currentFileUrl,
  acceptedTypes = 'application/pdf',
  maxSizeInMB = 40,
  validateFile,
  label = 'Upload File',
  className,
}) => {
  const uploadRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('uploading');
  // The checked file whose upload stopped on a dropped connection; Resume sends it again.
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const uploadChecked = useCallback(async (fileToUpload: File) => {
    setError(null);
    setResumeFile(null);
    onUploadStart?.();
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setFileName(fileToUpload.name);

    try {
      const result = await uploadFileToR2(fileToUpload, folder, fileToUpload.name, (pct) => setUploadProgress(pct), {
        onStatus: setUploadStatus,
      });
      setIsUploading(false);
      setUploadProgress(100);
      onSuccess({ url: result.url, fileId: result.key, size: fileToUpload.size, name: fileToUpload.name });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setIsUploading(false);
      setError(errorMessage);
      if (err instanceof UploadInterruptedError) setResumeFile(fileToUpload);
      if (onError) onError(new Error(errorMessage));
      setFileName(null);
    }
  }, [folder, onUploadStart, onSuccess, onError]);

  const processFile = useCallback(async (file: File) => {
    if (busyRef.current) return;
    setError(null);

    // Validate file type
    if (acceptedTypes) {
      const types = acceptedTypes.split(',').map((t) => t.trim().toLowerCase());
      const fileType = file.type.toLowerCase();
      const isTypeValid = types.some((t) => {
        if (t.endsWith('/*')) return fileType.startsWith(t.replace('/*', '/'));
        return fileType === t;
      });
      if (!isTypeValid) {
        const errorMessage = `Invalid file type. Only PDF files are allowed.`;
        setError(errorMessage);
        if (onError) onError(new Error(errorMessage));
        return;
      }
    }

    if (file.size > maxSizeInMB * 1024 * 1024) {
      const errorMessage = `File size cannot exceed ${maxSizeInMB}MB.`;
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      return;
    }

    busyRef.current = true;
    setResumeFile(null);
    try {
      let fileToUpload = file;
      if (validateFile) {
        setIsChecking(true);
        const checked = await validateFile(file).catch(() => ({
          error: 'This file could not be checked. Please try again.',
        }));
        setIsChecking(false);
        if ('error' in checked) {
          setError(checked.error);
          if (onError) onError(new Error(checked.error));
          return;
        }
        fileToUpload = checked.file;
      }

      await uploadChecked(fileToUpload);
    } finally {
      busyRef.current = false;
    }
  }, [acceptedTypes, maxSizeInMB, validateFile, uploadChecked, onError]);

  const handleResume = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!resumeFile || busyRef.current) return;
    busyRef.current = true;
    uploadChecked(resumeFile).finally(() => {
      busyRef.current = false;
    });
  };

  const handleUploadChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (evt.target) evt.target.value = '';
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSuccess({ url: '', fileId: '', size: 0, name: '' });
    setFileName(null);
  };

  const triggerFileInput = () => {
    if (!isUploading && !isChecking) {
      uploadRef.current?.click();
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const hasFile = !!currentFileUrl;

  return (
    <div
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${hasFile ? styles.hasFile : ''} ${className ?? ''}`}
      onClick={triggerFileInput}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={uploadRef}
        onChange={handleUploadChange}
        accept={acceptedTypes}
        style={{ display: 'none' }}
        disabled={isUploading || isChecking}
      />

      {hasFile ? (
        <div className={styles.filePreview}>
          <div className={styles.fileIcon}>
            <FileText size={32} />
          </div>
          <div className={styles.fileInfo}>
            <p className={styles.fileName}>{fileName || 'Uploaded File'}</p>
            <p className={styles.fileUrl} title={currentFileUrl}>{currentFileUrl?.split('/').pop()}</p>
          </div>
          <button
            type="button"
            className={styles.removeButton}
            onClick={handleRemoveFile}
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
          <div className={styles.successBadge}>
            <CheckCircle size={16} />
          </div>
        </div>
      ) : (
        <div className={styles.placeholder}>
          <UploadCloud size={32} className={styles.placeholderIcon} />
          <p className={styles.placeholderText}>{label}</p>
          <p className={styles.placeholderSubtext}>
            Drag & drop or click to upload PDF
          </p>
        </div>
      )}

      {(isChecking || isUploading) && (
        <div className={styles.overlay}>
          <div className={styles.progressContainer}>
            <Spinner size="md" />
            <p>
              {isChecking
                ? 'Checking file...'
                : uploadStatus === 'offline'
                  ? `Waiting for internet... ${uploadProgress}%`
                  : uploadStatus === 'reconnecting'
                    ? `Connection lost, retrying... ${uploadProgress}%`
                    : `Uploading... ${uploadProgress}%`}
            </p>
            {!isChecking && uploadStatus !== 'uploading' && (
              <p className={styles.progressHint}>Keep this page open. The upload continues on its own.</p>
            )}
          </div>
        </div>
      )}

      {!isUploading && !isChecking && error && (
        <div className={`${styles.overlay} ${styles.errorOverlay}`}>
          <AlertCircle size={24} className={styles.errorIcon} />
          <p className={styles.errorMessage}>
            {resumeFile ? 'The upload stopped because the connection dropped.' : error}
          </p>
          {resumeFile && (
            <Button type="button" size="sm" onClick={handleResume}>
              <RotateCw size={16} />
              Resume upload
            </Button>
          )}
        </div>
      )}
    </div>
  );
};