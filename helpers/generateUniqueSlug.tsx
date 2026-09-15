import { db } from "./db";
import { slugify } from "./slugify";

/**
 * Generates a unique slug for a user based on their display name.
 * If the generated base slug already exists, it appends a number (-2, -3, etc.)
 * until a unique slug is found.
 * 
 * @param displayName The user's display name
 * @returns A unique slug string
 */
export const generateUniqueSlug = async (displayName: string): Promise<string> => {
  const baseSlug = slugify(displayName) || "user";
  let uniqueSlug = baseSlug;
  let counter = 2;

  while (true) {
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("slug", "=", uniqueSlug)
      .executeTakeFirst();

    if (!existingUser) {
      return uniqueSlug;
    }

    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }
};