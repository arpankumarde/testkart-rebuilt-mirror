import React, { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./ImageLightbox.module.css";

export interface LightboxImage {
  src: string;
  alt: string;
  caption: string | null;
}

/**
 * Opens the lightbox for any `.tk-zoomable` button (see
 * helpers/zoomableImages) inside `rootRef`. One delegated listener on the
 * document, so it covers rich-text images that render after mount or are
 * replaced on refetch, with no handler per image.
 */
export function useImageLightbox(rootRef: RefObject<HTMLElement | null>) {
  const [image, setImage] = useState<LightboxImage | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as Element | null)?.closest?.<HTMLElement>(".tk-zoomable");
      if (!trigger || !rootRef.current?.contains(trigger)) return;
      const img = trigger.querySelector("img");
      if (!img) return;
      e.preventDefault();
      triggerRef.current = trigger;
      setImage({
        src: img.currentSrc || img.src,
        alt: img.alt,
        caption: trigger.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || null,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [rootRef]);

  const close = useCallback(() => {
    setImage(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  return { image, close };
}

interface ImageLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

/**
 * Full-screen preview of one image at the largest size that fits the
 * viewport, aspect ratio kept. Closes on the backdrop, the close button or
 * Escape; clicks on the image or caption do nothing. Page scroll is locked
 * while open and focus stays on the close button.
 */
export const ImageLightbox = ({ image, onClose }: ImageLightboxProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!image) return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    // Keeps the page from shifting sideways when its scrollbar disappears.
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // The close button is the only control, so focus stays on it.
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      document.removeEventListener("keydown", onKey);
    };
  }, [image, onClose]);

  if (!image || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || image.alt || "Image preview"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close image preview">
        <X size={22} aria-hidden="true" />
      </button>

      <figure className={styles.stage}>
        <img
          src={image.src}
          alt={image.alt}
          className={`${styles.image} ${image.caption ? styles.withCaption : ""}`}
        />
        {image.caption && <figcaption className={styles.caption}>{image.caption}</figcaption>}
      </figure>
    </div>,
    document.body
  );
};
