export const Placeholder = {
  COURSE: "https://cdn.testkart.in/placeholders/course.jpg",
  // TEST is also the Product JSON-LD image fallback on the test series detail page.
  TEST: "https://cdn.testkart.in/placeholders/test.jpg",
  LIVE: "https://cdn.testkart.in/placeholders/live.png",
  // NOTE is the share-image (og/twitter) and Product JSON-LD image fallback on
  // the study notes detail page and the thumbnail fallback for study notes listed on the bundle
  // details page (components/BundleDetailsView). Study-note thumbnails stay
  // discontinued on the cards, so do not wire this into TeacherProductCard;
  // see the comment on TeacherProductCardProps in
  // components/HomepageContentSection.tsx.
  NOTE: "https://cdn.testkart.in/placeholders/notes.png",
} as const;