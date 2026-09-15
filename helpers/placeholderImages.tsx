export const Placeholder = {
    COURSE: "https://cdn.testkart.in/placeholders/course.jpg",
  TEST: "https://cdn.testkart.in/placeholders/test.jpg",
  LIVE: "https://cdn.testkart.in/placeholders/live.png",
  // NOTE is intentionally unused — thumbnails for study notes / digital
  // products are discontinued site-wide. Do not wire this back into any
  // TeacherProductCard call for study notes; see the comment on
  // TeacherProductCardProps in components/HomepageContentSection.tsx.
  NOTE: "https://cdn.testkart.in/placeholders/notes.png",
} as const;