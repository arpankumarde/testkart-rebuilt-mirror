import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../../helpers/schema";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<DigitalProducts>, "price" | "rating" | "fileSizeBytes"> & {
  price: number;
  rating: number | null;
  fileSizeBytes: number | null;
  files: DigitalProductFileItem[];
};

export const getTeacherProductDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/products/details?id=${params.id}`, {
    method: "GET",
    // A teacher can open this page seconds after creating/editing the
    // product — never let the browser/CDN serve a cached GET response here.
    cache: "no-store",
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