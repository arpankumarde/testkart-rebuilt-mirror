import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type AdminMasterclassRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImageUrl: string | null;
  coverImageFileId: string | null;
  hostName: string | null;
  hostTitle: string | null;
  hostImageUrl: string | null;
  platformLabel: string | null;
  joinUrl: string | null;
  startTime: Date;
  durationMinutes: number | null;
  capacity: number | null;
  status: string;
  registrantCount: number;
  attendedCount: number;
  createdAt: Date | null;
};

export type OutputType = {
  masterclasses: AdminMasterclassRow[];
};

export const getAdminMasterclasses = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/masterclasses/list`, {
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
