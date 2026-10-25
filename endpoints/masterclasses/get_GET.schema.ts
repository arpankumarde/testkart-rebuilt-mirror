import { z } from "zod";
import superjson from "superjson";
import type { MasterclassPresenter } from "../../helpers/masterclassCoHosts";

export const schema = z.object({
  slug: z.string().min(1),
});
export type InputType = z.infer<typeof schema>;

export type MasterclassDetail = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImageUrl: string | null;
  hostName: string | null;
  hostTitle: string | null;
  hostImageUrl: string | null;
  /** Additional presenters, never including the primary host. */
  coHosts: MasterclassPresenter[];
  platformLabel: string | null;
  startTime: Date;
  durationMinutes: number | null;
  capacity: number | null;
  status: string;
  registrantCount: number;
  isPast: boolean;
  isFull: boolean;
  isRegistered: boolean;
  joinUrl: string | null;
  prefill: { name: string; email: string; phone: string | null } | null;
};

export type OutputType = {
  masterclass: MasterclassDetail;
};

export const getMasterclass = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(params);
  const searchParams = new URLSearchParams({ slug: validatedInput.slug });
  const result = await fetch(`/_api/masterclasses/get?${searchParams.toString()}`, {
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
