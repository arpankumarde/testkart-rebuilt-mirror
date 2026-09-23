import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePinchZoom, type PinchPoint } from "../helpers/usePinchZoom";
import { Button } from "./Button";
import {
  PdfReaderContext,
  PdfReaderMessage,
  PdfReaderSlot,
  usePdfReader,
  type PdfReaderContextValue,
} from "./PdfReaderParts";
import styles from "./PdfReader.module.css";

const PdfReaderDocument = React.lazy(() => import("./PdfReaderDocument"));

export type PdfReaderImagePage = {
  imageUrl: string;
  width?: number;
  height?: number;
  totalPages?: number;
};

// "pdf" opens the whole file in the browser. "images" is for pages the server renders one at a time, so the
// file itself never reaches the reader (public study notes previews).
export type PdfReaderSource =
  | { kind: "pdf"; url: string }
  | {
      kind: "images";
      cacheKey: readonly unknown[];
      pageCount: number;
      loadPage: (page: number) => Promise<PdfReaderImagePage>;
    };

type ImagesSource = Extract<PdfReaderSource, { kind: "images" }>;

export interface PdfReaderProps {
  source: PdfReaderSource | null;
  title: string;
  note?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  openInNewTabHref?: string;
  onClose?: () => void;
  restricted?: boolean;
  titleComponent?: React.ElementType;
  className?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM_PDF = 3;
const MAX_ZOOM_IMAGES = 1.75;
const ZOOM_STEP = 0.25;
const FIT_WIDTH = 960;
const FIT_WIDTH_FULLSCREEN = 1200;
const FRAME_PADDING = 32;
const TOP_EDGE = 16;
const FALLBACK_RATIO = 1.414;
const NEAR_MARGIN_PDF = "120% 0px";
const NEAR_MARGIN_IMAGES = "60% 0px";
const IMAGE_FETCH_DELAY_MS = 200;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The spot of a page that sits under the fingers when a pinch starts, kept as fractions of the page so it can be
// put back under the fingers once the pages have their new size.
type PinchAnchor = { page: number; fractionX: number; fractionY: number };

const findPinchAnchor = (root: HTMLElement | null, point: PinchPoint): PinchAnchor | null => {
  const slots = root?.querySelectorAll<HTMLElement>("[data-page]");
  if (!slots || slots.length === 0) return null;
  let nearest = slots[0];
  let nearestGap = Infinity;
  for (let index = 0; index < slots.length && nearestGap > 0; index++) {
    const rect = slots[index].getBoundingClientRect();
    const gap = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
    if (gap < nearestGap) {
      nearest = slots[index];
      nearestGap = gap;
    }
  }
  const rect = nearest.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    page: Number(nearest.dataset.page),
    fractionX: (point.x - rect.left) / rect.width,
    fractionY: clamp((point.y - rect.top) / rect.height, 0, 1),
  };
};

