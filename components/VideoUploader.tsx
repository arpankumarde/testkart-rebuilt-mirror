import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Video, X, AlertCircle } from 'lucide-react';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { Spinner } from './Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Input } from './Input';
import { Button } from './Button';
import { useDebounce } from '../helpers/useDebounce';
import styles from './VideoUploader.module.css';

// Helper functions for YouTube URL handling
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

const convertToWatchUrl = (videoId: string): string => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};

const convertToEmbedUrl = (videoId: string): string => {
  return `https://www.youtube.com/embed/${videoId}`;
};

const validateYouTubeVideo = async (videoId: string): Promise<boolean> => {
  try {
    const watchUrl = convertToWatchUrl(videoId);
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
    );
    return response.ok;
  } catch (error) {
    console.error('YouTube validation error:', error);
    return false;
  }
};

export interface VideoUploaderProps {
  folder: string;
  onSuccess: (result: { url: string; videoFileId: string | null }) => void;
  onError?: (error: Error) => void;
  onUploadStart?: () => void;
  /** Fires true when an upload starts and false when it ends or the uploader unmounts. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Called by the remove button. Without it the legacy onSuccess({ url: '' }) is emitted. */
  onRemove?: () => void;
  currentVideoUrl?: string;
  /** No longer read: the saved file is never deleted before a replacement is saved. */
  currentVideoFileId?: string;
  acceptedTypes?: string;
  maxSizeInMB?: number;
  aspectRatio?: string;
  label?: string;
  className?: string;
  allowYouTube?: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  folder,
  onSuccess,
  onError,
  onUploadStart,
  onUploadingChange,
  onRemove,
  currentVideoUrl,
  acceptedTypes = 'video/mp4,video/webm,video/quicktime',
  maxSizeInMB = 2048,
  aspectRatio = '16 / 9',
  label = 'Upload Video',
  className,
  allowYouTube = false,
}) => {
  const uploadRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  // Determine if current video is YouTube
  const isCurrentVideoYouTube = !!currentVideoUrl && (
    currentVideoUrl.includes('youtube.com') ||
    currentVideoUrl.includes('youtu.be')
  );

  // YouTube-specific state. A saved YouTube lesson opens on its own tab.
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube'>(() =>
    allowYouTube && isCurrentVideoYouTube ? 'youtube' : 'upload'
  );
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isValidatingYoutube, setIsValidatingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const debouncedYoutubeUrl = useDebounce(youtubeUrl, 500);

  // Validate YouTube URL when debounced value changes
  React.useEffect(() => {
    if (!allowYouTube || activeTab !== 'youtube' || !debouncedYoutubeUrl) {
      setYoutubeError(null);
      return;
    }

    const validateUrl = async () => {
      setIsValidatingYoutube(true);
      setYoutubeError(null);

      const videoId = extractYouTubeVideoId(debouncedYoutubeUrl);
      if (!videoId) {
        setYoutubeError('Invalid YouTube URL format');
        setIsValidatingYoutube(false);
        return;
      }

      const isValid = await validateYouTubeVideo(videoId);
      if (!isValid) {
        setYoutubeError('Video not found or not accessible');
        setIsValidatingYoutube(false);
        return;
      }

      setIsValidatingYoutube(false);
    };

    validateUrl();
  }, [debouncedYoutubeUrl, allowYouTube, activeTab]);

  const processFile = useCallback(async (file: File) => {
    if (uploadInFlightRef.current) return;
    setError(null);

    // Client-side validation
    if (file.size > maxSizeInMB * 1024 * 1024) {
      const errorMessage = `File size cannot exceed ${maxSizeInMB}MB.`;
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
      return;
    }

    // The saved file is never deleted here: a failed or abandoned replacement must
    // leave the saved record pointing at a file that still exists.
    uploadInFlightRef.current = true;
    onUploadStart?.();
    setIsUploading(true);
    setUploadProgress(0);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const result = await uploadFileToR2(file, folder, file.name, (pct) => setUploadProgress(pct));
      setIsUploading(false);
      setUploadProgress(100);
      onSuccess({ 
        url: result.url,
        videoFileId: result.key
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      console.error("R2 video upload error:", err);
      setIsUploading(false);
      setError(errorMessage);
      if (onError) onError(new Error(errorMessage));
    } finally {
      uploadInFlightRef.current = false;
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }
  }, [maxSizeInMB, folder, onUploadStart, onSuccess, onError]);

  const handleUploadChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (evt.target) evt.target.value = '';
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveVideo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    } else {
      onSuccess({ url: '', videoFileId: null });
    }
    setYoutubeUrl('');
  };

  const handleYouTubeSubmit = () => {
    if (youtubeError || isValidatingYoutube || !youtubeUrl) return;

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setYoutubeError('Invalid YouTube URL');
      return;
    }

    const watchUrl = convertToWatchUrl(videoId);
    onSuccess({ url: watchUrl, videoFileId: null });
    setYoutubeUrl('');
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

  const effectiveVideoUrl = previewUrl || currentVideoUrl;

  const renderUploader = () => (
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
        ref={uploadRef}
        onChange={handleUploadChange}
        accept={acceptedTypes}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      {effectiveVideoUrl && !isCurrentVideoYouTube ? (
        <div className={styles.previewContainer}>
          <video
            src={effectiveVideoUrl}
            controls
            className={styles.previewVideo}
          />
          <button
            type="button"
            className={styles.removeButton}
            onClick={handleRemoveVideo}
            aria-label="Remove video"
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
            <p>Uploading video... {uploadProgress}%</p>
          </div>
        </div>
      )}

      {!isUploading && error && (
        <div className={`${styles.overlay} ${styles.errorOverlay}`}>
          <AlertCircle size={24} className={styles.errorIcon} />
          <p className={styles.errorMessage}>{error}</p>
        </div>
      )}

      {!effectiveVideoUrl && !isUploading && !error && (
        <div className={styles.initialOverlay}>
          <Video size={24} />
          <span>{label}</span>
        </div>
      )}
    </div>
  );

  // Render with tabs if YouTube is allowed
  if (allowYouTube) {
    return (
      <div className={className}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'youtube')}>
          <TabsList>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="youtube">YouTube URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            {renderUploader()}
          </TabsContent>

          <TabsContent value="youtube">
            <div className={styles.youtubeContainer}>
              {isCurrentVideoYouTube && currentVideoUrl ? (
                <div className={styles.youtubePreview}>
                  <div className={styles.youtubeIframeWrapper}>
                    <iframe
                      src={convertToEmbedUrl(extractYouTubeVideoId(currentVideoUrl) || '')}
                      className={styles.youtubeIframe}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="YouTube video preview"
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={handleRemoveVideo}
                    aria-label="Remove video"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.youtubeInputContainer}>
                    <Input
                      type="url"
                      placeholder="Paste YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className={styles.youtubeInput}
                    />
                    <Button
                      type="button"
                      onClick={handleYouTubeSubmit}
                      disabled={!youtubeUrl || !!youtubeError || isValidatingYoutube}
                    >
                      {isValidatingYoutube ? <Spinner size="sm" /> : 'Add Video'}
                    </Button>
                  </div>
                  {youtubeError && (
                    <div className={styles.youtubeError}>
                      <AlertCircle size={16} />
                      <span>{youtubeError}</span>
                    </div>
                  )}
                  {!youtubeError && youtubeUrl && !isValidatingYoutube && debouncedYoutubeUrl === youtubeUrl && (
                    <div className={styles.youtubeSuccess}>
                      <Video size={16} />
                      <span>Valid YouTube video</span>
                    </div>
                  )}
                  <p className={styles.youtubeHelp}>
                    Paste a youtube.com/watch, youtu.be or m.youtube.com link.
                  </p>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Original upload-only rendering
  return renderUploader();
};