import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    kind: z.enum(["booking", "group"]),
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    fileUrl: z.string().optional(),
    fileId: z.string().optional(),
    linkUrl: z.string().url().optional(),
  })
  .refine((v) => !!v.fileUrl || !!v.linkUrl, { message: "Provide a file or a link" });

export type InputType = z.infer<typeof schema>;
export type OutputType = { id: string };

export const postMentorshipClassroomMaterialAdd = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/classroom/materials/add`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
