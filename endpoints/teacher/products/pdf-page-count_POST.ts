import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { R2_PUBLIC_URL } from "../../../helpers/_publicConfigs";
import { PDF_PASSWORD_PROTECTED_MESSAGE, PDF_UNREADABLE_MESSAGE } from "../../../helpers/digitalProductRules";
import { schema, OutputType } from "./pdf-page-count_POST.schema";
import superjson from "superjson";
import DOMMatrixPolyfill from "dommatrix";

// pdfjs-dist's Node ("legacy") build reaches for browser canvas globals
// (DOMMatrix/ImageData/Path2D) while parsing certain PDFs — anything with
// Type3 fonts, transform matrices, or non-trivial color spaces walks that
// code path even though we never render a page. Without these defined it
// throws "DOMMatrix is not defined" and the whole request 500s — which is
// why page counts silently never populated for real-world PDFs (a handful
// of trivial single-page test PDFs happened not to hit this path, masking
// the bug). We only ever call getDocument()/numPages/getTextContent(), so
// these just need to exist and be constructible — no real drawing occurs.
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}
if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(dataOrWidth: any, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === "number") {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height as number;
      }
    }
  };
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {
    constructor(_path?: any) {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    rect() {}
    arc() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    ellipse() {}
    addPath() {}
  };
}

// Uploaded PDFs are fetched cross-origin by the browser (from cdn.testkart.in)
// to count pages and pull a text preview for AI suggestions. That CDN
// doesn't send Access-Control-Allow-Origin, so the browser silently blocks
// the fetch — page counts stayed null and the "Suggest details from PDF"
// button never appeared. A server never enforces CORS on its own outbound
// fetches, so doing this analysis here sidesteps the problem entirely.
const MAX_BYTES = 60 * 1024 * 1024; // 60MB safety cap on analysis
const MAX_TEXT_PAGES = 5;
const MAX_TEXT_CHARS = 6000;

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Only ever fetch files we ourselves host — this must never become an
    // open server-side fetch proxy for arbitrary attacker-supplied URLs.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.fileUrl);
    } catch {
      return new Response(
        superjson.stringify({ error: "Invalid file URL" }),
        { status: 400 }
      );
    }
    if (parsedUrl.hostname !== R2_PUBLIC_URL) {
      return new Response(
        superjson.stringify({ error: "File URL is not hosted on an allowed domain" }),
        { status: 400 }
      );
    }

    const pdfRes = await fetch(input.fileUrl);
    if (!pdfRes.ok) {
      return new Response(
        superjson.stringify({ error: "Could not fetch the uploaded file" }),
        { status: 502 }
      );
    }

    const contentLength = Number(pdfRes.headers.get("content-length") || "0");
    if (contentLength > MAX_BYTES) {
      return new Response(
        superjson.stringify({ error: "File is too large to analyze" }),
        { status: 413 }
      );
    }

    const buf = new Uint8Array(await pdfRes.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return new Response(
        superjson.stringify({ error: "File is too large to analyze" }),
        { status: 413 }
      );
    }

    // The bundled server build leaves out pdf.js's worker file, so hand pdf.js the
    // worker module up front or every PDF fails with "Setting up fake worker failed".
    if (!(globalThis as any).pdfjsWorker) {
      // @ts-expect-error pdf.js ships no type declarations for its worker module
      (globalThis as any).pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    }
    const pdfjsModule: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfjsLib: any = typeof pdfjsModule.getDocument === "function" ? pdfjsModule : pdfjsModule.default;

    const loadingTask = pdfjsLib.getDocument({
      data: buf,
      isEvalSupported: false,
      disableFontFace: true,
    });
    let pdf: any;
    try {
      pdf = await loadingTask.promise;
    } catch (loadErr) {
      // 422 tells the editor to drop the file, since students could not open it either.
      const name = (loadErr as { name?: string } | null)?.name;
      if (name === "PasswordException" || name === "InvalidPDFException") {
        return new Response(
          superjson.stringify({
            error: name === "PasswordException" ? PDF_PASSWORD_PROTECTED_MESSAGE : PDF_UNREADABLE_MESSAGE,
          }),
          { status: 422 }
        );
      }
      throw loadErr;
    }
    const pageCount: number = pdf.numPages;

    let textPreview = "";
    try {
      const maxPages = Math.min(pageCount, MAX_TEXT_PAGES);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textPreview += content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ") + "\n";
        if (textPreview.length > MAX_TEXT_CHARS) break;
      }
      textPreview = textPreview.trim().slice(0, MAX_TEXT_CHARS);
    } catch (textErr) {
      console.error("Failed to extract PDF text preview:", textErr);
    }

    const output: OutputType = { pageCount, textPreview };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error analyzing PDF page count:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to analyze PDF", details: errorMessage }),
      { status: 500 }
    );
  }
}
