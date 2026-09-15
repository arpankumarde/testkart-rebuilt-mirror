import { TeacherRoute } from "../components/ProtectedRoute";

// Deliberately no TeacherDashboardLayout — this should look like the real
// student test portal, not the teacher admin shell, since it opens in its
// own tab as a stand-in for "what will a student actually see".
export default [TeacherRoute];
