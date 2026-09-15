import { schema } from "./pdf-proxy_GET.schema";
import { R2_PUBLIC_URL, R2_ACCOUNT_ID, R2_BUCKET_NAME } from "../../helpers/_publicConfigs";

// r2Client.tsx's S3Client doesn't set forcePathStyle, so the SDK defaults to
// virtual-hosted-style addressing for presigned URLs:
// `{bucket}.{accountId}.r2.cloudflarestorage.com`, not the bare
// `{accountId}.r2.cloudflarestorage.com`. Both are allowlisted here so
// presigned preview URLs (student-facing preview) are recognized the same
// way as any other R2 URL this proxy already handles.
const R2_S3_HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_S3_VIRTUAL_HOSTED_HOST = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Streams a PDF back through our own origin so react-pdf's client-side
// <Document file={...}> can load it. Neither our R2 custom domain
// (cdn.testkart.in) nor the raw R2 S3 API host (used for presigned download
// URLs) sends Access-Control-Allow-Origin, so a direct cross-origin fetch
// from the browser is silently blocked. A server's own outbound fetch isn't
// subject to CORS at all, so proxying through here sidesteps the problem
// without needing any CDN/bucket configuration change.
//
// Only ever proxies our own hosts (checked below) — this must never become
// an open proxy for arbitrary attacker-supplied URLs.
export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const fileUrlParam = url.searchParams.get("url");
    if (!fileUrlParam) {
      return new Response("Missing url parameter", { status: 400 });
    }

    const input = schema.parse({ url: fileUrlParam });

    let parsedFileUrl: URL;
    try {
      parsedFileUrl = new URL(input.url);
    } catch {
      return new Response("Invalid file URL", { status: 400 });
    }

    if (
      parsedFileUrl.hostname !== R2_PUBLIC_URL &&
      parsedFileUrl.hostname !== R2_S3_HOST &&
      parsedFileUrl.hostname !== R2_S3_VIRTUAL_HOSTED_HOST
    ) {
      return new Response("File URL is not hosted on an allowed domain", { status: 400 });
    }

    // Forward Range so react-pdf/pdfjs can progressively load large PDFs
    // instead of always downloading the whole file up front.
    const upstreamHeaders: HeadersInit = {};
    const range = request.headers.get("range");
    if (range) upstreamHeaders["range"] = range;

    const upstreamRes = await fetch(input.url, { headers: upstreamHeaders });

    if (!upstreamRes.ok) {
      return new Response("Could not fetch the file", { status: upstreamRes.status === 404 ? 404 : 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstreamRes.headers.get("content-type") || "application/pdf");
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    const acceptRanges = upstreamRes.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
    // Presigned URLs expire in minutes, so this response must not be cached
    // long enough to outlive the signature (or, more importantly, to keep
    // serving a file after it's been replaced/removed).
    headers.set("Cache-Control", "private, max-age=60");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (error) {
    console.error("Error proxying PDF file:", error);
    return new Response("Failed to proxy file", { status: 500 });
  }
}
