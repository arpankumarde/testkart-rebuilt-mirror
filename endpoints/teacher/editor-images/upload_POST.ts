import superjson from "superjson";
import { ZodError } from "zod";
import { schema, OutputType } from "./upload_POST.schema";
import {
  base64DecodedSize,
  decodeBase64,
  EDITOR_IMAGE_TYPE_MESSAGE,
  editorImageKey,
  editorImageTooLargeMessage,
  editorImageUrlProblem,
  isPublicIpAddress,
  normaliseBase64,
  PRIVATE_ADDRESS_MESSAGE,
  sniffEditorImageType,
} from "../../../helpers/editorImageRules";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getPublicUrl, uploadToR2 } from "../../../helpers/r2Client";
import { getUploadLimits } from "../../../helpers/uploadSizeValidation";

const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const DNS_OVER_HTTPS_URL = "https://cloudflare-dns.com/dns-query";

class ImageDownloadError extends Error {}

/**
 * Refuses a host unless public DNS answers for it and every A and AAAA address is public, so names
 * that only resolve inside a private network are refused too. fetch resolves the name again, so an
 * answer that changes between the two lookups is not caught - nothing is stored unless the bytes
 * are a real image.
 */
async function assertPublicHost(hostname: string, signal: AbortSignal): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isPublicIpAddress(host)) return;

  const lookups = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const response = await fetch(`${DNS_OVER_HTTPS_URL}?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
        signal,
      });
      if (!response.ok) throw new ImageDownloadError("The image link's address could not be looked up.");
      const body = (await response.json()) as { Answer?: Array<{ type: number; data: string }> };
      return (body.Answer ?? []).filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data);
    })
  );
  const addresses = lookups.flat();
  if (addresses.length === 0) {
    throw new ImageDownloadError("The image link's host does not resolve to a public address.");
  }
  if (!addresses.every(isPublicIpAddress)) throw new ImageDownloadError(PRIVATE_ADDRESS_MESSAGE);
}

async function readWithinLimit(response: Response, maxMb: number): Promise<Uint8Array> {
  const maxBytes = maxMb * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > maxBytes || !response.body) {
    await response.body?.cancel();
    if (!response.body) return new Uint8Array(0);
    throw new ImageDownloadError(editorImageTooLargeMessage(maxMb));
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ImageDownloadError(editorImageTooLargeMessage(maxMb));
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Downloads a file from a public https link within the size limit, checking every redirect hop. */
async function downloadPublicImage(link: string, maxMb: number): Promise<Uint8Array> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ImageDownloadError("The image link is not a valid URL.");
  }
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const problem = editorImageUrlProblem(url);
      if (problem) throw new ImageDownloadError(problem);
      await assertPublicHost(url.hostname, signal);

      const response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { accept: "image/*", "user-agent": "TestkartImageImport/1.0 (+https://testkart.in)" },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ImageDownloadError(`The image link answered with HTTP ${response.status}.`);
      }
      return await readWithinLimit(response, maxMb);
    }
    throw new ImageDownloadError("The image link redirected too many times.");
  } catch (error) {
    if (error instanceof ImageDownloadError) throw error;
    if (signal.aborted) throw new ImageDownloadError("The image link took too long to answer.");
    throw new ImageDownloadError("The image link could not be reached.");
  }
}

function reply(body: unknown, status = 200): Response {
  return new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Stores an image for rich text from a link or base64, checking its real type and size on the server. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return reply({ error: "Only teachers can upload editor images." }, 403);
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const { richTextImageMaxMb } = await getUploadLimits();

    let bytes: Uint8Array;
    if (input.sourceUrl) {
      bytes = await downloadPublicImage(input.sourceUrl, richTextImageMaxMb);
    } else {
      const base64 = normaliseBase64(input.dataBase64 ?? "");
      if (!base64) return reply({ error: "dataBase64 is not valid base64." }, 400);
      if (base64DecodedSize(base64) > richTextImageMaxMb * 1024 * 1024) {
        return reply({ error: editorImageTooLargeMessage(richTextImageMaxMb) }, 400);
      }
      bytes = decodeBase64(base64);
    }

    const contentType = sniffEditorImageType(bytes);
    if (!contentType) return reply({ error: EDITOR_IMAGE_TYPE_MESSAGE }, 400);

    const key = editorImageKey(contentType);
    await uploadToR2(key, bytes, contentType);

    return reply({ url: getPublicUrl(key), key, contentType, sizeBytes: bytes.byteLength } satisfies OutputType);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return reply({ error: "Not authenticated" }, 401);
    if (error instanceof ImageDownloadError) return reply({ error: error.message }, 400);
    if (error instanceof ZodError) return reply({ error: error.errors }, 400);
    console.error("Editor image upload failed:", error);
    return reply({ error: "The image could not be uploaded." }, 500);
  }
}