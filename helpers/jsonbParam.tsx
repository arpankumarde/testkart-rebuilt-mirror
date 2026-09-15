import { sql, type RawBuilder } from "kysely";
import type { Json } from "./schema";

/**
 * Binds a value for a jsonb column. The postgres.js driver JSON-encodes every
 * parameter Postgres describes as jsonb, so a value that was already passed
 * through JSON.stringify lands as a jsonb string instead of an array or object.
 * Casting through text keeps the parameter a plain string that Postgres parses
 * exactly once.
 */
export const jsonbParam = (value: unknown): RawBuilder<Json> =>
  sql<Json>`${JSON.stringify(value ?? null)}::text::jsonb`;