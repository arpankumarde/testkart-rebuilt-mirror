import { sql } from "kysely";
import { db } from "./db";
import { bookableTutorCondition } from "./bookableTutorCondition";
import type { OutputType } from "../endpoints/experts/subjects_GET.schema";

const MAX_SUBJECTS = 16;
/* Product formats tutors sometimes list as expertise; they are not subjects to browse by. */
const NOT_A_SUBJECT = "(mock test|test series|previous year|pyq)";

/**
 * Subjects and exams that bookable tutors list on their profiles, most common first, merged
 * case-insensitively, leaving out product formats such as "Mock Test Series". Only real tutor
 * data: a subject no bookable tutor lists never appears.
 * Shared by endpoints/experts/subjects_GET.ts and pages/expert.prefetch.ts.
 */
export async function fetchExpertSubjectsServer(): Promise<OutputType> {
  const { rows } = await sql<{ label: string; count: string }>`
    SELECT MIN(label) AS label, COUNT(DISTINCT tutor_id) AS count
    FROM (
      SELECT users.id AS tutor_id, btrim(subject.value) AS label
      FROM users
      CROSS JOIN LATERAL (
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(users.expertise_areas) = 'array' THEN users.expertise_areas ELSE '[]'::jsonb END
        ) AS value
        UNION ALL
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(users.teaching_categories) = 'array' THEN users.teaching_categories ELSE '[]'::jsonb END
        )
      ) AS subject
      WHERE ${bookableTutorCondition}
    ) AS listed
    WHERE label <> '' AND label !~* ${NOT_A_SUBJECT}
    GROUP BY lower(label)
    ORDER BY COUNT(DISTINCT tutor_id) DESC, MIN(label) ASC
    LIMIT ${MAX_SUBJECTS}
  `.execute(db);

  return {
    subjects: rows.map((r) => ({ label: r.label, count: Number(r.count) })),
  };
}