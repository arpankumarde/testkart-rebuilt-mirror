import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Spinner } from "../components/Spinner";
import { useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import { Button } from "../components/Button";
import { AIContentPrompt } from "../components/AIContentPrompt";
import { useAuth } from "../helpers/useAuth";
import styles from "./teacher.courses.create.module.css";

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { createCourseMutation } = useTeacherCourseMutations();
  const { authState } = useAuth();
  const teacherName =
    authState.type === "authenticated" ? authState.user.displayName : undefined;

  const [showAIPrompt, setShowAIPrompt] = useState(true);

  const createDraftCourse = (aiValues?: any) => {
    createCourseMutation.mutate(
      {
        title: aiValues?.title || "Untitled Course",
        description:
          aiValues?.shortDescription || aiValues?.description || "Draft course",
        category: aiValues?.category || "General",
        level:
          aiValues?.level === "advanced" || aiValues?.level === "intermediate"
            ? aiValues.level
            : "beginner",
        price: aiValues?.suggestedPrice || 0,
      },
      {
        onSuccess: (data) => {
          if (aiValues) {
            sessionStorage.setItem(
              "testkart_ai_course_data",
              JSON.stringify(aiValues)
            );
          }
          navigate(`/teacher/courses/${data.id}/edit`, {
            replace: true,
          });
        },
      }
    );
  };

  const handleGenerated = (data: any) => {
    setShowAIPrompt(false);
    createDraftCourse(data);
  };

  const handleSkip = () => {
    setShowAIPrompt(false);
    createDraftCourse();
  };

  return (
    <>
      <Helmet>
        <title>Create New Course | Testkart</title>
        <meta
          name="description"
          content="Create a new course on Testkart. Start building your curriculum and publish it to students."
        />
      </Helmet>
      {showAIPrompt ? (
        <AIContentPrompt
          contentType="course"
          teacherName={teacherName}
          onGenerated={handleGenerated}
          onSkip={handleSkip}
        />
      ) : (
        <div className={styles.status}>
          {createCourseMutation.isError ? (
            <>
              <p className={styles.error} role="alert">
                Could not start a new course. Nothing was saved.
              </p>
              <Button onClick={() => createDraftCourse()}>Try again</Button>
            </>
          ) : (
            <>
              <Spinner size="lg" />
              <p className={styles.statusText}>Setting up your course...</p>
            </>
          )}
        </div>
      )}
    </>
  );
}