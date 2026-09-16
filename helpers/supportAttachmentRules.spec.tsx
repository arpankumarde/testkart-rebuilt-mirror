import {
  cleanSupportAttachmentName,
  hasSupportMessageContent,
  sniffSupportAttachment,
  SUPPORT_ATTACHMENT_KEY_PATTERN,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  supportAttachmentKey,
  supportAttachmentProblem,
  supportAttachmentSchema,
  supportMessageEmailHtml,
} from "./supportAttachmentRules";
import { schema as adminReplySchema } from "../endpoints/admin/support/thread/reply_POST.schema";
import { schema as teacherReplySchema } from "../endpoints/teacher/support/thread/reply_POST.schema";
import { schema as teacherCreateSchema } from "../endpoints/teacher/support/thread/create_POST.schema";

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], [0, 0]);
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04], [1, 2]);
const OLE = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], [0]);

const attachment = {
  key: "support-attachments/123e4567-e89b-12d3-a456-426614174000/invoice.pdf",
  url: "https://cdn.testkart.in/support-attachments/123e4567-e89b-12d3-a456-426614174000/invoice.pdf",
  fileName: "invoice.pdf",
  contentType: "application/pdf",
  sizeBytes: 2048,
};

describe("sniffSupportAttachment", () => {
  it("accepts files whose bytes match their extension", () => {
    expect(sniffSupportAttachment(PNG, "shot.png")).toEqual({ contentType: "image/png", extension: "png", inline: true });
    expect(sniffSupportAttachment(bytes(ascii("%PDF-1.7\n")), "a.pdf")).toEqual({
      contentType: "application/pdf",
      extension: "pdf",
      inline: true,
    });
    expect(sniffSupportAttachment(ZIP, "a.DOCX")?.extension).toBe("docx");
    expect(sniffSupportAttachment(OLE, "a.xls")?.contentType).toBe("application/vnd.ms-excel");
    expect(sniffSupportAttachment(bytes(ascii("a,b\n1,2")), "a.csv")).toEqual({
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
      inline: false,
    });
  });

  it("keeps an image's real type when the extension is wrong", () => {
    expect(sniffSupportAttachment(JPEG, "shot.png")).toEqual({ contentType: "image/jpeg", extension: "jpg", inline: true });
  });

  it("refuses mismatched bytes, binary text files, empty files and unlisted types", () => {
    const results = [
      sniffSupportAttachment(bytes(ascii("a,b")), "shot.png"),
      sniffSupportAttachment(ZIP, "a.pdf"),
      sniffSupportAttachment(PNG, "a.docx"),
      sniffSupportAttachment(bytes([1, 0, 2]), "a.csv"),
      sniffSupportAttachment(bytes(), "a.txt"),
      sniffSupportAttachment(bytes(ascii("<html><script></script>")), "a.html"),
      sniffSupportAttachment(bytes(ascii("<svg></svg>")), "a.svg"),
      sniffSupportAttachment(PNG, "noextension"),
    ];
    expect(results).toEqual([null, null, null, null, null, null, null, null]);
  });
});

describe("supportAttachmentKey", () => {
  it("builds keys the message endpoints accept, whatever the file name", () => {
    const names = ["Screenshot 2026-09-17 at 10.00.00.png", "हिंदी.pdf", "..docx", "x".repeat(300) + ".txt"];
    for (const name of names) {
      const key = supportAttachmentKey(name, name.split(".").pop() as string);
      expect(SUPPORT_ATTACHMENT_KEY_PATTERN.test(key)).withContext(key).toBeTrue();
    }
  });

  it("refuses keys outside the support folder", () => {
    expect(supportAttachmentSchema.safeParse({ ...attachment, key: "products/files/a.pdf" }).success).toBeFalse();
  });
});

describe("supportAttachmentProblem", () => {
  it("checks type and size before upload", () => {
    expect(supportAttachmentProblem({ name: "setup.exe", size: 10 })).toContain("can't be attached");
    expect(supportAttachmentProblem({ name: "big.pdf", size: SUPPORT_ATTACHMENT_MAX_BYTES + 1 })).toContain("4 MB");
    expect(supportAttachmentProblem({ name: "empty.png", size: 0 })).toContain("empty");
    expect(supportAttachmentProblem({ name: "ok.pdf", size: SUPPORT_ATTACHMENT_MAX_BYTES })).toBeNull();
  });

  it("cleans display names", () => {
    expect(cleanSupportAttachmentName("ab\nc.pdf")).toBe("abc.pdf");
    expect(cleanSupportAttachmentName(`a${String.fromCharCode(0, 31, 127)}b.pdf`)).toBe("ab.pdf");
    expect(cleanSupportAttachmentName("fee-receipt_2026-09.pdf")).toBe("fee-receipt_2026-09.pdf");
    expect(cleanSupportAttachmentName("   ")).toBe("file");
  });
});

describe("support message schemas", () => {
  it("allow a reply with text, files or both, but not neither", () => {
    for (const schema of [adminReplySchema, teacherReplySchema]) {
      expect(schema.safeParse({ threadId: 1, message: "hello" }).success).toBeTrue();
      expect(schema.safeParse({ threadId: 1, message: "", attachments: [attachment] }).success).toBeTrue();
      expect(schema.safeParse({ threadId: 1, message: "  " }).success).toBeFalse();
      expect(schema.safeParse({ threadId: 1, message: "", attachments: [] }).success).toBeFalse();
    }
    expect(hasSupportMessageContent("", undefined)).toBeFalse();
  });

  it("caps a message at five files", () => {
    const six = Array.from({ length: 6 }, (_, index) => ({ ...attachment, key: attachment.key.replace("invoice", `invoice${index}`) }));
    expect(adminReplySchema.safeParse({ threadId: 1, message: "x", attachments: six }).success).toBeFalse();
  });

  it("still accepts a new thread without attachments", () => {
    expect(teacherCreateSchema.safeParse({ subject: "Payout", message: "Where is it?" }).success).toBeTrue();
  });
});

describe("supportMessageEmailHtml", () => {
  it("escapes the message and file names and lists the links", () => {
    const html = supportMessageEmailHtml("hi <img src=x>\nline 2", [{ ...attachment, fileName: "<b>x</b>.pdf" }]);
    expect(html).toContain("hi &lt;img src=x&gt;<br>line 2");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;.pdf");
    expect(html).toContain(`href="${attachment.url}"`);
    expect(html).toContain("(2 KB)");
  });

  it("leaves out the message block for a file-only message", () => {
    const html = supportMessageEmailHtml("  ", [attachment]);
    expect(html).not.toContain("border:1px solid #E5E7EB");
    expect(html).toContain("Attachments");
  });
});