import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { sanitizeOptionalHtml } from "../../../helpers/sanitizeHtml";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";
import { isRealFileUrl, PLACEHOLDER_PDF_URL } from "../../../helpers/digitalProductRules";

async function generateUniqueSlug(baseTitle: string): Promise<string> {
  // Leaves room for a -N suffix inside the 255-character slug column.
  const baseSlug = slugify(baseTitle).slice(0, 240).replace(/-+$/, "");
  
  const existingProduct = await db
    .selectFrom("digitalProducts")
    .select("id")
    .where("slug", "=", baseSlug)
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

    let examId: number | null = null;
    let examName: string | null = null;

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
        examId = exam.id;
        examName = exam.examName;
      } else {
        examId = null;
        examName = trimmedExamName;
      }
    }

    const slug = await generateUniqueSlug(input.title);

    // Only real uploads become file rows. A product created before its PDF
    // exists gets no row at all, so nothing can mistake it for a finished one.
    const realFiles = (input.files ?? []).filter((f) => isRealFileUrl(f.fileUrl));
    const filesToInsert = realFiles.length > 0
      ? realFiles.map((file) => ({
          title: file.title,
          fileUrl: file.fileUrl,
          fileId: file.fileId ?? null,
          fileSizeBytes: file.fileSizeBytes ?? null,
          pageCount: file.pageCount ?? null,
        }))
      : input.pdfUrl && isRealFileUrl(input.pdfUrl)
        ? [{
            title: input.title,
            fileUrl: input.pdfUrl,
            fileId: input.pdfFileId ?? null,
            fileSizeBytes: input.fileSizeBytes ?? null,
            pageCount: input.pageCount ?? null,
          }]
        : [];

    const firstFile = filesToInsert[0];
    const totalBytes = filesToInsert.reduce((sum, f) => sum + (f.fileSizeBytes ?? 0), 0);
    const totalPages = filesToInsert.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);

    const { newProduct, insertedFiles } = await db.transaction().execute(async (trx) => {
      const product = await trx
        .insertInto("digitalProducts")
        .values({
          teacherId: effectiveTeacherId,
          title: input.title,
          slug: slug,
          description: sanitizeOptionalHtml(input.description),
          shortDescription: input.shortDescription ?? null,
          price: input.price.toString(),
          thumbnailUrl: input.thumbnailUrl ?? null,
          thumbnailFileId: input.thumbnailFileId ?? null,
          pdfUrl: firstFile?.fileUrl ?? PLACEHOLDER_PDF_URL,
          pdfFileId: firstFile?.fileId ?? null,
          previewPages: input.previewPages ?? null,
          pageCount: totalPages || null,
          fileSizeBytes: firstFile ? totalBytes.toString() : null,
          language: input.language ?? null,
          category: input.category ?? null,
          tags: input.tags ?? null,
          examId: examId,
          examName: examName,
          status: "draft",
          isPublished: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const rows = filesToInsert.length > 0
        ? await trx
            .insertInto("digitalProductFiles")
            .values(
              filesToInsert.map((file, orderIndex) => ({
                productId: product.id,
                title: file.title,
                fileUrl: file.fileUrl,
                fileId: file.fileId,
                fileSizeBytes: file.fileSizeBytes?.toString() ?? null,
                pageCount: file.pageCount,
                orderIndex,
              }))
            )
            .returningAll()
            .execute()
        : [];

      return { newProduct: product, insertedFiles: rows };
    });

    const files: DigitalProductFileItem[] = insertedFiles.map((f) => ({
      id: f.id,
      title: f.title,
      fileUrl: f.fileUrl,
      fileId: f.fileId,
      fileSizeBytes: f.fileSizeBytes ? Number(f.fileSizeBytes) : null,
      pageCount: f.pageCount,
      orderIndex: f.orderIndex,
    }));

    const output: OutputType = {
      ...newProduct,
      price: Number(newProduct.price),
      rating: newProduct.rating ? Number(newProduct.rating) : null,
      fileSizeBytes: newProduct.fileSizeBytes ? Number(newProduct.fileSizeBytes) : null,
      files,
    };

    return new Response(superjson.stringify(output), { status: 201 });
  } catch (error) {
    console.error("Error creating digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to create product", details: errorMessage }),
      { status: 500 }
    );
  }
}