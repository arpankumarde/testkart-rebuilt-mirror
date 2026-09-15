import React from 'react';
import { R2FileUploader } from './R2FileUploader';
import { useUploadLimits } from '../helpers/useUploadLimits';
import styles from './ThumbnailUploader.module.css';

interface ThumbnailUploaderProps {
  value: string | undefined | null;
  currentFileId?: string;
  onChange: (url: string, fileId?: string) => void;
  /** Called by the remove button. Without it onChange('', '') is emitted. */
  onRemove?: () => void;
  onUploadingChange?: (uploading: boolean) => void;
  folder?: string;
  className?: string;
}

export const ThumbnailUploader: React.FC<ThumbnailUploaderProps> = ({
  value,
  currentFileId,
  onChange,
  onRemove,
  onUploadingChange,
  folder = 'thumbnails',
  className,
}) => {
  const limits = useUploadLimits();
  const handleSuccess = (result: { filePath: string; fileId: string; url: string }) => {
    onChange(result.url, result.fileId);
  };

  const handleError = (error: Error) => {
    console.error('Thumbnail upload error:', error);
  };

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      <R2FileUploader
        folder={folder}
        onSuccess={handleSuccess}
        onError={handleError}
        onRemove={onRemove}
        onUploadingChange={onUploadingChange}
        currentImageUrl={value ?? undefined}
        currentFileId={currentFileId}
        acceptedTypes=".jpg,.jpeg,.png"
        maxSizeInMB={limits.thumbnailMaxMb}
        aspectRatio="16/9"
        label="Upload Thumbnail"
        className={styles.uploader}
        enableCrop={true}
        cropAspect={16/9}
        cropShape="rect"
      />
      <p className={styles.helperText}>
        Images are securely stored and optimized. Recommended size: 1200×675px (16:9 aspect ratio, max {limits.thumbnailMaxMb}MB).
      </p>
    </div>
  );
};