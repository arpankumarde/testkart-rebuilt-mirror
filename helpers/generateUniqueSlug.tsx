import { db } from "./db";
import { slugify } from "./slugify";
import { isSlugTaken } from "./assignUserSlug";

/**
 * Generates a slug from a display name that no student or teacher holds yet,
 * appending -2, -3, ... until one is free.
 *
 * @param displayName The account's display name
 * @returns A unique slug string
 */
export const generateUniqueSlug = async (displayName: string): Promise<string> => {
  const baseSlug = slugify(displayName) || "user";
  let uniqueSlug = baseSlug;
  let counter = 2;

  while (await isSlugTaken(db, uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return uniqueSlug;
};
