import { Navigate, useLocation, useParams } from "react-router-dom";
import { GROUP_LESSON_LIST_PATH, groupLessonPath } from "../helpers/groupLessonRoutes";

/* Retired URL. Live group class detail pages moved to /course/live/:id. */
export default function LegacyLiveTeachingGroupRedirect() {
  const { id = "" } = useParams<{ id: string }>();
  const { search } = useLocation();
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return <Navigate to={`${GROUP_LESSON_LIST_PATH}${search}`} replace={true} />;
  return <Navigate to={`${groupLessonPath(numericId)}${search}`} replace={true} />;
}
