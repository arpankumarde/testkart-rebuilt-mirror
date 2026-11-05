import { Navigate, useLocation } from "react-router-dom";
import { GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";

/* Retired URL. Live group classes moved to /course/live. A private 1:1 session is still booked from the teacher's own profile. */
export default function LegacyLiveTeachingRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${GROUP_LESSON_LIST_PATH}${search}`} replace={true} />;
}
