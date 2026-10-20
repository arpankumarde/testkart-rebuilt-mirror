import { Navigate } from "react-router-dom";

/* Retired admin URL: News & Events became Press. Keeps old bookmarks working. */
export default function LegacyAdminNewsRedirect() {
  return <Navigate to="/admin/press" replace={true} />;
}