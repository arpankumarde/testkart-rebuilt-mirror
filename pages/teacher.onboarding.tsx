import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useAuth } from "../helpers/useAuth";
import { Skeleton } from "../components/Skeleton";
import { TeacherOnboardingQuiz } from "../components/TeacherOnboardingQuiz";
import { BRAND_LOGO_LIGHT } from "../helpers/brandAssets";
import styles from "./teacher.onboarding.module.css";

export default function TeacherOnboardingPage() {
  const { authState } = useAuth();
  const navigate = useNavigate();

  // Redirect if already onboarded
  useEffect(() => {
    if (authState.type === "authenticated") {
      const user = authState.user as unknown as { onboardingCompleted?: boolean };
      if (user.onboardingCompleted) {
        navigate("/teacher/dashboard", { replace: true });
      }
    }
  }, [authState, navigate]);

  if (authState.type === "loading") {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.content}>
          <Skeleton style={{ height: "3rem", marginBottom: "2rem" }} />
          <Skeleton style={{ height: "400px", borderRadius: "var(--radius-md)" }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Set Up Your Profile | Testkart</title>
        <meta
          name="description"
          content="Complete your teacher profile setup on Testkart to start creating and selling mock tests."
        />
      </Helmet>

      <div className={styles.pageContainer}>
        <header className={styles.topBar}>
          <Link to="/" className={styles.logo}>
            <img
              src={BRAND_LOGO_LIGHT}
              alt="Testkart"
              className={styles.logoImage}
            />
          </Link>
        </header>

        <div className={styles.content}>
          <TeacherOnboardingQuiz />
        </div>
      </div>
    </>
  );
}