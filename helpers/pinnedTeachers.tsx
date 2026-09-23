import { sql } from "kysely";

/**
 * Teachers whose published courses and study notes list first on the public
 * catalogue (courses/list, shop/list and their SSR counterparts) under the
 * popular and newest sorts. Price sorts stay strictly by price.
 * 15752: Dr. Mukesh Goyal (SWMG).
 */
export const PINNED_TEACHER_IDS = [15752];

export function pinnedTeacherFirst(teacherIdColumn: string) {
  return sql<number>`CASE WHEN ${sql.ref(teacherIdColumn)} IN (${sql.join(PINNED_TEACHER_IDS)}) THEN 0 ELSE 1 END`;
}

export function sortPinsTeachers(sort: string | undefined) {
  return PINNED_TEACHER_IDS.length > 0 && sort !== "price_asc" && sort !== "price_desc";
}