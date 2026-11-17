import { sql } from "kysely";
import { MENTORSHIP_MIN_CLASS_PRICE } from "./liveLessonConfig";

/**
 * A teacher listed in the tutor directory: active, onboarded, with a public slug (same gate as a
 * public profile, see endpoints/teachers/profile_GET.ts), approved for live teaching and with 1:1
 * classes switched on at prices that meet the floors - the same test
 * endpoints/mentorship/teacher-offerings_GET.ts uses to show the Book button. Its columns are
 * unqualified, so use it only in a query over teachers alone.
 */
export const bookableTutorCondition = sql<boolean>`(
  is_active = true
  AND onboarding_completed = true
  AND slug IS NOT NULL
  AND mentorship_enabled = true
  AND live_teaching_status = 'approved'
  AND COALESCE(mentorship_rate_per_unit, 0) >= ${MENTORSHIP_MIN_CLASS_PRICE[25]}
  AND COALESCE(mentorship_class_price60, 0) >= ${MENTORSHIP_MIN_CLASS_PRICE[50]}
)`;