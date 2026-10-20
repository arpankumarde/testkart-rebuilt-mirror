import { Navigate, useParams } from "react-router-dom";

/* Retired admin URL: the coverage editor moved to /admin/press/e/:id. */
export default function LegacyAdminNewsEditorRedirect() {
  const { id = "new" } = useParams<{ id: string }>();
  return <Navigate to={`/admin/press/e/${encodeURIComponent(id)}`} replace={true} />;
}