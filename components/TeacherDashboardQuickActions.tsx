import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { BookCopy, BookOpen, Package, UserPlus, ShoppingBag } from "lucide-react";
import styles from "./TeacherDashboardQuickActions.module.css";

interface TeacherDashboardQuickActionsProps {
  onSponsorClick: () => void;
  onBundleClick: () => void;
}

export const TeacherDashboardQuickActions: React.FC<TeacherDashboardQuickActionsProps> = ({
  onSponsorClick,
  onBundleClick
}) => {
  return (
    <div className={styles.quickActions}>
      <div className={styles.quickActionsFlex}>
        <Button asChild variant="outline" size="sm" className={styles.quickActionButton}>
          <Link to="/teacher/create-test">
            <BookCopy size={16} />
            Create Test Series
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className={styles.quickActionButton}>
          <Link to="/teacher/courses/create">
            <BookOpen size={16} />
            Create Course
          </Link>
        </Button>
        <Button variant="outline" size="sm" className={styles.quickActionButton} onClick={onBundleClick}>
          <Package size={16} />
          Create Bundle
        </Button>
        <Button variant="outline" size="sm" className={styles.quickActionButton} onClick={onSponsorClick}>
          <UserPlus size={16} />
          Sponsor Student
        </Button>
        <Button asChild variant="outline" size="sm" className={styles.quickActionButton}>
          <Link to="/teacher/products">
            <ShoppingBag size={16} />
            Add Digital Product
          </Link>
        </Button>
      </div>
    </div>
  );
};