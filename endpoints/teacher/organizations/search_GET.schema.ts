import { z } from "zod";
import superjson from "superjson";
import type { OrganizationTypeValue } from "./create_POST.schema";

export const schema = z.object({
  q: z.string().trim().min(1).max(120),
});

export type InputType = z.infer<typeof schema>;

export type OrganizationSearchResult = {
  id: number;
  name: string;
  slug: string;
  orgType: OrganizationTypeValue;
  logoUrl: string | null;
  location: string | null;
  teacherCount: number;
  /** Null when the requesting teacher has no relationship with this org yet. */
  membershipStatus: "pending" | "approved" | "rejected" | null;
};

export type OutputType = {
  results: OrganizationSearchResult[];
};

export const getTeacherOrganizationsSearch = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(query);
  const params = new URLSearchParams({ q: validatedInput.q });
  const result = await fetch(`/_api/teacher/organizations/search?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
