import { z } from "zod";
import { ContentVisibilityArrayValues, type ContentVisibility } from "./schema";

/*
 * Every teacher item - test series, live test, course, study note, bundle - is
 * public or unlisted. Public is the default and follows the usual publish and
 * review workflow. Unlisted goes live at once without review, opens from its
 * normal URL for anyone who has the link, and is kept out of every discovery
 * surface: search, listings, category and exam pages, teacher and institute
 * profiles, homepage sections, recommendations, sitemaps and search engines.
 *
 * The rule is enforced on the server. Any query that shows items to someone
 * who did not arrive through the item's own link filters on
 * visibility = "public"; detail endpoints keep serving unlisted items and mark
 * their pages noindex. Server-side transitions live in
 * helpers/contentVisibilityServer.
 */

export const DEFAULT_CONTENT_VISIBILITY: ContentVisibility = "public";

/** Optional visibility on create endpoints; left out, new content is public. */
export const visibilityInputSchema = z
  .enum(ContentVisibilityArrayValues)
  .optional()
  .describe("public (default, reviewed and listed) or unlisted (live at once from its link, never listed)");

export const VISIBILITY_OPTIONS: { value: ContentVisibility; label: string; description: string }[] = [
  {
    value: "public",
    label: "Public",
    description: "Shows in search, categories and your profile. Follows the usual publishing and review steps.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description:
      "Only people with the link can open it. Goes live at once without review, and stays out of search, listings, your profile and search engines.",
  },
];

export const UNLISTED_LABEL = "Unlisted";

export const UNLISTED_HINT = "Anyone with the link can open and share it. It is not password protected.";