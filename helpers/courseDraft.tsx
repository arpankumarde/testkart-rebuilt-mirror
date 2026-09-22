/*
 * Shared by the teacher course editor and teacher/courses/publish, so the
 * checklist a teacher sees and the check the server runs never disagree.
 */

export const MIN_COURSE_DESCRIPTION_CHARS = 10;

// Written by the old "fill it myself" start screen as a stand-in description.
const PLACEHOLDER_DESCRIPTIONS = new Set(["draft course"]);

export const htmlToPlainText = (html: string | null | undefined): string =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

export const hasCourseDescription = (html: string | null | undefined): boolean => {
  const text = htmlToPlainText(html);
  return text.length >= MIN_COURSE_DESCRIPTION_CHARS && !PLACEHOLDER_DESCRIPTIONS.has(text.toLowerCase());
};

export type CourseReadinessKey = "lessons" | "cover" | "description";

export type CourseReadinessItem = {
  key: CourseReadinessKey;
  label: string;
  done: boolean;
};

export const getCourseReadiness = (course: {
  description: string | null | undefined;
  thumbnailImageUrl: string | null | undefined;
  introVideoUrl: string | null | undefined;
  lessonsCount: number;
}): CourseReadinessItem[] => [
  { key: "lessons", label: "At least one lesson", done: course.lessonsCount > 0 },
  {
    key: "cover",
    label: "Cover image or intro video",
    done: !!(course.thumbnailImageUrl || course.introVideoUrl),
  },
  { key: "description", label: "Course description", done: hasCourseDescription(course.description) },
];

type LessonLike = {
  contentType: string;
  contentUrl: string | null;
  textContent: string | null;
  durationMinutes: number | null;
};

export const lessonHasContent = (lesson: LessonLike): boolean =>
  lesson.contentType === "video" || lesson.contentType === "pdf" ? !!lesson.contentUrl : !!lesson.textContent;

export const countCourseLessons = (sections: { lessons: unknown[] }[]): number =>
  sections.reduce((total, section) => total + section.lessons.length, 0);

export const sumLessonMinutes = (lessons: LessonLike[]): number =>
  lessons.reduce((total, lesson) => total + (lesson.contentType === "video" ? lesson.durationMinutes ?? 0 : 0), 0);

export const formatCourseMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const pluralize = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;