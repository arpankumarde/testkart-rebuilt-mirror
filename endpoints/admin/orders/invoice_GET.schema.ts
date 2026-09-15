import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.coerce.number().int().positive("Order ID must be a positive number."),
});

export type InputType = z.infer<typeof schema>;

// The output is a PDF file (Blob on the client side), not JSON.
// We define an error type for failed requests.
export type ErrorOutputType = {
  error: string;
};

export const getAdminOrdersInvoice = async (
  params: InputType,
  init?: RequestInit
): Promise<Blob> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    orderId: validatedParams.orderId.toString(),
  });

  const result = await fetch(`/_api/admin/orders/invoice?${searchParams.toString()}`, {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const errorObject = superjson.parse<ErrorOutputType>(await result.text());
    throw new Error(errorObject.error);
  }

  if (result.headers.get("Content-Type") !== "application/pdf") {
    throw new Error("Server did not return a PDF file.");
  }

  return result.blob();
};