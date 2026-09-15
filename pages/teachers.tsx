import { Navigate } from "react-router-dom";

export default function TeachersRedirectPage() {
  return <Navigate to="/sell/mock-test" replace={true} />;
}