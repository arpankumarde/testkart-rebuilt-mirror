import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  members: {
    id: number;
    memberUserId: number;
    displayName: string;
    mobileNumber: string | null;
    avatarUrl: string | null;
    invitedPhone: string;
    status: string;
    role: string;
    createdAt: Date;
  }[];
};

export const getTeacherTeamList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/team/list`, {
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