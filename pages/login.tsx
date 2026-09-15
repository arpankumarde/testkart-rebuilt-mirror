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
import styles from "./login.module.css";

const LoginPage: React.FC = () => {
  const [otpMethod, setOtpMethod] = React.useState<"mobile" | "email">("mobile");
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = validateRedirectPath(searchParams.get("redirectTo"));

  React.useEffect(() => {
    if (authState.type === "authenticated") {
      // Role-aware: a teacher who lands here would hit Access Denied on the
      // student dashboard.
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
        <title>Login | Testkart</title>
        <meta name="description" content="Log in to your Testkart account." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>
      <div className={styles.pageContainer}>
        <div className={styles.loginCard}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Student Login</h1>
            <p className={styles.subtitle}>
              Log in with Google, mobile OTP, or email OTP
            </p>
          </div>

          <OAuthButtonGroup disabled={authState.type === "loading"} role="student" redirectTo={redirectTo ?? undefined} />

          <div className={styles.separator}>
            <div className={styles.separatorLine}></div>
            <span className={styles.separatorText}>OR</span>
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
            <MobileOTPLoginForm redirectPath={redirectTo || "/student/dashboard"} />
          ) : (
            <EmailOTPLoginForm redirectPath={redirectTo || "/student/dashboard"} />
          )}

          <div className={styles.cardFooter}>
            <p>
              Don't have an account?{" "}
              <Link to={`/signup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className={styles.link}>
                Sign up
              </Link>
            </p>
            <p className={styles.teacherLink}>
              Are you an Educator?{" "}
              <Link to="/teacher/login" className={styles.link}>
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;