import React from "react";
import { Video } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { formatAssetDuration, formatAssetSize, type TeacherAsset } from "../helpers/teacherAssetFiles";
import styles from "./TeacherAssetPreview.module.css";

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
    // A dialog of its own, so the reader stays clickable when opened from inside another dialog.
    return <PdfReaderDialog isOpen onClose={onClose} title={asset.name} source={{ kind: "pdf", url: asset.url }} />;
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