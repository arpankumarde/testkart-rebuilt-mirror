import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import styles from "./PurchaseCardTeacher.module.css";

interface PurchaseCardTeacherProps {
  label: string;
  name: string;
  avatarUrl: string | null;
  slug: string;
  isVerified: boolean;
  academyName?: string | null;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "T";

/** Teacher strip inside the detail pages' purchase card, linking to the expert profile. */
export const PurchaseCardTeacher: React.FC<PurchaseCardTeacherProps> = ({
  label,
  name,
  avatarUrl,
  slug,
  isVerified,
  academyName,
}) => {
  const academy = academyName?.trim();
  const showAcademy = !!academy && academy.toLowerCase() !== name.trim().toLowerCase();

  return (
    <Link to={`/expert/${slug}`} className={styles.teacher}>
      <Avatar className={styles.avatar}>
        <AvatarImage src={avatarUrl || undefined} alt="" />
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className={styles.info}>
        <span className={styles.label}>{label}</span>
        <span className={styles.nameRow}>
          <span className={styles.name}>{name}</span>
          <VerifiedBadge isVerified={isVerified} size="sm" />
        </span>
        {showAcademy && <span className={styles.academy}>{academy}</span>}
      </div>
      <span className={styles.profileLink}>
        Profile
        <ChevronRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
};