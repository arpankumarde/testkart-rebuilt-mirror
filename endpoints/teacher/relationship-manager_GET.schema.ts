import { z } from "zod";
import superjson from "superjson";
import type { RelationshipManager } from "../../helpers/relationshipManager";

export const schema = z.object({});

export type OutputType = {
  /** The academy's relationship manager; a team manager sees the owner's. */
  manager: RelationshipManager | null;
};

export const getTeacherRelationshipManager = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/relationship-manager`, {
    method: "GET",
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
