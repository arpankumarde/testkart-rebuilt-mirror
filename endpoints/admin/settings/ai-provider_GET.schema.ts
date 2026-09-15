import { z } from "zod";
import superjson from "superjson";

export const AIProviderSchema = z.enum(["openai", "deepseek"]);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const schema = z.object({});

export type OutputType = {
  aiProvider: AIProvider;
  openaiConfigured: boolean;
  deepseekConfigured: boolean;
};

export const getAdminAiProvider = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/settings/ai-provider`, {
    method: "GET",
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