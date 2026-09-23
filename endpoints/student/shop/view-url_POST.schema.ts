import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  productId: z.number().int().positive(),
  fileId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  signedUrl: string;
  expiresIn: number; // in seconds
  // The file's own title for a multi-file product, otherwise the product's, for the reader's header.
  title: string;
};

export const postStudentShopViewUrl = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/shop/view-url`, {
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
