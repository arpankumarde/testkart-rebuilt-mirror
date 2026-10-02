import {
  base64DecodedSize,
  decodeBase64,
  EDITOR_IMAGE_TYPE_MESSAGE,
  editorImageTooLargeMessage,
  normaliseBase64,
  sniffEditorImageType,
} from "./editorImageRules";
import { getPublicUrl, uploadToR2 } from "./r2Client";
import { getUploadLimits } from "./uploadSizeValidation";

const DATA_IMAGE_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=_-]+/g;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Moves every base64 image in article HTML to R2 under the given folder and swaps in the CDN link,
 * so posts never store image bytes in the database. Content without data images is returned as is.
 */
export async function offloadDataImages(html: string, folder: string): Promise<string> {
  const matches = [...new Set(html.match(DATA_IMAGE_PATTERN) ?? [])];
  if (matches.length === 0) return html;

  const { richTextImageMaxMb } = await getUploadLimits();
  const links = new Map<string, string>();

  await Promise.all(
    matches.map(async (dataUrl) => {
      const base64 = normaliseBase64(dataUrl);
      if (!base64) throw new Error("An embedded image is not valid base64.");
      if (base64DecodedSize(base64) > richTextImageMaxMb * 1024 * 1024) {
        throw new Error(editorImageTooLargeMessage(richTextImageMaxMb));
      }
      const bytes = decodeBase64(base64);
      const contentType = sniffEditorImageType(bytes);
      if (!contentType) throw new Error(EDITOR_IMAGE_TYPE_MESSAGE);

      const key = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
      await uploadToR2(key, bytes, contentType);
      links.set(dataUrl, getPublicUrl(key));
    })
  );

  return html.replace(DATA_IMAGE_PATTERN, (dataUrl) => links.get(dataUrl) ?? dataUrl);
}
