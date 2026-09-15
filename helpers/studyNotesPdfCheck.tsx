import { PDF_PASSWORD_PROTECTED_MESSAGE, PDF_UNREADABLE_MESSAGE } from "./digitalProductRules";
import { setPdfjsWorkerSrc } from "./pdfjsWorker";

export type StudyNotesPdfCheckResult = { error: string } | { file: File };

type Pdfjs = (typeof import("react-pdf"))["pdfjs"];
type PdfWorker = InstanceType<Pdfjs["PDFWorker"]>;
type LoadingTask = ReturnType<Pdfjs["getDocument"]>;
type OpenOutcome = "opened" | "password" | "invalid" | "unknown";

const PDF_MIME = "application/pdf";
const HEADER_SCAN_BYTES = 1024;
const INITIAL_RANGE_BYTES = 65536;
// The first check also downloads the pdf.js worker.
const OPEN_TIMEOUT_MS = 25000;

let workerHandle: Promise<{ pdfjs: Pdfjs; worker: PdfWorker }> | null = null;

const getWorker = () => {
  if (!workerHandle) {
    workerHandle = import("react-pdf")
      .then(async ({ pdfjs }) => {
        setPdfjsWorkerSrc(pdfjs);
        const worker = new pdfjs.PDFWorker();
        await worker.promise;
        return { pdfjs, worker };
      })
      .catch((err) => {
        workerHandle = null;
        throw err;
      });
  }
  return workerHandle;
};

const errorName = (err: unknown) =>
  typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";

async function openPdf(file: File): Promise<OpenOutcome> {
  const state: { task?: LoadingTask } = {};
  const attempt = (async (): Promise<OpenOutcome> => {
    const { pdfjs, worker } = await getWorker();
    const initial = new Uint8Array(await file.slice(0, Math.min(file.size, INITIAL_RANGE_BYTES)).arrayBuffer());
    const transport = new pdfjs.PDFDataRangeTransport(file.size, initial);
    // pdf.js asks only for the byte ranges it needs, so a large file is never read whole.
    transport.requestDataRange = (begin: number, end: number) => {
      file
        .slice(begin, end)
        .arrayBuffer()
        .then((buf) => transport.onDataRange(begin, new Uint8Array(buf)))
        .catch(() => undefined);
    };
    state.task = pdfjs.getDocument({
      range: transport,
      worker,
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
    });
    await state.task.promise;
    return "opened";
  })();
  attempt.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      attempt,
      new Promise<OpenOutcome>((resolve) => {
        timer = setTimeout(() => resolve("unknown"), OPEN_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    const name = errorName(err);
    if (name === "PasswordException") return "password";
    if (name === "InvalidPDFException") return "invalid";
    return "unknown";
  } finally {
    clearTimeout(timer);
    void state.task?.destroy();
  }
}

const hasPdfHeader = async (file: File) => {
  const head = new Uint8Array(await file.slice(0, HEADER_SCAN_BYTES).arrayBuffer());
  return new TextDecoder("latin1").decode(head).includes("%PDF-");
};

// Runs before a study notes PDF is uploaded. If pdf.js cannot be loaded the file is let
// through, and the server's page count check still rejects a password-protected PDF.
export async function checkStudyNotesPdf(file: File, maxMb: number): Promise<StudyNotesPdfCheckResult> {
  const hasPdfName = /\.pdf$/i.test(file.name);
  if (file.type.toLowerCase() !== PDF_MIME && !hasPdfName) {
    return { error: "Only PDF files can be uploaded." };
  }
  if (file.size === 0) return { error: "This file is empty." };
  if (file.size > maxMb * 1024 * 1024) return { error: `File size cannot exceed ${maxMb}MB.` };
  if (!(await hasPdfHeader(file))) {
    return { error: "This file is not a PDF. Only PDF files can be uploaded." };
  }

  const outcome = await openPdf(file);
  if (outcome === "password") return { error: PDF_PASSWORD_PROTECTED_MESSAGE };
  if (outcome === "invalid") return { error: PDF_UNREADABLE_MESSAGE };

  // The upload endpoint only accepts application/pdf with a .pdf name.
  if (file.type === PDF_MIME && hasPdfName) return { file };
  return { file: new File([file], hasPdfName ? file.name : `${file.name}.pdf`, { type: PDF_MIME }) };
}