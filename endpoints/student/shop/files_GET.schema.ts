import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  productId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  files: {
    id: number;
    title: string;
    fileSizeBytes: number | null;
    pageCount: number | null;
    orderIndex: number;
  }[];
};

export const getStudentShopFiles = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedQuery = schema.parse(query);
  const searchParams = new URLSearchParams();
  searchParams.set("productId", validatedQuery.productId.toString());

  const result = await fetch(`/_api/student/shop/files?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Accept": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    let errorMsg = "Failed to fetch files";
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      if (errorObject.error) errorMsg = errorObject.error;
    } catch (e) {
      // fallback if response isn't JSON
    }
    throw new Error(errorMsg);
  }

  return superjson.parse<OutputType>(await result.text());
};