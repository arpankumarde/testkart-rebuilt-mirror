import { createHash } from "crypto";
import { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL } from "./_publicConfigs";
import { STUDY_NOTES_PDF_MAX_MB } from "./digitalProductRules";
import { extractR2Key } from "./extractR2Key";
import { getSignedDownloadUrl } from "./r2Client";

const TARGET_WIDTH_PX = 1600;
const MAX_HEIGHT_PX = 3200;
const WEBP_QUALITY = 80;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_SOURCE_BYTES = STUDY_NOTES_PDF_MAX_MB * 1024 * 1024;
const SOURCE_CACHE_MS = 10 * 60 * 1000;
const SIGNED_READ_SECONDS = 300;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const R2_PATH_STYLE_HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const STORAGE_HOSTS = new Set([
  R2_PUBLIC_URL,
  R2_PATH_STYLE_HOST,
  `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
]);

// The server build only packages files reachable through imports, so pdfium.wasm comes from the CDN
// copy of the installed version and must match its hash before it runs.
const PDFIUM_WASM_URL = "https://cdn.jsdelivr.net/npm/@hyzyla/pdfium@2.1.13/dist/pdfium.wasm";
const PDFIUM_WASM_SHA256 = "71aec412a303a0405baee21c3d6d3f30ad2033dc02444130fe476be3976e2d09";

// Password-protected, corrupt, oversized and foreign files: the page cannot be rendered, and retrying will not help.
export class PdfPreviewUnavailableError extends Error {}

export type RenderedPage = { pageNumber: number; data: Uint8Array; width: number; height: number };
export type RenderedPages = { pageCount: number; pages: RenderedPage[] };

type PdfiumLibrary = Awaited<ReturnType<(typeof import("@hyzyla/pdfium"))["PDFiumLibrary"]["init"]>>;

let pdfiumPromise: Promise<PdfiumLibrary> | null = null;

function loadPdfium(): Promise<PdfiumLibrary> {
  if (!pdfiumPromise) {
    pdfiumPromise = (async () => {
      const response = await fetch(PDFIUM_WASM_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`PDFium WASM download returned ${response.status}`);
      }
      const wasmBinary = await response.arrayBuffer();
      const digest = createHash("sha256").update(new Uint8Array(wasmBinary)).digest("hex");
      if (digest !== PDFIUM_WASM_SHA256) {
        throw new Error("PDFium WASM did not match its pinned hash");
      }
      const { PDFiumLibrary } = await import("@hyzyla/pdfium");
      return PDFiumLibrary.init({ wasmBinary });
    })().catch((error) => {
      pdfiumPromise = null;
      throw error;
    });
  }
  return pdfiumPromise;
}

function storageKeyOf(sourceUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new PdfPreviewUnavailableError("Source is not a storage URL");
  }
  if (!STORAGE_HOSTS.has(parsed.hostname)) {
    throw new PdfPreviewUnavailableError("Source is not hosted in our storage");
  }
  let key = extractR2Key(`${parsed.origin}${parsed.pathname}`);
  try {
    key = decodeURIComponent(key);
  } catch {
    // A malformed escape keeps the key as stored.
  }
  if (parsed.hostname === R2_PATH_STYLE_HOST && key.startsWith(`${R2_BUCKET_NAME}/`)) {
    key = key.slice(R2_BUCKET_NAME.length + 1);
  }
  return key;
}

const isImageSource = (sourceUrl: string) => {
  const path = sourceUrl.toLowerCase().split("?")[0].split("#")[0];
  return IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension));
};

// A warm server instance usually gets the next pages of the same document, so it keeps the last file it read.
let lastSource: { url: string; data: Uint8Array; at: number } | null = null;

async function downloadSource(sourceUrl: string): Promise<Uint8Array> {
  if (lastSource && lastSource.url === sourceUrl && Date.now() - lastSource.at < SOURCE_CACHE_MS) {
    return lastSource.data;
  }
  // Read through a short presigned storage link rather than the public domain, which blocks some folders.
  const signedUrl = await getSignedDownloadUrl(storageKeyOf(sourceUrl), SIGNED_READ_SECONDS);
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Downloading the source document returned ${response.status}`);
  }
  if (Number(response.headers.get("content-length") ?? "0") > MAX_SOURCE_BYTES) {
    await response.body?.cancel();
    throw new PdfPreviewUnavailableError("File is too large to render");
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_SOURCE_BYTES) {
    throw new PdfPreviewUnavailableError("File is too large to render");
  }
  lastSource = { url: sourceUrl, data, at: Date.now() };
  return data;
}

async function encodeWebp({ data, width, height }: { data: Uint8Array; width: number; height: number }) {
  // Copied before any await, since the bitmap is a view into PDFium's memory. PDFium hands back BGRA;
  // sharp reads raw input as RGBA.
  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const blue = pixels[i];
    pixels[i] = pixels[i + 2];
    pixels[i + 2] = blue;
  }
  const sharp = (await import("sharp")).default;
  const webp = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return new Uint8Array(webp);
}

async function renderImageSource(source: Uint8Array): Promise<RenderedPage> {
  const sharp = (await import("sharp")).default;
  try {
    const { data, info } = await sharp(source)
      .rotate()
      .resize({ width: TARGET_WIDTH_PX, height: MAX_HEIGHT_PX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { pageNumber: 1, data: new Uint8Array(data), width: info.width, height: info.height };
  } catch (error) {
    throw new PdfPreviewUnavailableError(error instanceof Error ? error.message : "Unreadable image");
  }
}

// Renders the given pages (ascending) of a stored PDF, or of a single stored image as page 1, to WebP.
// The first page is always rendered; later ones stop once the deadline passes. pageCount is the document's
// real page count, so pages past it are simply left out.
export async function renderDocumentPages(
  sourceUrl: string,
  pageNumbers: number[],
  deadline: number
): Promise<RenderedPages> {
  if (isImageSource(sourceUrl)) {
    const source = await downloadSource(sourceUrl);
    return { pageCount: 1, pages: pageNumbers.includes(1) ? [await renderImageSource(source)] : [] };
  }

  const [pdfium, source] = await Promise.all([loadPdfium(), downloadSource(sourceUrl)]);

  let pdf: Awaited<ReturnType<PdfiumLibrary["loadDocument"]>>;
  try {
    pdf = await pdfium.loadDocument(source);
  } catch (error) {
    throw new PdfPreviewUnavailableError(error instanceof Error ? error.message : "Unreadable PDF");
  }

  try {
    const pageCount = pdf.getPageCount();
    const pages: RenderedPage[] = [];
    for (const pageNumber of pageNumbers) {
      if (pageNumber > pageCount || (pages.length > 0 && Date.now() > deadline)) break;

      const page = pdf.getPage(pageNumber - 1);
      const { originalWidth, originalHeight } = page.getOriginalSize();
      const scale = Math.min(TARGET_WIDTH_PX / originalWidth, MAX_HEIGHT_PX / originalHeight);
      if (!Number.isFinite(scale) || scale <= 0) {
        throw new PdfPreviewUnavailableError("Page has no printable size");
      }

      const rendered = await page.render({ scale, render: encodeWebp });
      pages.push({ pageNumber, data: rendered.data, width: rendered.width, height: rendered.height });
    }
    return { pageCount, pages };
  } finally {
    pdf.destroy();
  }
}