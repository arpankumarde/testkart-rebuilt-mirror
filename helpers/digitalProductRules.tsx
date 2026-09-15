import type { Kysely } from "kysely";
import type { DB } from "./schema";
import type { DigitalProductFileItem } from "./digitalProductFileTypes";

export const DIGITAL_PRODUCT_CATEGORIES = [
  "Study Material",
  "Question Bank",
  "Notes",
  "eBooks",
  "Practice Papers",
  "Reference Material",
  "Other",
] as const;

// digital_products.pdf_url is NOT NULL, so a product saved before any PDF
// exists stores this stand-in. It must never count as a real file.
export const PLACEHOLDER_PDF_URL = "https://placeholder.pdf";

export const isRealFileUrl = (url?: string | null): boolean =>
  !!url && url.trim() !== "" && !url.toLowerCase().includes("placeholder");

// Ceiling for one study notes PDF. The admin upload limit can lower it but never raise it.
export const STUDY_NOTES_PDF_MAX_MB = 100;

export const PDF_PASSWORD_PROTECTED_MESSAGE =
  "This PDF is password-protected. Remove the password and upload the file again.";

export const PDF_UNREADABLE_MESSAGE =
  "This file could not be opened as a PDF. Save or export it as a PDF again and upload the new copy.";

export class ProductRuleError extends Error {}

export type PublishCandidate = {
  title: string | null | undefined;
  description: string | null | undefined;
  price: string | number | null | undefined;
  pdfUrl: string | null | undefined;
  fileUrls: string[];
};

// Kysely returns numeric columns as strings, so "0.00" is a valid free price
// and a falsiness test is meaningless here.
export const parsePrice = (price: string | number | null | undefined): number | null => {
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "number" ? price : Number(price);
  return Number.isFinite(n) ? n : null;
};

export function getProductPublishIssues(product: PublishCandidate): string[] {
  const issues: string[] = [];
  if (!product.title || product.title.trim().length < 3) issues.push("add a title");
  const descriptionText = (product.description ?? "").replace(/<[^>]*>?/gm, "").trim();
  if (descriptionText.length === 0) issues.push("add a description");
  const price = parsePrice(product.price);
  if (price === null || price < 0) issues.push("set a price (0 for free)");
  const hasRealFile =
    product.fileUrls.length > 0
      ? product.fileUrls.some(isRealFileUrl)
      : isRealFileUrl(product.pdfUrl);
  if (!hasRealFile) issues.push("upload at least one PDF file");
  return issues;
}

export const formatPublishIssues = (issues: string[]): string => {
  const text = issues.length > 1
    ? `${issues.slice(0, -1).join(", ")} and ${issues[issues.length - 1]}`
    : issues[0] ?? "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export type ExistingFileRow = { id: number; fileUrl: string };

export type IncomingFile = {
  id?: number | null;
  title: string;
  fileUrl: string;
  fileId?: string | null;
  fileSizeBytes?: number | null;
  pageCount?: number | null;
};

export type FileSyncPlan = {
  updates: { id: number; file: IncomingFile; orderIndex: number }[];
  inserts: { file: IncomingFile; orderIndex: number }[];
  deleteIds: number[];
  hadRealFiles: boolean;
  keepsRealFiles: boolean;
};

// Student downloads, the reader and the app's offline cache all address a file
// by its digital_product_files.id, so a save must keep ids stable: rows the
// client sent back are updated in place, rows sent without an id (older
// clients) are matched by URL, and only true additions and removals change.
export function planProductFileSync(existing: ExistingFileRow[], incoming: IncomingFile[]): FileSyncPlan {
  const real = incoming.filter((f) => isRealFileUrl(f.fileUrl));
  const unclaimed = new Map(existing.map((row) => [row.id, row]));
  const matched: (number | null)[] = real.map((f) => {
    if (f.id && unclaimed.has(f.id)) {
      unclaimed.delete(f.id);
      return f.id;
    }
    return null;
  });
  real.forEach((f, i) => {
    if (matched[i] !== null) return;
    for (const row of unclaimed.values()) {
      if (row.fileUrl === f.fileUrl) {
        unclaimed.delete(row.id);
        matched[i] = row.id;
        return;
      }
    }
  });

  const updates: FileSyncPlan["updates"] = [];
  const inserts: FileSyncPlan["inserts"] = [];
  real.forEach((file, orderIndex) => {
    const id = matched[orderIndex];
    if (id !== null) updates.push({ id, file, orderIndex });
    else inserts.push({ file, orderIndex });
  });

  return {
    updates,
    inserts,
    deleteIds: Array.from(unclaimed.keys()),
    hadRealFiles: existing.some((row) => isRealFileUrl(row.fileUrl)),
    keepsRealFiles: real.length > 0,
  };
}

const toFileItem = (f: {
  id: number;
  title: string;
  fileUrl: string;
  fileId: string | null;
  fileSizeBytes: string | number | bigint | null;
  pageCount: number | null;
  orderIndex: number;
}): DigitalProductFileItem => ({
  id: f.id,
  title: f.title,
  fileUrl: f.fileUrl,
  fileId: f.fileId,
  fileSizeBytes: f.fileSizeBytes ? Number(f.fileSizeBytes) : null,
  pageCount: f.pageCount,
  orderIndex: f.orderIndex,
});

export async function listProductFiles(trx: Kysely<DB>, productId: number): Promise<DigitalProductFileItem[]> {
  const rows = await trx
    .selectFrom("digitalProductFiles")
    .selectAll()
    .where("productId", "=", productId)
    .orderBy("orderIndex", "asc")
    .orderBy("id", "asc")
    .execute();
  return rows.map(toFileItem);
}

export async function syncProductFiles(
  trx: Kysely<DB>,
  productId: number,
  incoming: IncomingFile[]
): Promise<DigitalProductFileItem[]> {
  const existing = await trx
    .selectFrom("digitalProductFiles")
    .select(["id", "fileUrl"])
    .where("productId", "=", productId)
    .execute();

  const plan = planProductFileSync(existing, incoming);
  if (plan.hadRealFiles && !plan.keepsRealFiles) {
    throw new ProductRuleError(
      "This save would remove every PDF from the product. Replace a file instead of removing the last one."
    );
  }

  if (plan.deleteIds.length > 0) {
    await trx
      .deleteFrom("digitalProductFiles")
      .where("productId", "=", productId)
      .where("id", "in", plan.deleteIds)
      .execute();
  }

  for (const { id, file, orderIndex } of plan.updates) {
    await trx
      .updateTable("digitalProductFiles")
      .set({
        title: file.title,
        fileUrl: file.fileUrl,
        fileId: file.fileId ?? null,
        fileSizeBytes: file.fileSizeBytes?.toString() ?? null,
        pageCount: file.pageCount ?? null,
        orderIndex,
      })
      .where("id", "=", id)
      .where("productId", "=", productId)
      .execute();
  }

  if (plan.inserts.length > 0) {
    await trx
      .insertInto("digitalProductFiles")
      .values(
        plan.inserts.map(({ file, orderIndex }) => ({
          productId,
          title: file.title,
          fileUrl: file.fileUrl,
          fileId: file.fileId ?? null,
          fileSizeBytes: file.fileSizeBytes?.toString() ?? null,
          pageCount: file.pageCount ?? null,
          orderIndex,
        }))
      )
      .execute();
  }

  return listProductFiles(trx, productId);
}
