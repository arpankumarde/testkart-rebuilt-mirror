/** Public live group lesson routes, shown to students as "live classes" on the /course marketplace. */
export const GROUP_LESSON_LIST_PATH = "/course/live";

export const groupLessonPath = (id: number): string => `${GROUP_LESSON_LIST_PATH}/${id}`;
