export const Placeholder = {
  COURSE: "https://cdn.testkart.in/placeholders/course.jpg",
  TEST: "https://cdn.testkart.in/placeholders/test.jpg",
  LIVE: "https://cdn.testkart.in/placeholders/live.png",
  // NOTE is only the share-image (og/twitter) fallback on the study notes
  // detail page. Thumbnails for study notes are discontinued in the UI, so do
  // not wire this into TeacherProductCard; see the comment on
  // TeacherProductCardProps in components/HomepageContentSection.tsx.
  NOTE: "https://cdn.testkart.in/placeholders/notes.png",
} as const;