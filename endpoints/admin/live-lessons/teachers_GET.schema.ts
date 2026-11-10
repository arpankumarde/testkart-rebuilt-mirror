import superjson from "superjson";

export type LiveTeacherOption = { id: number; name: string };
export type OutputType = { teachers: LiveTeacherOption[] };

export const getAdminLiveTeachers = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-lessons/teachers`, {
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