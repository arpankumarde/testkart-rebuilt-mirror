import React, { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { AlertCircle, Camera, Trash2, Upload } from 'lucide-react';
import { uploadFileToR2, deleteR2File } from '../helpers/useR2Upload';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ImageCropDialog } from './ImageCropDialog';
import styles from './TeacherAvatarField.module.css';

interface TeacherAvatarFieldProps {
  avatarUrl?: string | null;
  avatarFileId?: string | null;
  /** Used for the initials shown before a photo is set. */
  displayName?: string | null;
  maxSizeInMB: number;
  onChange: (next: { avatarUrl: string; avatarFileId: string }) => void;
  className?: string;
}

const ACCEPTED_TYPES = '.jpg,.jpeg,.png';
const FOLDER = 'avatars/teacher';

const initialsOf = (name?: string | null): string => {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join('').toUpperCase();
};

/*
 * The avatar control on /teacher/edit-profile and in onboarding.
 *
 * Replaces a generic R2FileUploader squeezed into a circle with !important
 * width/height/border-radius overrides. That version centred a 9rem circle in a
 * full-width panel, so the row was mostly empty space, and it stacked its own
 * drop-zone copy ("Upload", "Drag & drop or click to upload") inside the
 * circle where there was no room for it.
 */
export const TeacherAvatarField: React.FC<TeacherAvatarFieldProps> = ({
  avatarUrl,
  avatarFileId,
  displayName,
  maxSizeInMB,
  onChange,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');

  const shownUrl = previewUrl ?? avatarUrl ?? null;
  const hasPhoto = !!shownUrl && !imageFailed;
  const initials = initialsOf(displayName);

  const validate = useCallback(
    (file: File): string | null => {
      const name = file.name.toLowerCase();
      const isAccepted = ACCEPTED_TYPES.split(',').some((ext) => name.endsWith(ext.trim()));
      if (!isAccepted) return 'Choose a JPG or PNG image.';
      if (file.size > maxSizeInMB * 1024 * 1024) {
        return `That image is over ${maxSizeInMB} MB. Choose a smaller one.`;
      }
      return null;
    },
    [maxSizeInMB]
  );

  const openCropper = useCallback(
    (file: File) => {
      setError(null);
      const problem = validate(file);
      if (problem) {
        setError(problem);
        return;
      }
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '.jpg';
      setCropFileName(`${nanoid(16)}${ext}`);
      setCropSrc(URL.createObjectURL(file));
    },
    [validate]
  );

  const handleCropConfirm = async (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPreviewUrl(objectUrl);
    setImageFailed(false);
    setIsUploading(true);
    setProgress(0);
    setError(null);

    const replacedFileId = avatarFileId;

    try {
      const result = await uploadFileToR2(blob, FOLDER, cropFileName, setProgress);
      onChange({ avatarUrl: result.url, avatarFileId: result.key });

      // Only once the new photo is safely stored. Deleting first - as the old
      // uploader did - left the teacher with no avatar at all if the upload
      // then failed.
      if (replacedFileId) {
        try {
          await deleteR2File(replacedFileId);
        } catch (deleteError) {
          console.error(`Could not delete the replaced avatar: ${replacedFileId}`, deleteError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed. Try again.');
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) openCropper(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) openCropper(file);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setImageFailed(false);
    setError(null);
    onChange({ avatarUrl: '', avatarFileId: '' });
  };

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileInput}
        className={styles.input}
        tabIndex={-1}
        disabled={isUploading}
      />

      <button
        type="button"
        className={`${styles.avatar} ${isDragging ? styles.dragging : ''}`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={isUploading}
        aria-label={hasPhoto ? 'Change your profile photo' : 'Upload a profile photo'}
      >
        {hasPhoto ? (
          <img
            src={shownUrl ?? undefined}
            alt=""
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            {initials || <Camera size={26} />}
          </span>
        )}

        {!isUploading && (
          <span className={styles.hover} aria-hidden="true">
            <Camera size={20} />
          </span>
        )}

        {isUploading && (
          <span className={styles.uploading}>
            <Spinner size="sm" />
            {progress > 0 && <span className={styles.progress}>{progress}%</span>}
          </span>
        )}
      </button>

      <div className={styles.body}>
        <p className={styles.label}>Profile photo</p>
        <p className={styles.hint}>
          JPG or PNG, up to {maxSizeInMB} MB. Square images look best - use at least 400 x 400
          pixels. You can crop it after choosing.
        </p>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={14} />
            {hasPhoto ? 'Change photo' : 'Upload photo'}
          </Button>

          {hasPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className={styles.remove}
            >
              <Trash2 size={14} />
              Remove
            </Button>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
      </div>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          onClose={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          imageSrc={cropSrc}
          onCropConfirm={handleCropConfirm}
          aspect={1}
          cropShape="round"
        />
      )}
    </div>
  );
};
