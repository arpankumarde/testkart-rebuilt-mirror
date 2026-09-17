import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type TeamAcademy = {
  /** The teacherTeamMembers row id; an invitation is answered with it. */
  id: number;
  ownerName: string;
  academyName: string | null;
  ownerAvatarUrl: string | null;
  createdAt: Date;
};

export type OutputType = {
  /** The academy this teacher manages, when they are on someone's team. */
  membership: TeamAcademy | null;
  /** Invitations waiting for this teacher to accept or decline. */
  invitations: TeamAcademy[];
};

export const getTeacherTeamMe = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/team/me`, {
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