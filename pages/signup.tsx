import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { OAuthButtonGroup } from "../components/OAuthButtonGroup";
import { MobileOTPSignupForm } from "../components/MobileOTPSignupForm";
import { EmailOTPSignupForm } from "../components/EmailOTPSignupForm";
import { Button } from "../components/Button";
import { validateRedirectPath } from "../helpers/validateRedirectPath";
import { BRAND_FAVICON } from "../helpers/brandAssets";
import styles from "./signup.module.css";

const SignupPage: React.FC = () => {
  const [otpMethod, setOtpMethod] = React.useState<"mobile" | "email">("mobile");
  const [searchParams] = useSearchParams();
  const redirectTo = validateRedirectPath(searchParams.get("redirectTo"));

  return (
    <>
      <Helmet>
        <title>Student Signup | Testkart</title>
        <meta
          name="description"
          content="Create a student account on Testkart to start taking mock tests and prepare for your exams."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={BRAND_FAVICON}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={BRAND_FAVICON}
        />
        <link
          rel="apple-touch-icon"
          href={BRAND_FAVICON}
        />
        <link
          rel="shortcut icon"
          href={BRAND_FAVICON}
        />
      </Helmet>
      <div className={styles.pageContainer}>
        <div className={styles.formCard}>
          <div className={styles.header}>
            
            <h2 className={styles.title}>Create Student Account</h2>
            <p className={styles.subtitle}>
              Sign up with Google, mobile number, or email
            </p>
          </div>

          <OAuthButtonGroup role="student" redirectTo={redirectTo ?? undefined} />

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
            <MobileOTPSignupForm 
              role="student" 
              redirectPath={redirectTo || "/student/dashboard"}
            />
          ) : (
            <EmailOTPSignupForm 
              role="student" 
              redirectPath={redirectTo || "/student/dashboard"}
            />
          )}

          <div className={styles.footerLinks}>
            <p>
              Already have an account?{" "}
              <Link to={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className={styles.link}>
                Login
              </Link>
            </p>
          </div>

          <div className={styles.teacherSection}>
            <p className={styles.teacherText}>Are you a Teacher/Coaching/School/College?</p>
            <Button variant="outline" asChild className={styles.teacherButton}>
              <Link to="/teacher/signup">Sign up as Educator</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;