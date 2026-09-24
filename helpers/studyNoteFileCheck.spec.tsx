import { findStudyNoteFileProblem, hasPdfHeader } from "./studyNoteFileCheck";
import { PLACEHOLDER_PDF_URL } from "./digitalProductRules";

const bytes = (text: string, prefix = 0) => new Uint8Array([...new Array(prefix).fill(0x20), ...Buffer.from(text)]);

describe("hasPdfHeader", () => {
  it("accepts a PDF header at the start or anywhere in the first 1 KB, like pdf.js", () => {
    expect(hasPdfHeader(bytes("%PDF-1.7\n"))).toBe(true);
    expect(hasPdfHeader(bytes("%PDF-1.4", 600))).toBe(true);
    expect(hasPdfHeader(bytes("%PDF-1.4", 1030))).toBe(false);
  });

  it("rejects images, Office files and empty files", () => {
    expect(hasPdfHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(hasPdfHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(hasPdfHeader(bytes("PK\u0003\u0004word/document.xml"))).toBe(false);
    expect(hasPdfHeader(new Uint8Array())).toBe(false);
  });
});

describe("findStudyNoteFileProblem", () => {
  it("skips placeholders and refuses links that are not Testkart uploads, without reading storage", async () => {
    expect(await findStudyNoteFileProblem({ fileUrl: PLACEHOLDER_PDF_URL })).toBe(null);
    expect(await findStudyNoteFileProblem({ title: "Notes", fileUrl: "https://www.google.com/notes.pdf" })).toBe(
      "\"Notes\" was not uploaded to Testkart. Upload the PDF again."
    );
  });
});