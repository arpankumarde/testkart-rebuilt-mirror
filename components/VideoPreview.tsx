import React, { useRef, useState, useEffect, useId } from 'react';
import { Play } from 'lucide-react';
import { useYouTubeIframeApi } from '../helpers/useYouTubeIframeApi';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './Dialog';
import styles from './VideoPreview.module.css';

interface VideoPreviewProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  title: string;
  className?: string;
  mode?: 'preview' | 'player';
  onVideoCompleted?: () => void;
  controlsList?: string;
  inlinePlayback?: boolean;
}

// Helper function to check if URL is a YouTube URL
const isYouTubeUrl = (url: string): boolean => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

// Helper function to extract YouTube video ID
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

// Helper function to convert YouTube URL to embed URL
const convertToYouTubeEmbed = (url: string, autoplay: boolean = false, enableApi: boolean = false): string | null => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  const params = ['playsinline=1', 'rel=0'];
  if (autoplay) params.push('autoplay=1');
  if (enableApi) {
    params.push('enablejsapi=1');
    if (typeof window !== 'undefined') {
      params.push(`origin=${encodeURIComponent(window.location.origin)}`);
    }
  }
  const queryString = '?' + params.join('&');
  return `https://www.youtube-nocookie.com/embed/${videoId}${queryString}`;
};

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  thumbnailUrl,
  title,
  className,
  mode = 'preview',
  onVideoCompleted,
  controlsList,
  inlinePlayback = false,
}) => {
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const dialogVideoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isInlinePlaying, setIsInlinePlaying] = useState(false);
  
  const uniqueId = useId();
  const iframeId = `youtube-player-${uniqueId.replace(/:/g, '')}`;
  const isYouTubeApiReady = useYouTubeIframeApi();
  const ytPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onVideoCompletedRef = useRef(onVideoCompleted);
  useEffect(() => {
    onVideoCompletedRef.current = onVideoCompleted;
  }, [onVideoCompleted]);

  const hasCompletedRef = useRef(hasCompleted);
  useEffect(() => {
    hasCompletedRef.current = hasCompleted;
  }, [hasCompleted]);

  const effectiveVideoUrl = videoUrl || null;

  // Check if video is YouTube
  const isYouTube = effectiveVideoUrl ? isYouTubeUrl(effectiveVideoUrl) : false;
  const youtubeEmbedUrl = isYouTube && effectiveVideoUrl ? convertToYouTubeEmbed(effectiveVideoUrl, mode === 'player', mode === 'player') : null;

  // Track video completion for regular videos
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (hasCompleted || !onVideoCompleted) return;
    
    const video = event.currentTarget;
    const duration = video.duration;
    const currentTime = video.currentTime;
    
    if (duration > 0 && currentTime / duration >= 0.9) {
      setHasCompleted(true);
      onVideoCompleted();
    }
  };

  // For YouTube videos in player mode, use the real YouTube IFrame API to track completion
  useEffect(() => {
    if (isYouTube && mode === 'player' && isYouTubeApiReady && youtubeEmbedUrl && !hasCompletedRef.current) {
      const iframeElement = document.getElementById(iframeId);
      if (!iframeElement) return;

      let timeoutId: NodeJS.Timeout;

      if (!ytPlayerRef.current && window.YT && window.YT.Player) {
        timeoutId = setTimeout(() => {
          const iframeCheck = document.getElementById(iframeId);
          if (!iframeCheck) return;

          ytPlayerRef.current = new window.YT.Player(iframeId, {
            host: 'https://www.youtube-nocookie.com',
            events: {
              onStateChange: (event: any) => {
                if (hasCompletedRef.current || !onVideoCompletedRef.current) return;

                const YT_STATE_ENDED = 0;
                const YT_STATE_PLAYING = 1;

                if (event.data === YT_STATE_ENDED) {
                  setHasCompleted(true);
                  if (onVideoCompletedRef.current) onVideoCompletedRef.current();
                  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                } else if (event.data === YT_STATE_PLAYING) {
                  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = setInterval(() => {
                    if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime && ytPlayerRef.current.getDuration) {
                      const currentTime = ytPlayerRef.current.getCurrentTime();
                      const duration = ytPlayerRef.current.getDuration();
                      if (duration > 0 && currentTime / duration >= 0.9) {
                        setHasCompleted(true);
                        if (onVideoCompletedRef.current) onVideoCompletedRef.current();
                        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                      }
                    }
                  }, 1000);
                } else {
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                }
              }
            }
          });
        }, 0);
      }

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
          ytPlayerRef.current.destroy();
          ytPlayerRef.current = null;
        }
      };
    }
  }, [isYouTube, mode, isYouTubeApiReady, youtubeEmbedUrl, iframeId]);

  // Handle hover play/pause for preview (only for non-YouTube videos in preview mode)
  const handleMouseEnter = () => {
    if (mode === 'preview' && !isYouTube && previewVideoRef.current && !isDialogOpen && !isInlinePlaying) {
      previewVideoRef.current.play().catch((error) => {
        console.log('Auto-play prevented:', error);
      });
    }
  };

  const handleMouseLeave = () => {
    if (mode === 'preview' && !isYouTube && previewVideoRef.current && !isDialogOpen && !isInlinePlaying) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  };

  const handlePlayClick = () => {
    if (inlinePlayback) {
      setIsInlinePlaying(true);
      if (!isYouTube && previewVideoRef.current) {
        previewVideoRef.current.muted = false;
        previewVideoRef.current.controls = true;
        previewVideoRef.current.currentTime = 0;
        previewVideoRef.current.play().catch((e) => console.log('Inline auto-play prevented:', e));
      }
    } else {
      // Open Dialog for both YouTube and regular videos
      setIsDialogOpen(true);
    }
  };

  const handlePreviewEnded = () => {
    if (inlinePlayback) {
      setIsInlinePlaying(false);
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = true;
        previewVideoRef.current.controls = false;
        previewVideoRef.current.currentTime = 0;
      }
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    
    // Reset preview video when dialog closes
    if (!open && previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  };

  // Auto-play dialog video when it's ready (only for non-YouTube)
  const handleDialogVideoLoad = () => {
    if (!isYouTube && dialogVideoRef.current) {
      dialogVideoRef.current.play().catch((error) => {
        console.log('Dialog video auto-play prevented:', error);
      });
    }
  };

  // Auto-play player video when it's ready (only for player mode)
  const handlePlayerVideoLoad = () => {
    if (mode === 'player' && !isYouTube && playerVideoRef.current) {
      playerVideoRef.current.play().catch((error) => {
        console.log('Player video auto-play prevented:', error);
      });
    }
  };



  // Empty state: no video and no thumbnail
  if (!effectiveVideoUrl && !thumbnailUrl) {
    return (
      <div 
        ref={containerRef} 
        className={`${mode === 'player' ? styles.playerContainer : styles.container} ${className || ''}`} 
      />
    );
  }

    // Fallback to image only if we have a thumbnail but no video
  if (!effectiveVideoUrl && thumbnailUrl) {
    const imageUrl = thumbnailUrl;

        return (
      <div ref={containerRef} className={`${mode === 'player' ? styles.playerContainer : styles.container} ${className || ''}`}>
        <img 
          src={imageUrl || undefined} 
          alt={title} 
          className={styles.media}
          loading="eager"
          width={640}
          height={360}
        />
      </div>
    );
  }

  // Render YouTube video
  if (isYouTube && youtubeEmbedUrl && effectiveVideoUrl) {
    const videoId = extractYouTubeVideoId(effectiveVideoUrl);
    const youtubeThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

    // Player mode: render iframe directly
    if (mode === 'player') {
      return (
        <div ref={containerRef} className={`${styles.playerContainer} ${className || ''}`}>
          <iframe
            id={iframeId}
            src={youtubeEmbedUrl}
            className={styles.youtubeIframe}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            title={title}
          />
        </div>
      );
    }

        // Preview mode: show thumbnail with play button, open Dialog on click (or play inline)
    return (
      <>
        <div
          ref={containerRef}
          className={`${styles.container} ${className || ''}`}
        >
          {(!inlinePlayback || !isInlinePlaying) ? (
            <>
              <img
                src={youtubeThumbnail || undefined}
                alt={title}
                className={styles.media}
                loading="eager"
                width={640}
                height={360}
              />
              <div
                className={styles.playButton}
                onClick={handlePlayClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlayClick();
                  }
                }}
                aria-label="Play video"
              >
                <Play size={24} />
              </div>
            </>
          ) : (
            <iframe
              src={convertToYouTubeEmbed(effectiveVideoUrl, true, false) || undefined}
              className={styles.youtubeIframe}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
              allowFullScreen
              title={title}
            />
          )}
        </div>

        {!inlinePlayback && (
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogContent className={styles.dialogContent}>
              <DialogTitle className={styles.visuallyHidden}>{title}</DialogTitle>
              <div className={styles.youtubeDialogWrapper}>
                <iframe
                  src={isDialogOpen ? convertToYouTubeEmbed(effectiveVideoUrl, true, false) || undefined : undefined}
                  className={styles.youtubeDialogIframe}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                  allowFullScreen
                  title={title}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  const posterUrl = thumbnailUrl ? thumbnailUrl : undefined;

  // Player mode: full interactive video without preview behavior
  if (mode === 'player') {
    return (
      <div ref={containerRef} className={`${styles.playerContainer} ${className || ''}`}>
        <video
          ref={playerVideoRef}
          className={styles.media}
          controls
          autoPlay
          playsInline
          controlsList={controlsList}
          onLoadedMetadata={handlePlayerVideoLoad}
          onTimeUpdate={handleTimeUpdate}
          poster={posterUrl || undefined}
        >
          <source src={effectiveVideoUrl || undefined} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Preview mode: original behavior with hover and modal (or inline playback)
  return (
    <>
      <div
        ref={containerRef}
        className={`${styles.container} ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {posterUrl && (!inlinePlayback || !isInlinePlaying) && (
          <img
            src={posterUrl}
            alt={title}
            className={styles.posterImage}
            loading="eager"
          />
        )}
        <video
          ref={previewVideoRef}
          className={`${styles.media} ${(!inlinePlayback || !isInlinePlaying) ? styles.previewVideo : ''}`}
          preload="metadata"
          muted={!isInlinePlaying}
          playsInline
          controls={isInlinePlaying}
          controlsList={controlsList}
          poster={(!isInlinePlaying && posterUrl) ? posterUrl : undefined}
          onEnded={handlePreviewEnded}
          onTimeUpdate={isInlinePlaying ? handleTimeUpdate : undefined}
        >
          <source src={effectiveVideoUrl || undefined} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {(!inlinePlayback || !isInlinePlaying) && (
          <div
            className={styles.playButton}
            onClick={handlePlayClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePlayClick();
              }
            }}
            aria-label="Play video"
          >
            <Play size={24} />
          </div>
        )}
      </div>

      {!inlinePlayback && (
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className={styles.dialogContent}>
            <DialogTitle className={styles.visuallyHidden}>{title}</DialogTitle>
            <video
              ref={dialogVideoRef}
              className={styles.dialogVideo}
              controls
              playsInline
              controlsList={controlsList}
              onLoadedMetadata={handleDialogVideoLoad}
              onTimeUpdate={handleTimeUpdate}
              poster={posterUrl || undefined}
            >
              <source src={effectiveVideoUrl || undefined} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};