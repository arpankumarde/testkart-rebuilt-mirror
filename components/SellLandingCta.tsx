import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { useBookDemoDialog } from "../helpers/useBookDemoDialog";
import styles from "./SellLandingCta.module.css";

export const TEACHER_SIGNUP_PATH = "/teacher/signup";

type StartLinkProps = {
  className?: string;
  children?: React.ReactNode;
};

export const SellStartLink = ({
  className,
  children = "Start Selling for Free",
}: StartLinkProps) => (
  <Link to={TEACHER_SIGNUP_PATH} className={`${styles.primary} ${className ?? ""}`}>
    {children}
    <ArrowRight size={18} aria-hidden="true" className={styles.arrow} />
  </Link>
);

/* The secondary button's look on an in-page anchor, such as a jump to a section. */
export const SellSecondaryAnchor = ({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <a href={href} className={`${styles.secondary} ${className ?? ""}`}>
    {children}
  </a>
);

export const SellDemoButton = ({
  className,
  children = "Book a Demo",
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  const { open } = useBookDemoDialog();

  return (
    <button
      type="button"
      onClick={open}
      className={`${styles.secondary} ${className ?? ""}`}
    >
      <CalendarCheck size={18} aria-hidden="true" />
      {children}
    </button>
  );
};
