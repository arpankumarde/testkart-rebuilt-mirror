import React from 'react';
import { toast } from 'sonner';
import { VideoUploader } from './VideoUploader';
import { useUploadLimits } from '../helpers/useUploadLimits';
import styles from './CourseThumbnailVideo.module.css';

export interface CourseThumbnailVideoProps {
  /** The URL of the uploaded video. */
  value: string | null;
  /** The R2 key of the uploaded video. */
  fileId: string | null;
  /** Callback function when the video is uploaded or removed. */
  onChange: (url: string | null, fileId: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /** Optional callback when the video preview is played. */
  onPreview?: () => void;
  /** Optional class name for custom styling. */
  className?: string;
  /** Optional course ID. If provided, uploads to course specific folder. */
  courseId?: number;
}

/**
 * A component for uploading and displaying a single course introduction/thumbnail video.
 * It uses the VideoUploader component configured for a single R2 video upload.
 */
export const CourseThumbnailVideo: React.FC<CourseThumbnailVideoProps> = ({
  value,
  fileId,
  onChange,
  onUploadingChange,
  onPreview,
  className,
  courseId,
}) => {
  const limits = useUploadLimits();

  const handleSuccess = (result: { url: string; videoFileId: string | null }) => {
    onChange(result.url || null, result.videoFileId || null);
  };

  const handleError = (error: Error) => {
    console.error('Video upload failed:', error);
    toast.error('Upload Failed', {
      description: error.message || 'There was a problem uploading your video. Please try again.',
    });
  };

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      <VideoUploader
        folder={courseId ? `course/${courseId}` : "course-intros"}
        onSuccess={handleSuccess}
        onError={handleError}
        onRemove={() => onChange(null, null)}
        onUploadingChange={onUploadingChange}
        currentVideoUrl={value ?? undefined}
        currentVideoFileId={fileId ?? undefined}
        acceptedTypes="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-flv"
        maxSizeInMB={limits.courseIntroVideoMaxMb}
        aspectRatio="16 / 9"
        label="Upload Intro Video"
        allowYouTube={false}
      />
    </div>
  );
};