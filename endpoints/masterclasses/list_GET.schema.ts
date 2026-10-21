import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type MasterclassListItem = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  hostName: string | null;
  hostTitle: string | null;
  startTime: Date;
  durationMinutes: number | null;
  capacity: number | null;
  registrantCount: number;
  isPast: boolean;
};

export type OutputType = {
  masterclasses: MasterclassListItem[];
};

export const getMasterclasses = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/masterclasses/list`, {
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
