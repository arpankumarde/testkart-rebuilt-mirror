import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2Client";
import { R2_BUCKET_NAME, R2_PUBLIC_URL } from "./_publicConfigs";
import { extractR2Key } from "./extractR2Key";
import { isRealFileUrl, PDF_UNREADABLE_MESSAGE, ProductRuleError } from "./digitalProductRules";

// pdf.js accepts a %PDF- header anywhere in the first 1024 bytes, so the check reads the same window.
const PDF_HEADER_WINDOW = 1024;

export type StudyNoteFileRef = { title?: string | null; fileUrl: string };

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, PDF_HEADER_WINDOW)).includes("%PDF-");
}

const fileLabel = (file: StudyNoteFileRef): string =>
  file.title?.trim() ? `"${file.title.trim()}"` : "A file";

const safeDecode = (key: string): string => {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
};

// Returns null when the object does not exist.
async function readFileHead(key: string): Promise<Uint8Array | null> {
  try {
    const response = await getR2Client().send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Range: `bytes=0-${PDF_HEADER_WINDOW - 1}` })
    );
    return response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    // An empty object cannot satisfy a byte range.
    if (name === "InvalidRange") return new Uint8Array();
    throw error;
  }
}

export async function findStudyNoteFileProblem(file: StudyNoteFileRef): Promise<string | null> {
  if (!isRealFileUrl(file.fileUrl)) return null;
  if (!file.fileUrl.startsWith(`https://${R2_PUBLIC_URL}/`)) {
    return `${fileLabel(file)} was not uploaded to Testkart. Upload the PDF again.`;
  }
  const head = await readFileHead(safeDecode(extractR2Key(file.fileUrl)));
  if (!head) return `${fileLabel(file)} could not be found. Upload the PDF again.`;
  if (!hasPdfHeader(head)) return `${fileLabel(file)}: ${PDF_UNREADABLE_MESSAGE}`;
  return null;
}

// The upload checks run in the browser and trust the file name, so saves and
// publishes re-read the stored bytes: a photo or Word file renamed to .pdf fails here.
export async function assertStudyNoteFilesArePdfs(files: StudyNoteFileRef[]): Promise<void> {
  const problems = await Promise.all(files.map(findStudyNoteFileProblem));
  const first = problems.find((problem): problem is string => !!problem);
  if (first) throw new ProductRuleError(first);
}