const ImagePage: React.FC<{ source: ImagesSource; page: number }> = ({ source, page }) => {
  const { reportRatio, setNumPages } = usePdfReader();
  const [isArmed, setIsArmed] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Pages are rendered on the server on first request, so a page scrolled straight past never asks for one.
  useEffect(() => {
    const timer = setTimeout(() => setIsArmed(true), IMAGE_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: [...source.cacheKey, page],
    queryFn: () => source.loadPage(page),
    enabled: isArmed,
    staleTime: Infinity,
    retry: false,
  });
  const data = query.data;

  useEffect(() => {
    if (!data) return;
    const totalPages = data.totalPages;
    if (totalPages) {
      setNumPages((current) => Math.min(current, totalPages));
    }
    if (data.width && data.height) {
      reportRatio(page, data.height / data.width);
    }
  }, [data, page, reportRatio, setNumPages]);

  const imageFailed = !!data && failedUrl === data.imageUrl;

  if (query.isError || imageFailed) {
    return (
      <div className={styles.pageOverlay} role="alert">
        <AlertCircle size={28} className={styles.errorIcon} />
        <p>This page could not be loaded.</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailedUrl(null);
            setAttempt((current) => current + 1);
            if (query.isError) {
              void query.refetch();
            }
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      {data && (
        <img
          key={`${data.imageUrl}-${attempt}`}
          src={data.imageUrl}
          alt={`Page ${page}`}
          className={styles.pageImage}
          draggable={false}
          onLoad={(event) => {
            setLoadedUrl(data.imageUrl);
            if (!data.width || !data.height) {
              reportRatio(page, event.currentTarget.naturalHeight / event.currentTarget.naturalWidth);
            }
          }}
          onError={() => setFailedUrl(data.imageUrl)}
        />
      )}
      {(!data || loadedUrl !== data.imageUrl) && (
        <div className={styles.pageOverlay} role="status" aria-label={`Loading page ${page}`}>
          <Loader2 size={28} className={styles.spinner} />
        </div>
      )}
    </>
  );
};

const ImagePages: React.FC<{ source: ImagesSource }> = ({ source }) => {
  const { numPages, setNumPages } = usePdfReader();

  useEffect(() => {
    setNumPages(source.pageCount);
  }, [source.pageCount, setNumPages]);

  return (
    <>
      {Array.from({ length: numPages }, (_, index) => (
        <PdfReaderSlot key={index + 1} page={index + 1}>
          <ImagePage source={source} page={index + 1} />
        </PdfReaderSlot>
      ))}
    </>
  );
};

export const PdfReader: React.FC<PdfReaderProps> = ({
  source,
  title,
  note,
  loading = false,
  error = null,
  onRetry,
  openInNewTabHref,
  onClose,
  restricted = false,
  titleComponent,
  className,
}) => {
  const Title = titleComponent ?? "h2";
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesFrameRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef({ page: 1, fraction: 0 });
  const pinchAnchorRef = useRef<PinchAnchor | null>(null);
  const pendingPinchRef = useRef<{ anchor: PinchAnchor; target: PinchPoint; zoom: number } | null>(null);
  const frameRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const listenersRef = useRef(new Map<Element, (isNear: boolean) => void>());
  const nearMarginRef = useRef(NEAR_MARGIN_PDF);

  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const isImages = source?.kind === "images";
  nearMarginRef.current = isImages ? NEAR_MARGIN_IMAGES : NEAR_MARGIN_PDF;
  const maxZoom = isImages ? MAX_ZOOM_IMAGES : MAX_ZOOM_PDF;
  const activeZoom = Math.min(zoom, maxZoom);
  const fitWidth = Math.max(
    0,
    Math.min(containerWidth - FRAME_PADDING, isFullscreen ? FIT_WIDTH_FULLSCREEN : FIT_WIDTH),
  );
  const pageWidth = Math.round(fitWidth * activeZoom);

  useIsoLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setContainerWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled === true);
    const handleChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const observe = useCallback<PdfReaderContextValue["observe"]>((element, onChange) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            listenersRef.current.get(entry.target)?.(entry.isIntersecting);
          }
        },
        { root: scrollRef.current, rootMargin: nearMarginRef.current },
      );
    }
    listenersRef.current.set(element, onChange);
    observerRef.current.observe(element);
    return () => {
      listenersRef.current.delete(element);
      observerRef.current?.unobserve(element);
    };
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  const reportRatio = useCallback((page: number, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setRatios((previous) =>
      Math.abs((previous[page] ?? 0) - ratio) < 0.001 ? previous : { ...previous, [page]: ratio },
    );
  }, []);

  const fallbackRatio = ratios[1] ?? FALLBACK_RATIO;
  const ratioOf = useCallback((page: number) => ratios[page] ?? fallbackRatio, [ratios, fallbackRatio]);

  const contextValue = useMemo<PdfReaderContextValue>(
    () => ({ pageWidth, numPages, setNumPages, ratioOf, reportRatio, observe }),
    [pageWidth, numPages, ratioOf, reportRatio, observe],
  );

  const measure = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const slots = root.querySelectorAll<HTMLElement>("[data-page]");
    if (slots.length === 0) return;
    const rootTop = root.getBoundingClientRect().top;

    const lastAtOrAbove = (edge: number) => {
      let low = 0;
      let high = slots.length - 1;
      let found = 0;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (slots[middle].getBoundingClientRect().top - rootTop <= edge) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      return found;
    };

    const isAtBottom = root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
    const readingIndex = isAtBottom ? slots.length - 1 : lastAtOrAbove(root.clientHeight * 0.3);
    setCurrentPage(readingIndex + 1);

    const anchorIndex = lastAtOrAbove(TOP_EDGE);
    const anchorRect = slots[anchorIndex].getBoundingClientRect();
    anchorRef.current = {
      page: anchorIndex + 1,
      fraction: anchorRect.height > 0 ? clamp((rootTop + TOP_EDGE - anchorRect.top) / anchorRect.height, 0, 1) : 0,
    };

    const scrollable = root.scrollHeight - root.clientHeight;
    if (progressRef.current) {
      progressRef.current.style.transform = `scaleX(${scrollable > 0 ? root.scrollTop / scrollable : 0})`;
    }
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      measure();
    });
  }, [measure]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    scheduleMeasure();
  }, [numPages, pageWidth, ratios, scheduleMeasure]);

  // A zoom, a resize or a page turning out taller than guessed changes every height above the reader's
  // place, so put the page they were on back under the top edge.
  useIsoLayoutEffect(() => {
    const root = scrollRef.current;
    const slot = root?.querySelector<HTMLElement>(`[data-page="${anchorRef.current.page}"]`);
    if (!root || !slot) return;
    const rect = slot.getBoundingClientRect();
    const delta = rect.top + anchorRef.current.fraction * rect.height - (root.getBoundingClientRect().top + TOP_EDGE);
    if (Math.abs(delta) > 1) {
      root.scrollTop += delta;
    }
  }, [pageWidth, ratios]);

  // Runs after the place-keeping effect above, so a pinch keeps the spot under the fingers rather than the top edge.
  useIsoLayoutEffect(() => {
    const pending = pendingPinchRef.current;
    pendingPinchRef.current = null;
    const root = scrollRef.current;
    if (!pending || !root || pending.zoom !== zoom) return;
    const slot = root.querySelector<HTMLElement>(`[data-page="${pending.anchor.page}"]`);
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    root.scrollLeft += rect.left + pending.anchor.fractionX * rect.width - pending.target.x;
    root.scrollTop += rect.top + pending.anchor.fractionY * rect.height - pending.target.y;
    measure();
  }, [zoom, measure]);

  const jumpToPage = (page: number) => {
    const root = scrollRef.current;
    const slot = root?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!root || !slot) return;
    root.scrollTop += slot.getBoundingClientRect().top - root.getBoundingClientRect().top - TOP_EDGE;
  };

  const commitPageDraft = () => {
    const target = parseInt(pageDraft ?? "", 10);
    setPageDraft(null);
    if (Number.isFinite(target) && numPages > 0) {
      jumpToPage(clamp(target, 1, numPages));
    }
  };

  const zoomBy = (delta: number) => {
    setZoom(clamp(Math.round((activeZoom + delta) * 100) / 100, MIN_ZOOM, maxZoom));
  };

  usePinchZoom({
    scrollRef,
    frameRef: pagesFrameRef,
    getZoom: () => activeZoom,
    getLimits: () => ({ min: MIN_ZOOM, max: maxZoom }),
    onStart: (point) => {
      pinchAnchorRef.current = findPinchAnchor(scrollRef.current, point);
    },
    onEnd: ({ zoom: nextZoom, start, end }) => {
      const anchor = pinchAnchorRef.current;
      pinchAnchorRef.current = null;
      if (nextZoom === activeZoom) {
        const root = scrollRef.current;
        if (root) {
          root.scrollLeft -= end.x - start.x;
          root.scrollTop -= end.y - start.y;
        }
        return;
      }
      pendingPinchRef.current = anchor ? { anchor, target: end, zoom: nextZoom } : null;
      setZoom(nextZoom);
    },
  });

  const toggleFullscreen = () => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement === root) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void root.requestFullscreen().catch(() => {
      toast.error("Full screen is not available in this browser.");
    });
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const shownPage = Math.min(currentPage, Math.max(numPages, 1));

  let body: React.ReactNode = null;
  if (error) {
    body = (
      <PdfReaderMessage tone="error" onRetry={onRetry}>
        {error}
      </PdfReaderMessage>
    );
  } else if (loading || !source) {
    body = <PdfReaderMessage tone="loading">Loading document...</PdfReaderMessage>;
  } else if (pageWidth > 0) {
    body =
      source.kind === "pdf" ? (
        <Suspense fallback={<PdfReaderMessage tone="loading">Loading document...</PdfReaderMessage>}>
          <PdfReaderDocument key={source.url} url={source.url} />
        </Suspense>
      ) : (
        <ImagePages source={source} />
      );
  }

  return (
    <PdfReaderContext.Provider value={contextValue}>
      <div ref={rootRef} className={`${styles.root} ${className ?? ""}`}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <Title className={styles.title}>{title}</Title>
            {note && <span className={styles.note}>{note}</span>}
          </div>

          <div className={styles.controls} role="group" aria-label="Reader controls">
            <div className={styles.pageControl}>
              <input
                className={styles.pageInput}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={numPages > 0 ? `Page number, of ${numPages}` : "Page number"}
                value={pageDraft ?? String(shownPage)}
                disabled={numPages === 0}
                onChange={(event) => setPageDraft(event.target.value.replace(/\D/g, ""))}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => setPageDraft(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPageDraft();
                  }
                }}
              />
              <span aria-hidden="true">/ {numPages > 0 ? numPages : "-"}</span>
            </div>

            <span className={styles.divider} aria-hidden="true" />

            <div className={styles.zoomGroup}>
              <Button
                variant="ghost"
                size="icon"
                className={styles.iconButton}
                onClick={() => zoomBy(-ZOOM_STEP)}
                disabled={activeZoom <= MIN_ZOOM}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut />
              </Button>
              <button
                type="button"
                className={styles.zoomValue}
                onClick={() => setZoom(1)}
                aria-label={`Zoom ${Math.round(activeZoom * 100)} percent. Reset to fit width`}
                title="Reset to fit width"
              >
                {Math.round(activeZoom * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                className={styles.iconButton}
                onClick={() => zoomBy(ZOOM_STEP)}
                disabled={activeZoom >= maxZoom}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn />
              </Button>
            </div>

            {(openInNewTabHref || canFullscreen) && (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles.actions}>
                  {openInNewTabHref && (
                    <Button variant="ghost" size="icon" className={styles.iconButton} asChild>
                      <a
                        href={openInNewTabHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open in new tab"
                        title="Open in new tab"
                      >
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                  {canFullscreen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={styles.iconButton}
                      onClick={toggleFullscreen}
                      aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                      title={isFullscreen ? "Exit full screen" : "Full screen"}
                    >
                      {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Outside the controls so phones can keep it beside the title while the controls take their own row. */}
          {onClose && (
            <div className={styles.closeSlot}>
              <span className={styles.divider} aria-hidden="true" />
              <Button
                variant="ghost"
                size="icon"
                className={styles.iconButton}
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <X />
              </Button>
            </div>
          )}

          <div className={styles.progress} aria-hidden="true">
            <div ref={progressRef} className={styles.progressFill} />
          </div>
        </header>

        <div
          ref={scrollRef}
          className={`${styles.scroll} ${restricted ? styles.restricted : ""}`}
          role="region"
          aria-label="Document pages"
          tabIndex={0}
          data-pdf-scroll=""
          onScroll={scheduleMeasure}
          onContextMenu={restricted ? handleContextMenu : undefined}
        >
          <div ref={pagesFrameRef} className={styles.frame}>
            {body}
          </div>
        </div>
      </div>
    </PdfReaderContext.Provider>
  );
};
