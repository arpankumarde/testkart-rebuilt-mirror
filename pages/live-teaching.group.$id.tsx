import { Navigate, useLocation, useParams } from "react-router-dom";
import { GROUP_LESSON_LIST_PATH, groupLessonPath } from "../helpers/groupLessonRoutes";

/* Retired URL. Live group class detail pages moved to /course/live/:id. */
export default function LegacyLiveTeachingGroupRedirect() {
  const { id = "" } = useParams<{ id: string }>();
  const { search } = useLocation();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) return <Navigate to={`${GROUP_LESSON_LIST_PATH}${search}`} replace={true} />;
  return <Navigate to={`${groupLessonPath(id)}${search}`} replace={true} />;
}
