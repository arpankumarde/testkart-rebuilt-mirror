import { SharedLayout } from "../components/SharedLayout";
import { ExamSectionLayout } from "../components/ExamSectionLayout";

// Shared with the Important Links pages so the exam shell stays mounted
// while switching between them.
export default [SharedLayout, ExamSectionLayout];
