import { sql } from "kysely";

/**
 * A catalogue filter for test series, study notes and courses: a row matches when
 * its languages list, or the legacy single language text, holds any requested name.
 */
export function matchesAnyLanguage(table: "mockTests" | "digitalProducts" | "courses", requested: readonly string[]) {
  const names = requested.map((name) => name.trim()).filter(Boolean);
  return sql<boolean>`(${sql.ref(`${table}.language`)} = ANY(${names}::text[]) OR ${sql.ref(`${table}.languages`)} && ${names}::text[])`;
}
