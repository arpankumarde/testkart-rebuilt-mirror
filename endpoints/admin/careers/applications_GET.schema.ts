import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type CareerApplicationOutput = {
  id: number;
  careerPostingId: number;
  careerTitle: string | null;
  name: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  resumeUrl: string | null;
  resumeFileId: string | null;
  coverLetter: string | null;
  createdAt: Date;
};

export type OutputType = {
  applications: CareerApplicationOutput[];
};

export const getCareerApplications = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/careers/applications`, {
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