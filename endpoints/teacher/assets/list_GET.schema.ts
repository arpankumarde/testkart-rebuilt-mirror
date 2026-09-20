import { z } from "zod";
import superjson from "superjson";
import type { TeacherAsset } from "../../../helpers/teacherAssetFiles";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = { assets: TeacherAsset[] };

export const getTeacherAssetsList = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/assets/list`, {
    method: "GET",
    cache: "no-store",
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