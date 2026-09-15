import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderIds: z
    .array(z.number().int().positive())
    .min(1, "Select at least one order.")
    .max(1000, "You can download at most 1000 invoices at once."),
});

export type InputType = z.infer<typeof schema>;

export type ErrorOutputType = {
  error: string;
};

export const postAdminOrdersInvoiceZip = async (
  body: InputType,
  init?: RequestInit
): Promise<Blob> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/orders/invoice-zip`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<ErrorOutputType>(await result.text());
    throw new Error(errorObject.error);
  }

  if (result.headers.get("Content-Type") !== "application/zip") {
    throw new Error("Server did not return a ZIP file.");
  }

  return result.blob();
};
