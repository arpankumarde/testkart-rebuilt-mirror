import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, X, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { uploadFileToR2, deleteR2File } from '../helpers/useR2Upload';
import { Spinner } from './Spinner';
import { Button } from './Button';
import styles from './ImageUploader.module.css';

export interface ImageUploaderProps {
  folder: string;
  onSuccess: (result: { url: string; fileId: string }) => void;
  onError?: (error: Error) => void;
  onUploadStart?: () => void;
  currentImageUrl?: string;
  currentFileId?: string;
  acceptedTypes?: string;
  maxSizeInMB?: number;
  aspectRatio?: string;
  label?: string;
  className?: string;
  /* "overlay" floats a remove X on the image; "toolbar" puts labelled Replace and Remove buttons under it. */
  actions?: 'overlay' | 'toolbar';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  folder,
  onSuccess,
  onError,
  onUploadStart,
  currentImageUrl,
  currentFileId,
  acceptedTypes = 'image/jpeg,image/png,image/webp,image/gif',
  maxSizeInMB = 5,
  aspectRatio = '16 / 9',
  label = 'Upload Image',
  className,
  actions = 'overlay',
}) => {
  const toolbarMode = actions === 'toolbar';
  const uploadRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setError(null);

    if (file.size > maxSizeInMB * 1024 * 1024) {
      const errorMessage = `File size cannot exceed ${maxSizeInMB}MB.`;
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      return;
    }

    if (currentFileId) {
      try {
        await deleteR2File(currentFileId);
      } catch (deleteError) {
        console.error(`Failed to delete old R2 file: ${currentFileId}`, deleteError);
      }
    }

    onUploadStart?.();
    setIsUploading(true);
    setUploadProgress(0);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const result = await uploadFileToR2(file, folder, file.name, (pct) => setUploadProgress(pct));
      setIsUploading(false);
      setUploadProgress(100);
      onSuccess({ url: result.url, fileId: result.key });
      setPreviewUrl(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setIsUploading(false);
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      setPreviewUrl(null);
    }
  }, [maxSizeInMB, currentFileId, folder, onUploadStart, onSuccess, onError]);

  const handleUploadChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (evt.target) evt.target.value = '';
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSuccess({ url: '', fileId: '' });
  };

  const triggerFileInput = () => {
    if (!isUploading) {
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

  const effectiveImageUrl = previewUrl || currentImageUrl;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileInput();
    }
  };

  const dropZone = (
    <div
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${toolbarMode && effectiveImageUrl ? styles.framed : ''} ${className ?? ''}`}
      style={{ aspectRatio }}
      role={toolbarMode ? 'button' : undefined}
      tabIndex={toolbarMode ? 0 : undefined}
      aria-label={toolbarMode ? (effectiveImageUrl ? 'Replace image' : label) : undefined}
      onKeyDown={toolbarMode ? handleKeyDown : undefined}
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
        disabled={isUploading}
      />

      {effectiveImageUrl ? (
        <div className={styles.previewContainer}>
          <img
            src={effectiveImageUrl}
            alt="Preview"
            className={styles.previewImage}
          />
          {!toolbarMode && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={handleRemoveImage}
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <UploadCloud size={32} className={styles.placeholderIcon} />
          <p className={styles.placeholderText}>{label}</p>
          <p className={styles.placeholderSubtext}>
            Drag & drop or click to upload
          </p>
        </div>
      )}

      {isUploading && (
        <div className={styles.overlay}>
          <div className={styles.progressContainer}>
            <Spinner size="md" />
            <p>Uploading... {uploadProgress}%</p>
          </div>
        </div>
      )}

      {!isUploading && error && (
        <div className={`${styles.overlay} ${styles.errorOverlay}`}>
          <AlertCircle size={24} className={styles.errorIcon} />
          <p className={styles.errorMessage}>{error}</p>
        </div>
      )}

      {!toolbarMode && !effectiveImageUrl && !isUploading && !error && (
        <div className={styles.initialOverlay}>
          <ImageIcon size={24} />
          <span>{label}</span>
        </div>
      )}
    </div>
  );

  if (!toolbarMode) return dropZone;

  return (
    <div className={styles.stack}>
      {dropZone}
      {effectiveImageUrl && !isUploading && (
        <div className={styles.toolbar}>
          <Button type="button" variant="outline" size="sm" onClick={triggerFileInput}>
            <RefreshCw aria-hidden="true" /> Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" className={styles.toolbarRemove} onClick={handleRemoveImage}>
            <Trash2 aria-hidden="true" /> Remove
          </Button>
        </div>
      )}
    </div>
  );
};