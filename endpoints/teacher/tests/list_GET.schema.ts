import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TeacherTest = Omit<Selectable<MockTests>, "price" | "rating"> & {
  price: number;
  rating: number | null;
  testItemsCount: number;
  examSlug: string | null;
};

export type OutputType = TeacherTest[];

export const getTeacherTestsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/tests/list`, {
    method: "GET",
    cache: "no-store",
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