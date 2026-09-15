import { R2_PUBLIC_URL, R2_ACCOUNT_ID, R2_BUCKET_NAME } from "./_publicConfigs";

// The AWS SDK's S3Client defaults to virtual-hosted-style addressing (no
// forcePathStyle set in r2Client.tsx), so presigned URLs from
// getSignedDownloadUrl actually come back as
// `{bucket}.{accountId}.r2.cloudflarestorage.com`, NOT the bare
// `{accountId}.r2.cloudflarestorage.com` this used to check for — that
// mismatch meant presigned preview URLs (student-facing "Preview" dialog)
// never matched the allowlist below, so toProxiedPdfUrl silently returned
// them unproxied and the browser's direct cross-origin fetch got blocked by
// R2's missing CORS headers. Checking both forms covers any code path that
// ends up using either style.
const R2_S3_HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_S3_VIRTUAL_HOSTED_HOST = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * Routes a PDF URL through our own same-origin proxy (endpoints/files/pdf-proxy)
 * when it points at a host we control — our R2 custom domain (cdn.testkart.in)
 * or the raw R2 S3 API host used for presigned download URLs. Neither sends
 * Access-Control-Allow-Origin, so react-pdf's direct cross-origin fetch is
 * silently blocked by the browser ("Failed to load PDF. The file may be
 * unavailable.") even though the file is perfectly fine. Proxying through our
 * own origin sidesteps that without needing any CDN/bucket config change.
 *
 * Any other URL (or a falsy value) is returned unchanged.
 */
export const toProxiedPdfUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === R2_PUBLIC_URL ||
      parsed.hostname === R2_S3_HOST ||
      parsed.hostname === R2_S3_VIRTUAL_HOSTED_HOST
    ) {
      return `/_api/files/pdf-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Not an absolute URL (e.g. already relative/proxied) — leave as-is.
  }
  return url;
};
