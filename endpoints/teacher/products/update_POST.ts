import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { sanitizeOptionalHtml } from "../../../helpers/sanitizeHtml";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";
import {
  isRealFileUrl,
  listProductFiles,
  syncProductFiles,
  ProductRuleError,
} from "../../../helpers/digitalProductRules";

async function generateUniqueSlug(baseTitle: string, currentId: number): Promise<string> {
  // Leaves room for a -N suffix inside the 255-character slug column.
  const baseSlug = slugify(baseTitle).slice(0, 240).replace(/-+$/, "");
  
  const existingProduct = await db
    .selectFrom("digitalProducts")
    .select("id")
    .where("slug", "=", baseSlug)
    .where("id", "!=", currentId)
    .executeTakeFirst();
  
  if (!existingProduct) {
    return baseSlug;
  }
  
  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existing = await db
      .selectFrom("digitalProducts")
      .select("id")
      .where("slug", "=", candidateSlug)
      .where("id", "!=", currentId)
      .executeTakeFirst();
    
    if (!existing) {
      return candidateSlug;
    }
    counter++;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existingProduct = await db
      .selectFrom("digitalProducts")
      .select(["id", "title", "slug", "isPublished"])
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!existingProduct) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    // A published product keeps its slug so its live URL does not break.
    let newSlug = existingProduct.slug;
    if (input.title && input.title !== existingProduct.title && !existingProduct.isPublished) {
      newSlug = await generateUniqueSlug(input.title, input.id);
    }

    const updateSet: Record<string, unknown> = {
      title: input.title,
      slug: newSlug,
      description: sanitizeOptionalHtml(input.description),
      shortDescription: input.shortDescription,
      price: input.price?.toString(),
      previewPages: input.previewPages,
      language: input.language,
      category: input.category,
      tags: input.tags,
      updatedAt: new Date(),
    };

    // The form has no thumbnail uploader, so an omitted field leaves the stored value alone.
    if (input.thumbnailUrl !== undefined) updateSet.thumbnailUrl = input.thumbnailUrl;
    if (input.thumbnailFileId !== undefined) updateSet.thumbnailFileId = input.thumbnailFileId;

    if (input.examName !== undefined) {
      if (input.examName && input.examName.trim() !== "") {
        const trimmedExamName = input.examName.trim();
        const exam = await db
          .selectFrom("exams")
          .select(["id", "examName"])
          .where((eb) =>
            eb.or([
              eb("examName", "ilike", trimmedExamName),
              eb("fullName", "ilike", trimmedExamName),
            ])
          )
          .executeTakeFirst();

        if (exam) {
          updateSet.examId = exam.id;
          updateSet.examName = exam.examName;
        } else {
          updateSet.examId = null;
          updateSet.examName = trimmedExamName;
        }
      } else {
        updateSet.examId = null;
        updateSet.examName = null;
      }
    }

    const { updatedProduct, files } = await db.transaction().execute(async (trx) => {
      let syncedFiles: DigitalProductFileItem[] | null = null;

      if (Array.isArray(input.files)) {
        syncedFiles = await syncProductFiles(trx, input.id, input.files);
      } else if (input.pdfUrl !== undefined && isRealFileUrl(input.pdfUrl)) {
        // Older clients send a single file as pdfUrl. A placeholder URL is
        // ignored so it can never overwrite a real file.
        const firstFileRow = await trx
          .selectFrom("digitalProductFiles")
          .select("id")
          .where("productId", "=", input.id)
          .orderBy("orderIndex", "asc")
          .limit(1)
          .executeTakeFirst();

        if (firstFileRow) {
          const updateFileSet: Record<string, unknown> = { fileUrl: input.pdfUrl };
          if (input.pdfFileId !== undefined) updateFileSet.fileId = input.pdfFileId;
          if (input.fileSizeBytes !== undefined) updateFileSet.fileSizeBytes = input.fileSizeBytes?.toString() ?? null;
          if (input.pageCount !== undefined) updateFileSet.pageCount = input.pageCount;
          if (input.title !== undefined) updateFileSet.title = input.title;
          await trx
            .updateTable("digitalProductFiles")
            .set(updateFileSet)
            .where("id", "=", firstFileRow.id)
            .execute();
        } else {
          await trx
            .insertInto("digitalProductFiles")
            .values({
              productId: input.id,
              title: input.title ?? existingProduct.title,
              fileUrl: input.pdfUrl,
              fileId: input.pdfFileId ?? null,
              fileSizeBytes: input.fileSizeBytes?.toString() ?? null,
              pageCount: input.pageCount ?? null,
              orderIndex: 0,
            })
            .execute();
        }
        syncedFiles = await listProductFiles(trx, input.id);
      }

      const realFiles = (syncedFiles ?? []).filter((f) => isRealFileUrl(f.fileUrl));
      if (realFiles.length > 0) {
        updateSet.pdfUrl = realFiles[0].fileUrl;
        updateSet.pdfFileId = realFiles[0].fileId;
        updateSet.fileSizeBytes = realFiles.reduce((sum, f) => sum + (f.fileSizeBytes ?? 0), 0).toString();
        updateSet.pageCount = realFiles.reduce((sum, f) => sum + (f.pageCount ?? 0), 0) || null;
      }

      const product = await trx
        .updateTable("digitalProducts")
        .set(updateSet)
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        updatedProduct: product,
        files: syncedFiles ?? (await listProductFiles(trx, input.id)),
      };
    });

    const output: OutputType = {
      ...updatedProduct,
      price: Number(updatedProduct.price),
      rating: updatedProduct.rating ? Number(updatedProduct.rating) : null,
      fileSizeBytes: updatedProduct.fileSizeBytes ? Number(updatedProduct.fileSizeBytes) : null,
      files,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ProductRuleError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    console.error("Error updating digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update product", details: errorMessage }),
      { status: 500 }
    );
  }
}
