import { z } from "zod";
import superjson from "superjson";
import { TestListItem } from "./list_GET.schema"; // Reusing the existing type

export const schema = z.object({
  examName: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  tests: TestListItem[];
};

export const getTestsByExamName = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (body.examName) {
    params.append("examName", body.examName);
  }

  const result = await fetch(`/_api/tests/by-subject?${params.toString()}`, {
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