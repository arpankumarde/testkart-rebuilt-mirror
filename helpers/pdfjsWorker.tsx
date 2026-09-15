type Pdfjs = (typeof import("react-pdf"))["pdfjs"];

// The worker must be the same pdf.js build as react-pdf's API, or every document fails to open
// with a version mismatch. Takes pdfjs as an argument so callers can keep importing react-pdf lazily.
export function setPdfjsWorkerSrc(pdfjs: Pdfjs) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}