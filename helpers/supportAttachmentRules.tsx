/**
 * Rules for files attached to support messages, shared by the admin inbox, the teacher support page
 * and their endpoints. Free of server imports, so the browser bundle can use it.
 */
import { z } from "zod";
import { escapeHtmlAttribute } from "./escapeHtmlAttribute";
import { sniffEditorImageType } from "./editorImageRules";

export const SUPPORT_ATTACHMENT_FOLDER = "support-attachments";
export const SUPPORT_ATTACHMENT_MAX_FILES = 5;
/* Uploads go through our backend, which refuses bodies over 6 MiB. Base64 adds a third, so files stop at 4 MB. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_TYPES_LABEL = "images, PDF, Word, Excel, PowerPoint, CSV or text files";
export const SUPPORT_EMPTY_MESSAGE = "Write a message or attach a file.";

type Family = "image" | "pdf" | "ooxml" | "ole" | "text";

const EXTENSIONS: Record<string, { family: Family; contentType: string }> = {
  jpg: { family: "image", contentType: "image/jpeg" },
  jpeg: { family: "image", contentType: "image/jpeg" },
  png: { family: "image", contentType: "image/png" },
  gif: { family: "image", contentType: "image/gif" },
  webp: { family: "image", contentType: "image/webp" },
  pdf: { family: "pdf", contentType: "application/pdf" },
  doc: { family: "ole", contentType: "application/msword" },
  xls: { family: "ole", contentType: "application/vnd.ms-excel" },
  ppt: { family: "ole", contentType: "application/vnd.ms-powerpoint" },
  docx: { family: "ooxml", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { family: "ooxml", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { family: "ooxml", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  csv: { family: "text", contentType: "text/csv; charset=utf-8" },
  txt: { family: "text", contentType: "text/plain; charset=utf-8" },
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const SUPPORT_ATTACHMENT_ACCEPT = Object.keys(EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(",");

export const SUPPORT_ATTACHMENT_KEY_PATTERN =
  /^support-attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-]{1,60}\.[a-z]{3,4}$/;

export const supportAttachmentSchema = z.object({
  key: z.string().regex(SUPPORT_ATTACHMENT_KEY_PATTERN, "This attachment was not uploaded through support."),
  url: z.string().url(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});

export type SupportAttachment = z.infer<typeof supportAttachmentSchema>;

export const supportAttachmentsInputSchema = z
  .array(supportAttachmentSchema)
  .max(SUPPORT_ATTACHMENT_MAX_FILES, `Attach at most ${SUPPORT_ATTACHMENT_MAX_FILES} files to one message.`)
  .optional()
  .describe("Files returned by support/attachments/upload, sent with this message.");

export const supportAttachmentUploadSchema = z.object({
  fileName: z.string().trim().min(1, "fileName is required.").max(255),
  dataBase64: z.string().min(1, "dataBase64 is required.").describe("The file as base64, or as a data: URL."),
});

export type SupportAttachmentUploadInput = z.infer<typeof supportAttachmentUploadSchema>;

export function supportAttachmentExtension(fileName: string): string | null {
  const extension = /\.([A-Za-z0-9]+)$/.exec(fileName.trim())?.[1].toLowerCase();
  return extension && Object.prototype.hasOwnProperty.call(EXTENSIONS, extension) ? extension : null;
}

export function supportAttachmentTooLargeMessage(fileName: string): string {
  return `${fileName} is larger than 4 MB.`;
}

/** Why a picked file cannot be attached, or null. The browser checks this before uploading. */
export function supportAttachmentProblem(file: { name: string; size: number }): string | null {
  if (!supportAttachmentExtension(file.name)) {
    return `${file.name} can't be attached. Attach ${SUPPORT_ATTACHMENT_TYPES_LABEL}.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) return supportAttachmentTooLargeMessage(file.name);
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 1024);
  for (let index = 0; index + 4 < head.length; index++) {
    if (head[index] === 0x25 && head[index + 1] === 0x50 && head[index + 2] === 0x44 && head[index + 3] === 0x46 && head[index + 4] === 0x2d) {
      return true;
    }
  }
  return false;
}

/**
 * What the bytes will be stored as, or null when they are not the kind of file the name claims.
 * Images keep their real type even when the extension is wrong; nothing else is trusted by name.
 */
export function sniffSupportAttachment(
  bytes: Uint8Array,
  fileName: string
): { contentType: string; extension: string; inline: boolean } | null {
  const extension = supportAttachmentExtension(fileName);
  if (!extension || bytes.length === 0) return null;
  const rule = EXTENSIONS[extension];

  switch (rule.family) {
    case "image": {
      const imageType = sniffEditorImageType(bytes);
      return imageType ? { contentType: imageType, extension: IMAGE_EXTENSIONS[imageType], inline: true } : null;
    }
    case "pdf":
      return hasPdfHeader(bytes) ? { contentType: rule.contentType, extension, inline: true } : null;
    case "ooxml":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ? { contentType: rule.contentType, extension, inline: false } : null;
    case "ole":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
        ? { contentType: rule.contentType, extension, inline: false }
        : null;
    case "text":
      return bytes.subarray(0, 65536).includes(0) ? null : { contentType: rule.contentType, extension, inline: false };
  }
}

/** The name people see: control characters removed and the length capped. */
export function cleanSupportAttachmentName(fileName: string): string {
  const cleaned = fileName.replace(/\p{Cc}/gu, "").trim().slice(0, 200);
  return cleaned || "file";
}

export function supportAttachmentKey(fileName: string, extension: string): string {
  const base =
    fileName
      .replace(/\.[^.]*$/, "")
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  return `${SUPPORT_ATTACHMENT_FOLDER}/${crypto.randomUUID()}/${base}.${extension}`;
}

export function hasSupportMessageContent(message: string, attachments: unknown[] | undefined): boolean {
  return message.trim().length > 0 || (attachments?.length ?? 0) > 0;
}

export function isImageAttachment(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentTypeLabel(fileName: string): string {
  return supportAttachmentExtension(fileName)?.toUpperCase() ?? "File";
}

/** A message body for the notification emails, escaped, with line breaks kept. */
export function supportMessageEmailHtml(message: string, attachments: SupportAttachment[]): string {
  const parts: string[] = [];
  if (message.trim()) {
    parts.push(
      `<div style="background-color:#ffffff;border:1px solid #E5E7EB;padding:16px;border-radius:8px;">${escapeHtmlAttribute(message).replace(/\n/g, "<br>")}</div>`
    );
  }
  if (attachments.length > 0) {
    const items = attachments
      .map(
        (attachment) =>
          `<li style="margin:0 0 4px;"><a href="${escapeHtmlAttribute(attachment.url)}">${escapeHtmlAttribute(attachment.fileName)}</a> (${formatAttachmentSize(attachment.sizeBytes)})</li>`
      )
      .join("");
    parts.push(`<p style="margin:16px 0 8px;font-weight:600;">Attachments</p><ul style="margin:0;padding-left:20px;">${items}</ul>`);
  }
  return parts.join("");
}