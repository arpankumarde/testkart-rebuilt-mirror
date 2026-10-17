import { z } from "zod";

// This endpoint does not take any input.
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// The output is a raw XML string, not JSON.
export type OutputType = string;

/**
 * Fetches the sitemap INDEX for organisations, which fans out to the 5
 * type-specific organisation sitemaps (school, college, coaching,
 * university, other).
 * Note: provided for completeness - sitemaps are for search engine
 * crawlers, not typically fetched from the frontend.
 */
export const getOrganizationSitemapIndex = async (
  body?: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/sitemap-organizations`, {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(
      `Failed to fetch organisation sitemap index: ${result.status} ${result.statusText} - ${errorText}`
    );
  }

  return result.text();
};
