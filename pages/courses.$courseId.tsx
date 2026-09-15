import { Navigate, useParams } from "react-router-dom";

// This route ("/courses/:courseId") used to fully duplicate the canonical
// course detail page ("/course/:courseSlug") — same component, same data,
// two indexable URLs. The lookup here always queried by slug, so a numeric
// course id (the only thing ever linked to this route) never actually
// resolved; it silently rendered a "Course Not Found" shell instead of
// content. Rather than keep serving that soft-404 duplicate, this route now
// redirects to the course hub. The one internal link that pointed here
// (expert.$teacherSlug.tsx's structured data) has been fixed to link
// directly to the canonical /course/:slug URL.
export default function CoursesLegacyRedirectPage() {
  return <Navigate to="/course" replace={true} />;
}
