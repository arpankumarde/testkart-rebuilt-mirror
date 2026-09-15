import { z } from "zod";

// This endpoint does not take any input.
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// The output is a raw XML string, not JSON.
export type OutputType = string;

/**
 * Fetches the dynamic sitemap.xml for the platform.
 * Note: This client function is provided for completeness but is not typically
 * used in the frontend, as sitemaps are for search engine crawlers.
 * It returns the raw XML content as a string.
 */
export const getSitemap = async (
  body?: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/sitemap`, {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(
      `Failed to fetch sitemap: ${result.status} ${result.statusText} - ${errorText}`
    );
  }

  return result.text();
};