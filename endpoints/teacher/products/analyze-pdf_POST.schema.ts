import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  title: z.string().optional(),
  // Client-extracted text from the first few pages of the uploaded PDF
  // (via pdfjs, which is already loaded client-side for page-count
  // detection). Kept short deliberately — this is just enough for the
  // model to infer category/tags/exam, not a full-document analysis.
  extractedText: z.string().min(20, "Not enough text extracted from the PDF to analyze."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  category?: string;
  tags?: string[];
  examName?: string;
};

export const postTeacherProductsAnalyzePdf = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/analyze-pdf`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
