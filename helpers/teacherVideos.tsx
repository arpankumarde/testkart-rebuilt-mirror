/**
 * Walkthrough videos for teachers, shown on /demo and linked from /teach.
 *
 * YouTube entries come from the Testkart channel (youtube.com/@Testkart-in).
 * "file" entries are the clips embedded in help-centre guides and play from
 * cdn.testkart.in. Titles are written as the task a teacher wants to do, not
 * the upload title. Durations are seconds.
 */
export const TESTKART_CHANNEL_URL = "https://www.youtube.com/@Testkart-in";

export type TeacherVideo = {
  id: string;
  title: string;
  durationSeconds: number;
  source: "youtube" | "file";
  /** Direct mp4 URL for "file" videos. */
  src?: string;
  /** Written guide in /help that covers the same task. */
  guideSlug?: string;
};

export type TeacherVideoGroup = {
  key: string;
  title: string;
  videos: TeacherVideo[];
};

export const TEACHER_VIDEO_GROUPS: TeacherVideoGroup[] = [
  {
    key: "tests",
    title: "Mock tests and test series",
    videos: [
      { id: "Jdz4LRGt2bQ", title: "Create a test series", durationSeconds: 308, source: "youtube", guideSlug: "how-to-create-a-test-series" },
      { id: "EriNQiRYFPM", title: "Publish a test series", durationSeconds: 204, source: "youtube" },
      { id: "huDQW8FJUBM", title: "Edit a test series", durationSeconds: 146, source: "youtube", guideSlug: "how-to-edit-unpublish-delete-test-series" },
      {
        id: "guide-test-series-students",
        title: "See who joined your test series",
        durationSeconds: 131,
        source: "file",
        src: "https://cdn.testkart.in/editor-videos/1f4ce866-3ed5-493e-b05b-f75287360f49.mp4",
        guideSlug: "manage-test-series-students-testkart",
      },
    ],
  },
  {
    key: "live",
    title: "Live tests",
    videos: [
      { id: "Q4rLMYnTQAc", title: "Create a live test", durationSeconds: 360, source: "youtube", guideSlug: "how-to-create-and-publish-a-live-test" },
      { id: "mwWm7eHIx4Q", title: "Edit a live test and its questions", durationSeconds: 123, source: "youtube", guideSlug: "helpmanaging-questions-in-a-live-test" },
    ],
  },
  {
    key: "notes",
    title: "Notes, PDFs and digital products",
    videos: [
      { id: "aQg3lFftXi8", title: "Upload notes and PDFs for sale", durationSeconds: 170, source: "youtube", guideSlug: "how-to-create-sell-notes-and-pdfs" },
      { id: "kusMbHXDz9k", title: "Edit or remove your notes and PDFs", durationSeconds: 123, source: "youtube" },
      { id: "2C7vYIhcsGw", title: "Create a digital product", durationSeconds: 227, source: "youtube" },
    ],
  },
  {
    key: "courses",
    title: "Video courses",
    videos: [
      { id: "saYB6NO7d9s", title: "Arrange a course into sections and lessons", durationSeconds: 235, source: "youtube", guideSlug: "how-to-structure-course-sections-lessons-content" },
    ],
  },
  {
    key: "account",
    title: "Payments and tools",
    videos: [
      { id: "u5QEBFyQqIM", title: "Add your bank account for payouts", durationSeconds: 176, source: "youtube", guideSlug: "how-to-withdraw-money-from-testkart" },
      { id: "GRzh-sJ2fJs", title: "Connect ChatGPT, Claude or Perplexity", durationSeconds: 441, source: "youtube", guideSlug: "connect-ai-assistant-testkart" },
    ],
  },
];

export const ALL_TEACHER_VIDEOS: TeacherVideo[] = TEACHER_VIDEO_GROUPS.flatMap((group) => group.videos);

export const findTeacherVideo = (id: string | null | undefined): TeacherVideo | undefined =>
  id ? ALL_TEACHER_VIDEOS.find((video) => video.id === id) : undefined;

/** Teacher testimonials and the founding story, shown on /teach. */
export const TEACHER_STORY_VIDEO: TeacherVideo = {
  id: "XUTSQl5cgs0",
  title: "Bihar se nikli ek unique kahani: how Testkart started",
  durationSeconds: 277,
  source: "youtube",
};

export const TEACHER_TESTIMONIAL_SHORTS: TeacherVideo[] = [
  { id: "1TtssJbN6mo", title: "What teachers say about Testkart", durationSeconds: 0, source: "youtube" },
  { id: "C_rlxVEm1cY", title: "A teacher on selling with Testkart", durationSeconds: 0, source: "youtube" },
];

export const formatVideoDuration = (seconds: number): string => {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
