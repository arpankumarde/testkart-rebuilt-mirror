import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SUPPORT_ATTACHMENT_MAX_FILES,
  supportAttachmentProblem,
  type SupportAttachment,
  type SupportAttachmentUploadInput,
} from "./supportAttachmentRules";

export type PendingSupportAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: "uploading" | "ready" | "failed";
  error?: string;
  attachment?: SupportAttachment;
};

type Uploader = (input: SupportAttachmentUploadInput) => Promise<SupportAttachment>;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

let nextId = 0;

/**
 * Files picked for a support message. Each one uploads as soon as it is picked; the message is sent
 * later with the links of the ones that finished.
 */
export function useSupportAttachmentUploads(upload: Uploader) {
  const [items, setItems] = useState<PendingSupportAttachment[]>([]);

  const update = useCallback((id: string, patch: Partial<PendingSupportAttachment>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted: File[] = [];
      for (const file of files) {
        const problem = supportAttachmentProblem(file);
        if (problem) toast.error(problem);
        else accepted.push(file);
      }

      const room = SUPPORT_ATTACHMENT_MAX_FILES - items.filter((item) => item.status !== "failed").length;
      if (accepted.length > room) {
        toast.error(`You can attach up to ${SUPPORT_ATTACHMENT_MAX_FILES} files to one message.`);
        accepted.splice(Math.max(room, 0));
      }

      for (const file of accepted) {
        const id = `support-file-${++nextId}`;
        setItems((previous) => [...previous, { id, fileName: file.name, sizeBytes: file.size, status: "uploading" }]);
        readAsDataUrl(file)
          .then((dataBase64) => upload({ fileName: file.name, dataBase64 }))
          .then((attachment) => update(id, { status: "ready", attachment }))
          .catch((error: unknown) =>
            update(id, {
              status: "failed",
              error: error instanceof Error && error.message ? error.message : "Upload failed. Remove it and try again.",
            })
          );
      }
    },
    [items, upload, update]
  );

  const remove = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const attachments = useMemo(
    () => items.flatMap((item) => (item.status === "ready" && item.attachment ? [item.attachment] : [])),
    [items]
  );

  return {
    items,
    attachments,
    isUploading: items.some((item) => item.status === "uploading"),
    hasFailed: items.some((item) => item.status === "failed"),
    addFiles,
    remove,
    clear,
  };
}