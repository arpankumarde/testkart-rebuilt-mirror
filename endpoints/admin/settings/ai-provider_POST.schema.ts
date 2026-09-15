import { z } from "zod";
import superjson from "superjson";
import { AIProviderSchema } from "./ai-provider_GET.schema";

export const schema = z.object({
  aiProvider: AIProviderSchema,
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  message: string;
};

export const postUpdateAdminAiProvider = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/settings/ai-provider`, {
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