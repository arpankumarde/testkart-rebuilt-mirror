import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { OAuthButtonGroup } from "../components/OAuthButtonGroup";
import { MobileOTPLoginForm } from "../components/MobileOTPLoginForm";
import { EmailOTPLoginForm } from "../components/EmailOTPLoginForm";
import { useAuth } from "../helpers/useAuth";
import { validateRedirectPath } from "../helpers/validateRedirectPath";
import { getRoleHomePath } from "../helpers/roleHomePath";
import { BRAND_FAVICON } from "../helpers/brandAssets";
import styles from "./teacher.login.module.css";

const TeacherLoginPage: React.FC = () => {
  const [otpMethod, setOtpMethod] = React.useState<"mobile" | "email">("mobile");
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = validateRedirectPath(searchParams.get("redirectTo"));

  React.useEffect(() => {
    if (authState.type === "authenticated") {
      // Role-aware: a student who lands here would hit Access Denied on the
      // teacher dashboard.
      const destination = redirectTo || getRoleHomePath(authState.user);
      navigate(destination, { replace: true });
    }
  }, [authState, navigate, redirectTo]);

  if (authState.type === "authenticated") {
    return null; // Avoid rendering the form if already logged in
  }

  return (
    <>
      <Helmet>
        <title>Teacher Login | Testkart</title>
        <meta
          name="description"
          content="Log in to your Testkart teacher account to create and manage your mock tests."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>
      <div className={styles.pageContainer}>
        <div className={styles.formCard}>
          <div className={styles.header}>
            <h1 className={styles.title}>Teacher login</h1>
            <p className={styles.subtitle}>
              Continue with Google, or get a one-time code by mobile or email.
            </p>
          </div>

          <OAuthButtonGroup role="teacher" redirectTo={redirectTo ?? undefined} />

          <div className={styles.separator}>
            <div className={styles.separatorLine}></div>
            <span className={styles.separatorText}>or</span>
            <div className={styles.separatorLine}></div>
          </div>

          <div className={styles.otpToggle}>
            <button
              className={`${styles.otpToggleButton} ${otpMethod === "mobile" ? styles.otpToggleButtonActive : ""}`}
              onClick={() => setOtpMethod("mobile")}
              type="button"
            >
              Mobile OTP
            </button>
            <button
              className={`${styles.otpToggleButton} ${otpMethod === "email" ? styles.otpToggleButtonActive : ""}`}
              onClick={() => setOtpMethod("email")}
              type="button"
            >
              Email OTP
            </button>
          </div>

          {otpMethod === "mobile" ? (
            <MobileOTPLoginForm 
              redirectPath={redirectTo || "/teacher/dashboard"} 
              role="teacher" 
            />
          ) : (
            <EmailOTPLoginForm 
              redirectPath={redirectTo || "/teacher/dashboard"} 
              role="teacher" 
            />
          )}

          <div className={styles.footerLinks}>
            <p>
              Don't have an account?{" "}
              <Link to={`/teacher/signup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className={styles.link}>
                Sign up as a teacher
              </Link>
            </p>
            <p>
              Are you a student?{" "}
              <Link to="/login" className={styles.link}>
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherLoginPage;