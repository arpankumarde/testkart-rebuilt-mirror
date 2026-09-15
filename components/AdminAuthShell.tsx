import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { BRAND_APP_ICON, BRAND_FAVICON } from "../helpers/brandAssets";
import styles from "./AdminAuthShell.module.css";

export type AdminAuthNotice = {
  tone: "error" | "success";
  message: React.ReactNode;
};

type AdminAuthShellProps = {
  title: string;
  description?: React.ReactNode;
  notice?: AdminAuthNotice | null;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** The centred card shared by the signed-out admin screens: sign in, forgot password and reset password. */
export const AdminAuthShell = ({
  title,
  description,
  notice,
  busy,
  children,
  className,
}: AdminAuthShellProps) => (
  <div className={`${styles.page} ${className ?? ""}`}>
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
      <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
      <link rel="apple-touch-icon" href={BRAND_FAVICON} />
      <link rel="shortcut icon" href={BRAND_FAVICON} />
    </Helmet>
    <div className={styles.card} aria-busy={busy || undefined}>
      <div className={styles.header}>
        <img src={BRAND_APP_ICON} alt="Testkart" className={styles.logo} />
        <span className={styles.chip}>Admin</span>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {notice && (
        <div
          className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : styles.noticeSuccess}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      )}
      {children}
    </div>
  </div>
);

export const AdminAuthLink = ({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Link to={to} className={`${styles.link} ${className ?? ""}`}>
    {children}
  </Link>
);