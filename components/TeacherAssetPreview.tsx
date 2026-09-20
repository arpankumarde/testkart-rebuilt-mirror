import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Video } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { Spinner } from "./Spinner";
import { formatAssetDuration, formatAssetSize, type TeacherAsset } from "../helpers/teacherAssetFiles";
import styles from "./TeacherAssetPreview.module.css";

const LazyPdfViewer = React.lazy(() => import("./ContentReviewPdfViewer"));

/*
 * Plain preview of a library file straight from storage. Library files are never
 * DRM protected; a video only goes to secure streaming once it is added to a
 * lesson of a teacher with DRM on.
 */
export const TeacherAssetPreview: React.FC<{
  asset: TeacherAsset | null;
  onClose: () => void;
}> = ({ asset, onClose }) => {
  if (!asset) return null;

  if (asset.kind === "pdf") {
    // Its own dialog layer, so the viewer stays clickable when opened from inside another dialog.
    return (
      <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content aria-describedby={undefined} className={styles.pdfLayer}>
            <DialogPrimitive.Title className={styles.srOnly}>{asset.name}</DialogPrimitive.Title>
            <React.Suspense
              fallback={
                <div className={styles.pdfLoading}>
                  <Spinner />
                </div>
              }
            >
              <LazyPdfViewer pdfUrl={asset.url} title={asset.name} onClose={onClose} />
            </React.Suspense>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  const meta = [formatAssetDuration(asset.durationSeconds), formatAssetSize(asset.sizeBytes)].filter(Boolean).join(" · ");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="xl">
        <ConsoleDialogHeader icon={<Video size={20} />} title={asset.name} description={meta || undefined} />
        <ConsoleDialogBody>
          <video
            key={asset.url}
            className={styles.video}
            src={asset.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            controlsList="nodownload"
          />
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>
  );
};