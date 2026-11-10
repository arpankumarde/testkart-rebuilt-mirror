import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ kind: z.enum(["booking", "group"]), id: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

export type MaterialOut = {
  id: string;
  title: string;
  fileUrl: string | null;
  linkUrl: string | null;
  createdAt: Date;
};

export type OutputType = { materials: MaterialOut[] };

export const getMentorshipClassroomMaterials = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, id: String(input.id) });
  const result = await fetch(`/_api/mentorship/classroom/materials/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
