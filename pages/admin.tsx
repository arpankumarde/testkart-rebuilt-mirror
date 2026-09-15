import { Navigate } from "react-router-dom";

export default function AdminRedirectPage() {
  return <Navigate to="/login" replace={true} />;
}
