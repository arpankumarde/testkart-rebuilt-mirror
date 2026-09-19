import React, { useEffect, useRef } from 'react';
import styles from './GumletEmbedPlayer.module.css';

const BRIDGE_READY_TIMEOUT_MS = 20000;

interface GumletEmbedPlayerProps {
  embedUrl: string;
  title: string;
  onEnded?: () => void;
  className?: string;
}

/**
 * Gumlet's hosted player in an iframe. DRM licensing happens inside the embed,
 * so no token is needed here. The "ended" event arrives over player.js
 * postMessage and drives the lesson's watch-to-complete rule. If the player
 * never answers (blocked frame, no DRM support), onEnded fires after a timeout
 * so the student is not locked out of marking the lesson complete.
 */
export const GumletEmbedPlayer: React.FC<GumletEmbedPlayerProps> = ({ embedUrl, title, onEnded, className }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let player: { on: (event: string, cb: () => void) => boolean; off: (event: string) => boolean } | null = null;
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => onEndedRef.current?.(), BRIDGE_READY_TIMEOUT_MS);

    import('@gumlet/player.js')
      .then(({ Player }) => {
        if (cancelled) return;
        const instance = new Player(iframe);
        player = instance;
        instance.on('ready', () => {
          window.clearTimeout(fallbackTimer);
          instance.on('ended', () => onEndedRef.current?.());
        });
      })
      .catch((error) => console.error('Failed to load the Gumlet player bridge:', error));

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      player?.off('ended');
      player?.off('ready');
    };
  }, [embedUrl]);

  return (
    <div className={`${styles.frameWrapper} ${className ?? ''}`}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        className={styles.frame}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
};