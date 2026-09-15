import { Navigate } from "react-router-dom";

export default function TeachersLiveMockTestRedirect() {
  return <Navigate to="/sell/host-live-exam" replace={true} />;
}