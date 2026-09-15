import { Buffer } from "buffer";
import { uploadToR2 } from "./r2Client";
import { IMAGEKIT_URL_ENDPOINT } from "./_publicConfigs";

function getContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

/**
 * Downloads a batch of files from ImageKit and uploads them to R2.
 */
export async function downloadAndUploadToR2(keys: string[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const key of keys) {
    try {
      const url = `${IMAGEKIT_URL_ENDPOINT}/${key}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = getContentType(key);

      await uploadToR2(key, buffer, contentType);
      success++;
    } catch (e) {
      failed++;
      errors.push(
        `Error processing key ${key}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
      console.error(`Failed to migrate key ${key}:`, e);
    }
  }

  return { success, failed, errors };
}