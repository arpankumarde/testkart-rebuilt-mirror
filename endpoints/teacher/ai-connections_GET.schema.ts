import { z } from "zod";
import superjson from "superjson";
import type { AiConnection } from "../../helpers/aiConnectors";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  connections: AiConnection[];
};

export const getTeacherAiConnections = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/ai-connections`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};