import React, { useState, useRef, useCallback, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { UploadCloud, Image as ImageIcon, X, AlertCircle, FileType } from 'lucide-react';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { Spinner } from './Spinner';
import { ImageCropDialog } from './ImageCropDialog';
import styles from './R2FileUploader.module.css';

export interface R2FileUploaderProps {
  folder: string;
  onSuccess: (result: { filePath: string; fileId: string; url: string }) => void;
  onError?: (error: Error) => void;
  onUploadStart?: () => void;
  /** Fires true when an upload starts and false when it ends or the uploader unmounts. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Called by the remove button. Without it the legacy onSuccess with empty strings is emitted. */
  onRemove?: () => void;
  currentImageUrl?: string;
  /** No longer read: the saved file is never deleted before a replacement is saved. */
  currentFileId?: string;
  acceptedTypes?: string;
  maxSizeInMB?: number;
  aspectRatio?: string;
  label?: string;
  className?: string;
  enableCrop?: boolean;
  cropAspect?: number;
  cropShape?: 'rect' | 'round';
}

export const R2FileUploader: React.FC<R2FileUploaderProps> = ({
  folder,
  onSuccess,
  onError,
  onUploadStart,
  onUploadingChange,
  onRemove,
  currentImageUrl,
  acceptedTypes = 'image/*',
  maxSizeInMB = 5,
  aspectRatio,
  label = 'Upload Image',
  className,
  enableCrop = false,
  cropAspect = 1,
  cropShape = 'round',
}) => {
  const customUploadRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState(() => `${nanoid(16)}.jpg`);
  const [isPdfBlob, setIsPdfBlob] = useState(false);
  const uploadInFlightRef = useRef(false);

  const onUploadingChangeRef = useRef(onUploadingChange);
  onUploadingChangeRef.current = onUploadingChange;
  const reportedUploadingRef = useRef(false);

  useEffect(() => {
    if (reportedUploadingRef.current === isUploading) return;
    reportedUploadingRef.current = isUploading;
    onUploadingChangeRef.current?.(isUploading);
  }, [isUploading]);

  useEffect(() => () => {
    if (reportedUploadingRef.current) onUploadingChangeRef.current?.(false);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (acceptedTypes && acceptedTypes !== '*') {
      const types = acceptedTypes.split(',').map((t) => t.trim().toLowerCase());
      const fileType = file.type.toLowerCase();
      const fileNameLower = file.name.toLowerCase();

      const isValidType = types.some((type) => {
        if (type.endsWith('/*')) {
          const base = type.split('/')[0];
          return fileType.startsWith(`${base}/`);
        }
        if (type.startsWith('.')) {
          return fileNameLower.endsWith(type);
        }
        return fileType === type;
      });

      if (!isValidType) {
        return `Invalid file type. Allowed types: ${acceptedTypes}`;
      }
    }

    if (file.size > maxSizeInMB * 1024 * 1024) {
      return `File size cannot exceed ${maxSizeInMB}MB.`;
    }

    return null;
  }, [acceptedTypes, maxSizeInMB]);

  const processSelectedFileForCrop = useCallback((file: File) => {
    setError(null);
    setIsPdfBlob(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (onError) onError(new Error(validationError));
      return;
    }

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    setCropFileName(`${nanoid(16)}${ext}`);
    setCropImageSrc(URL.createObjectURL(file));
    setCropDialogOpen(true);
  }, [validateFile, onError]);

  // The saved file is never deleted before or during a replacement: a failed or
  // abandoned upload must leave the saved record pointing at a file that still exists.
  const uploadBlob = useCallback(async (blob: Blob, fileName: string) => {
    if (uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    onUploadStart?.();
    setIsUploading(true);
    setUploadProgress(0);
    const objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);

    try {
      const result = await uploadFileToR2(blob, folder, fileName, (pct) => setUploadProgress(pct));
      setIsUploading(false);
      setUploadProgress(100);
      onSuccess({ filePath: result.key, fileId: result.key, url: result.url });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setIsUploading(false);
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
    } finally {
      uploadInFlightRef.current = false;
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }
  }, [folder, onUploadStart, onSuccess, onError]);

  const processSelectedFileForUpload = useCallback(async (file: File) => {
    if (uploadInFlightRef.current) return;
    setError(null);
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const generatedFileName = `${nanoid(16)}${ext}`;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (onError) onError(new Error(validationError));
      if (customUploadRef.current) customUploadRef.current.value = '';
      return;
    }

    setIsPdfBlob(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    await uploadBlob(file, generatedFileName);
  }, [validateFile, onError, uploadBlob]);

  const handleCustomUploadChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (evt.target) {
      evt.target.value = '';
    }
    if (!file) return;
    
    if (enableCrop) {
      processSelectedFileForCrop(file);
    } else {
      processSelectedFileForUpload(file);
    }
  };

  const handleCropConfirm = async (croppedBlob: Blob) => {
    setCropDialogOpen(false);
    await uploadBlob(croppedBlob, cropFileName);
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    } else {
      onSuccess({ filePath: '', fileId: '', url: '' });
    }
  };

  const triggerFileInput = () => {
    if (!isUploading) {
      customUploadRef.current?.click();
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
    if (!file) return;

    if (enableCrop) {
      processSelectedFileForCrop(file);
    } else {
      processSelectedFileForUpload(file);
    }
  }, [enableCrop, processSelectedFileForCrop, processSelectedFileForUpload]);

  const effectiveImageUrl = previewUrl || currentImageUrl;

  const isPdfFile = 
    acceptedTypes?.includes('application/pdf') || 
    isPdfBlob ||
    (effectiveImageUrl && effectiveImageUrl.toLowerCase().split('?')[0].endsWith('.pdf'));

  useEffect(() => {
    setImageError(false);
  }, [effectiveImageUrl]);

  const showPreview = !!effectiveImageUrl && (!imageError || isPdfFile);

  return (
    <>
      <div
        className={`${styles.container} ${isDragging ? styles.dragging : ''} ${className ?? ''}`}
        style={{ aspectRatio }}
        onClick={triggerFileInput}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={customUploadRef}
          onChange={handleCustomUploadChange}
          accept={acceptedTypes}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        {showPreview ? (
          <div className={isPdfFile ? styles.pdfPreviewContainer : styles.previewContainer}>
            {isPdfFile ? (
              <>
                <FileType size={48} className={styles.pdfIcon} />
                <span className={styles.pdfUploadedText}>PDF Uploaded</span>
                <span className={styles.pdfFileName}>
                  {effectiveImageUrl && !effectiveImageUrl.startsWith('blob:') 
                    ? effectiveImageUrl.split('?')[0].split('/').pop() 
                    : 'Document.pdf'}
                </span>
              </>
            ) : (
              <img
                src={effectiveImageUrl}
                alt="Current"
                className={styles.previewImage}
                onError={() => setImageError(true)}
              />
            )}
            <button
              type="button"
              className={styles.removeButton}
              onClick={handleRemoveImage}
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
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
              {uploadProgress > 0 && <p>{uploadProgress}%</p>}
            </div>
          </div>
        )}

        {!isUploading && error && (
          <div className={`${styles.overlay} ${styles.errorOverlay}`}>
            <AlertCircle size={24} className={styles.errorIcon} />
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}

        {!showPreview && !isUploading && !error && (
          <div className={styles.initialOverlay}>
            <ImageIcon size={24} />
            <span>{label}</span>
          </div>
        )}
      </div>

      {enableCrop && cropImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            setCropImageSrc(null);
          }}
          imageSrc={cropImageSrc}
          onCropConfirm={handleCropConfirm}
          aspect={cropAspect}
          cropShape={cropShape}
        />
      )}
    </>
  );
};