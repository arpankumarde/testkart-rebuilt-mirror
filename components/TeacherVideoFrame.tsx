import React, { useState } from "react";
import { Play } from "lucide-react";
import { formatVideoDuration, type TeacherVideo } from "../helpers/teacherVideos";
import styles from "./TeacherVideoFrame.module.css";

type Props = {
  video: TeacherVideo;
  /** "tall" is for YouTube Shorts (9:16). */
  shape?: "wide" | "tall";
  /** Start in the player instead of the thumbnail, for a video the visitor just picked. */
  startPlaying?: boolean;
  className?: string;
};

/**
 * Thumbnail first, player on click, so a page of videos does not load an
 * iframe per video before anyone presses play. Remount with a new key to
 * switch videos.
 */
export const TeacherVideoFrame = ({ video, shape = "wide", startPlaying = false, className }: Props) => {
  const [playing, setPlaying] = useState(startPlaying);
  const [thumbFallback, setThumbFallback] = useState(false);
  const duration = formatVideoDuration(video.durationSeconds);
  const frameClass = `${styles.frame} ${shape === "tall" ? styles.tall : ""} ${className ?? ""}`.trim();

  if (playing) {
    return (
      <div className={frameClass}>
        {video.source === "youtube" ? (
          <iframe
            className={styles.media}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video className={styles.media} src={video.src} controls autoPlay playsInline preload="metadata" />
        )}
      </div>
    );
  }

  const wideThumb = thumbFallback ? "sddefault.jpg" : "maxresdefault.jpg";
  const thumb =
    video.source === "youtube"
      ? `https://i.ytimg.com/vi/${video.id}/${shape === "tall" ? "oar2.jpg" : wideThumb}`
      : null;

  // A video without a 1280px upload gets YouTube's 120x90 grey placeholder for maxresdefault, not an error.
  const onThumbLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (shape === "wide" && !thumbFallback && event.currentTarget.naturalWidth <= 120) setThumbFallback(true);
  };

  return (
    <div className={frameClass}>
      <button type="button" className={styles.facade} onClick={() => setPlaying(true)}>
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className={styles.thumb}
            onLoad={onThumbLoad}
            onError={() => shape === "wide" && setThumbFallback(true)}
          />
        ) : (
          <span className={styles.fileCover} aria-hidden="true">
            {video.title}
          </span>
        )}
        <span className={styles.play}>
          <Play size={16} aria-hidden="true" fill="currentColor" />
          Play
          <span className={styles.srOnly}>: {video.title}</span>
          {duration && <span className={styles.duration}>{duration}</span>}
        </span>
      </button>
    </div>
  );
};
