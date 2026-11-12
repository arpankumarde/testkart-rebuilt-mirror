import React, { useEffect, useRef } from "react";
import { MicOff, Crown, MonitorUp } from "lucide-react";
import styles from "./ClassroomVideoTile.module.css";

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

export const ClassroomAvatar: React.FC<{ name: string; src?: string | null; size?: "sm" | "md" | "lg" }> = ({ name, src, size = "md" }) =>
  src ? (
    <img src={src} alt="" className={`${styles.avatar} ${styles[`avatar_${size}`]}`} />
  ) : (
    <span className={`${styles.avatar} ${styles.avatarFallback} ${styles[`avatar_${size}`]}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );

const useTrackSource = (ref: React.RefObject<HTMLMediaElement | null>, track: MediaStreamTrack | null) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = track ? new MediaStream([track]) : null;
    if (track) void el.play().catch(() => undefined);
  }, [ref, track]);
};

interface TileProps {
  name: string;
  avatarUrl?: string | null;
  track: MediaStreamTrack | null;
  audioOn: boolean;
  isLocal?: boolean;
  isTeacher?: boolean;
  speaking?: boolean;
  /** Screen shares are shown whole (contain) and never mirrored. */
  isScreen?: boolean;
  variant?: "stage" | "thumb" | "pip" | "preview";
  className?: string;
}

/** One person (or one shared screen) in the call: live video, or their avatar while the camera is off. */
export const ClassroomVideoTile: React.FC<TileProps> = ({
  name,
  avatarUrl,
  track,
  audioOn,
  isLocal = false,
  isTeacher = false,
  speaking = false,
  isScreen = false,
  variant = "stage",
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useTrackSource(videoRef, track);
  const label = isScreen ? `${name}'s screen` : isLocal ? `${name} (You)` : name;

  return (
    <figure
      className={`${styles.tile} ${styles[`tile_${variant}`]} ${speaking && !isScreen ? styles.speaking : ""} ${className ?? ""}`}
      aria-label={label}
    >
      {track ? (
        <video
          ref={videoRef}
          className={`${styles.video} ${isScreen ? styles.videoScreen : ""} ${isLocal && !isScreen ? styles.mirror : ""}`}
          autoPlay
          playsInline
          muted
        />
      ) : (
        <div className={styles.placeholder}>
          <ClassroomAvatar name={name} src={avatarUrl} size={variant === "thumb" || variant === "pip" ? "sm" : "lg"} />
        </div>
      )}
      <figcaption className={styles.nameplate}>
        {isScreen ? (
          <MonitorUp size={13} aria-hidden="true" />
        ) : !audioOn ? (
          <span className={styles.micOff} title="Microphone off">
            <MicOff size={12} aria-hidden="true" />
            <span className={styles.srOnly}>Microphone off</span>
          </span>
        ) : null}
        {isTeacher && !isScreen && <Crown size={12} aria-hidden="true" className={styles.crown} />}
        <span className={styles.name}>{label}</span>
      </figcaption>
    </figure>
  );
};

/** Plays one remote audio track. Call object mode leaves audio playback to the page. */
export const ClassroomRemoteAudio: React.FC<{ track: MediaStreamTrack; outputDeviceId?: string }> = ({ track, outputDeviceId }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  useTrackSource(ref, track);
  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el && outputDeviceId && el.setSinkId) void el.setSinkId(outputDeviceId).catch(() => undefined);
  }, [outputDeviceId]);
  return <audio ref={ref} autoPlay playsInline />;
};
