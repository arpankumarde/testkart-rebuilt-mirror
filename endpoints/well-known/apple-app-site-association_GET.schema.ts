import { z } from "zod";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;
export type OutputType = any;

export const getWellKnownAppleAppSiteAssociation = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/well-known/apple-app-site-association`, {
    method: "GET",
    ...init,
  });
  if (!result.ok) {
    throw new Error(await result.text());
  }
  return result.json();
};