import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { OAuthButtonGroup } from "../components/OAuthButtonGroup";
import { MobileOTPSignupForm } from "../components/MobileOTPSignupForm";
import { EmailOTPSignupForm } from "../components/EmailOTPSignupForm";
import { Target, BarChart, BadgeDollarSign, Brain, ShoppingBag } from "lucide-react";
import { validateRedirectPath } from "../helpers/validateRedirectPath";
import { BRAND_FAVICON } from "../helpers/brandAssets";
import { R2_PUBLIC_URL } from "../helpers/_publicConfigs";
import styles from "./teacher.signup.module.css";

/* Built from R2_PUBLIC_URL like the other marketing images (TeacherCtaBanner,
   BookDemoPopup), rather than hardcoding the CDN host. */
const BENEFITS_IMAGE_URL = `https://${R2_PUBLIC_URL}/marketing-assets/teacher-signup-benefits.png`;

const TeacherSignupPage: React.FC = () => {
  const [otpMethod, setOtpMethod] = React.useState<"mobile" | "email">("mobile");
  const [searchParams] = useSearchParams();
  const redirectTo = validateRedirectPath(searchParams.get("redirectTo"));
  const campaign = searchParams.get("campaign");

  useEffect(() => {
    if (campaign && campaign.trim() !== "") {
      localStorage.setItem("testkart_signup_source", campaign.trim());
    }
  }, [campaign]);

  return (
    <>
      <Helmet>
        <title>Teacher Signup | Testkart</title>
        <meta
          name="description"
          content="Join Testkart as a teacher to create, sell, and manage your mock tests for a wide audience of students."
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
        <div className={styles.contentWrapper}>
          <div className={styles.benefitsPanel}>
            <div className={styles.heroImageWrapper}>
              <img
                src={BENEFITS_IMAGE_URL}
                alt=""
                width={500}
                height={500}
                loading="lazy"
                className={styles.heroImage}
              />
            </div>
            <h1 className={styles.heroHeading}>Testkart for Teachers</h1>
            <p className={styles.benefitsIntro}>
              Join our platform to empower students and grow your reach.
            </p>
            <ul className={styles.benefitsList}>
              <li>
                <span className={styles.iconCircle}><Target size={18} /></span>
                <span>Reach thousands of students</span>
              </li>
              <li>
                <span className={styles.iconCircle}><BadgeDollarSign size={18} /></span>
                <span>Set your own prices and earn</span>
              </li>
              <li>
                <span className={styles.iconCircle}><BarChart size={18} /></span>
                <span>Track performance with analytics</span>
              </li>
              <li>
                <span className={styles.iconCircle}><Brain size={18} /></span>
                <span>AI-powered question generation</span>
              </li>
              <li>
                <span className={styles.iconCircle}><ShoppingBag size={18} /></span>
                <span>Sell courses &amp; digital products</span>
              </li>
            </ul>
          </div>
          <div className={styles.formPanel}>
            <div className={styles.formCard}>
              <div className={styles.header}>
                <h2 className={styles.title}>Create your teacher account</h2>
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
                <MobileOTPSignupForm 
                  role="teacher" 
                  redirectPath={redirectTo ?? undefined}
                />
              ) : (
                <EmailOTPSignupForm 
                  role="teacher" 
                  redirectPath={redirectTo ?? undefined}
                />
              )}

              <div className={styles.footerLinks}>
                <p>
                  Already have an account?{" "}
                  <Link to={`/teacher/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className={styles.link}>
                    Login
                  </Link>
                </p>
                <p>
                  Are you a student?{" "}
                  <Link to="/signup" className={styles.link}>
                    Sign up here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherSignupPage;