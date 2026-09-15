import { createHash } from "crypto";
import { R2_PUBLIC_URL } from "./_publicConfigs";
import { STUDY_NOTES_PDF_MAX_MB } from "./digitalProductRules";

const TARGET_WIDTH_PX = 1400;
const MAX_HEIGHT_PX = 2800;
const WEBP_QUALITY = 80;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_SOURCE_BYTES = STUDY_NOTES_PDF_MAX_MB * 1024 * 1024;

// The server build only packages files reachable through imports, so pdfium.wasm comes from the CDN
// copy of the installed version and must match its hash before it runs.
const PDFIUM_WASM_URL = "https://cdn.jsdelivr.net/npm/@hyzyla/pdfium@2.1.13/dist/pdfium.wasm";
const PDFIUM_WASM_SHA256 = "71aec412a303a0405baee21c3d6d3f30ad2033dc02444130fe476be3976e2d09";

// Password-protected, corrupt and oversized files: the page cannot be previewed, and retrying will not help.
export class PdfPreviewUnavailableError extends Error {}

export type RenderedPdfPreviewPage = {
  pageCount: number;
  image: { data: Uint8Array; width: number; height: number } | null;
};

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

async function downloadPdf(fileUrl: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Downloading ${fileUrl} returned ${response.status}`);
  }
  if (Number(response.headers.get("content-length") ?? "0") > MAX_SOURCE_BYTES) {
    await response.body?.cancel();
    throw new PdfPreviewUnavailableError("File is too large to preview");
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_SOURCE_BYTES) {
    throw new PdfPreviewUnavailableError("File is too large to preview");
  }
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

// Renders one page of a hosted PDF to WebP. pageCount is the document's page count; image is null when the
// page is past the end of the document.
export async function renderPdfPreviewPage(fileUrl: string, pageNumber: number): Promise<RenderedPdfPreviewPage> {
  let host: string | null = null;
  try {
    host = new URL(fileUrl).hostname;
  } catch {
    host = null;
  }
  if (host !== R2_PUBLIC_URL) {
    throw new Error("Preview source is not hosted on the public R2 domain");
  }

  const [pdfium, source] = await Promise.all([loadPdfium(), downloadPdf(fileUrl)]);

  let pdf: Awaited<ReturnType<PdfiumLibrary["loadDocument"]>>;
  try {
    pdf = await pdfium.loadDocument(source);
  } catch (error) {
    throw new PdfPreviewUnavailableError(error instanceof Error ? error.message : "Unreadable PDF");
  }

  try {
    const pageCount = pdf.getPageCount();
    if (pageNumber > pageCount) {
      return { pageCount, image: null };
    }

    const page = pdf.getPage(pageNumber - 1);
    const { originalWidth, originalHeight } = page.getOriginalSize();
    const scale = Math.min(TARGET_WIDTH_PX / originalWidth, MAX_HEIGHT_PX / originalHeight);
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new PdfPreviewUnavailableError("Page has no printable size");
    }

    const rendered = await page.render({ scale, render: encodeWebp });
    return { pageCount, image: { data: rendered.data, width: rendered.width, height: rendered.height } };
  } finally {
    pdf.destroy();
  }
}