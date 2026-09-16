import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { R2_BUCKET_NAME } from "./_publicConfigs";
import { getPublicUrl, getR2Client, uploadToR2 } from "./r2Client";
import { base64DecodedSize, decodeBase64, normaliseBase64 } from "./editorImageRules";
import {
  cleanSupportAttachmentName,
  sniffSupportAttachment,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_TYPES_LABEL,
  supportAttachmentKey,
  supportAttachmentTooLargeMessage,
  type SupportAttachment,
  type SupportAttachmentUploadInput,
} from "./supportAttachmentRules";

export class SupportAttachmentError extends Error {}

function contentDisposition(inline: boolean, fileName: string, key: string): string {
  const fallback = key.slice(key.lastIndexOf("/") + 1);
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Checks a file's real type and size on the server, stores it in R2 and returns its public link. */
export async function storeSupportAttachment(input: SupportAttachmentUploadInput): Promise<SupportAttachment> {
  const fileName = cleanSupportAttachmentName(input.fileName);
  const base64 = normaliseBase64(input.dataBase64);
  if (!base64) throw new SupportAttachmentError("dataBase64 is not valid base64.");
  const size = base64DecodedSize(base64);
  if (size === 0) throw new SupportAttachmentError(`${fileName} is empty.`);
  if (size > SUPPORT_ATTACHMENT_MAX_BYTES) throw new SupportAttachmentError(supportAttachmentTooLargeMessage(fileName));

  const bytes = decodeBase64(base64);
  const kind = sniffSupportAttachment(bytes, fileName);
  if (!kind) {
    throw new SupportAttachmentError(
      `${fileName} can't be attached. Attach ${SUPPORT_ATTACHMENT_TYPES_LABEL}, and check the file is not damaged.`
    );
  }

  const key = supportAttachmentKey(fileName, kind.extension);
  await uploadToR2(key, bytes, kind.contentType, contentDisposition(kind.inline, fileName, key));
  return { key, url: getPublicUrl(key), fileName, contentType: kind.contentType, sizeBytes: bytes.byteLength };
}

/**
 * Confirms each attachment sent with a message was stored by the upload endpoint, taking its type and
 * size from R2 rather than from the request.
 */
export async function verifySupportAttachments(attachments: SupportAttachment[] | undefined): Promise<SupportAttachment[]> {
  const list = attachments ?? [];
  if (new Set(list.map((attachment) => attachment.key)).size !== list.length) {
    throw new SupportAttachmentError("The same file is attached twice.");
  }
  const client = getR2Client();
  return Promise.all(
    list.map(async (attachment) => {
      const fileName = cleanSupportAttachmentName(attachment.fileName);
      if (attachment.url !== getPublicUrl(attachment.key)) {
        throw new SupportAttachmentError(`The link for ${fileName} does not match its file.`);
      }
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: attachment.key }));
        return {
          ...attachment,
          fileName,
          contentType: head.ContentType ?? attachment.contentType,
          sizeBytes: head.ContentLength ?? attachment.sizeBytes,
        };
      } catch {
        throw new SupportAttachmentError(`${fileName} did not finish uploading. Remove it and attach it again.`);
      }
    })
  );
}

export async function insertSupportAttachments(
  trx: Transaction<DB>,
  messageId: number,
  attachments: SupportAttachment[]
): Promise<void> {
  if (attachments.length === 0) return;
  await trx
    .insertInto("supportMessageAttachments")
    .values(
      attachments.map((attachment) => ({
        messageId,
        fileKey: attachment.key,
        fileUrl: attachment.url,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      }))
    )
    .execute();
}

/** Every attachment in a thread, keyed by message id, in upload order. */
export async function loadThreadAttachments(threadId: number): Promise<Map<number, SupportAttachment[]>> {
  const rows = await db
    .selectFrom("supportMessageAttachments")
    .innerJoin("supportMessages", "supportMessages.id", "supportMessageAttachments.messageId")
    .where("supportMessages.threadId", "=", threadId)
    .select([
      "supportMessageAttachments.messageId",
      "supportMessageAttachments.fileKey",
      "supportMessageAttachments.fileUrl",
      "supportMessageAttachments.fileName",
      "supportMessageAttachments.contentType",
      "supportMessageAttachments.sizeBytes",
    ])
    .orderBy("supportMessageAttachments.id", "asc")
    .execute();

  const byMessage = new Map<number, SupportAttachment[]>();
  for (const row of rows) {
    const list = byMessage.get(row.messageId) ?? [];
    list.push({
      key: row.fileKey,
      url: row.fileUrl,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
    });
    byMessage.set(row.messageId, list);
  }
  return byMessage;
}