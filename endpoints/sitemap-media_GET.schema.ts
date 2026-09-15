import { z } from "zod";

// This endpoint does not take any input.
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// The output is a raw XML string, not JSON.
export type OutputType = string;

/**
 * Fetches the dynamic image/video sitemap for the platform — thumbnail
 * images and intro/preview videos for mock tests, courses, study notes,
 * bundles, and blog/knowledge-base posts, grouped under each item's own
 * page URL per Google's image/video sitemap extension.
 * Note: This client function is provided for completeness but is not typically
 * used in the frontend, as sitemaps are for search engine crawlers.
 * It returns the raw XML content as a string.
 */
export const getMediaSitemap = async (
  body?: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/sitemap-media`, {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(
      `Failed to fetch media sitemap: ${result.status} ${result.statusText} - ${errorText}`
    );
  }

  return result.text();
};
