import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  transactionId: z.coerce.number().int().positive("Transaction ID must be a positive number."),
});

export type InputType = z.infer<typeof schema>;

export type ErrorOutputType = {
  error: string;
};

export const getAdminSubscriptionTransactionInvoice = async (
  params: InputType,
  init?: RequestInit
): Promise<Blob> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    transactionId: validatedParams.transactionId.toString(),
  });

  const result = await fetch(`/_api/admin/subscription-transactions/invoice?${searchParams.toString()}`, {
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
