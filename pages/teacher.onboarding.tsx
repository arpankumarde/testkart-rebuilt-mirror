import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useAuth } from "../helpers/useAuth";
import { Skeleton } from "../components/Skeleton";
import { TeacherOnboardingQuiz } from "../components/TeacherOnboardingQuiz";
import { TeamStatusBanner } from "../components/TeamStatusBanner";
import { teacherConsoleClass } from "../components/TeacherConsoleTheme";
import { BRAND_LOGO_LIGHT } from "../helpers/brandAssets";
import styles from "./teacher.onboarding.module.css";

export default function TeacherOnboardingPage() {
  const { authState } = useAuth();
  const navigate = useNavigate();

  // Redirect if already onboarded, or a team manager, who works in the owner's academy
  useEffect(() => {
    if (authState.type === "authenticated") {
      const { onboardingCompleted, teacherRole } = authState.user;
      if (onboardingCompleted || teacherRole === "manager") {
        navigate("/teacher/dashboard", { replace: true });
      }
    }
  }, [authState, navigate]);

  if (authState.type === "loading") {
    return (
      <div className={`${teacherConsoleClass} ${styles.pageContainer}`}>
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
        <title>Set up your teacher account | Testkart</title>
        <meta
          name="description"
          content="A few quick questions to set up your Testkart teacher account."
        />
      </Helmet>

      <div className={`${teacherConsoleClass} ${styles.pageContainer}`}>
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
          <TeamStatusBanner className={styles.teamInvites} />
          <h1 className={styles.welcome}>Set up your teacher account</h1>
          <p className={styles.welcomeText}>A few questions, about a minute. Your answers shape your dashboard and where students find you.</p>
          <TeacherOnboardingQuiz />
        </div>
      </div>
    </>
  );
}