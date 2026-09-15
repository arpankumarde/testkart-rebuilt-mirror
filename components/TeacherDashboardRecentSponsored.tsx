import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { UserPlus, ArrowRight } from "lucide-react";
import styles from "./TeacherDashboardRecentSponsored.module.css";

interface TeacherDashboardRecentSponsoredProps {
  recentSponsored: Array<{
    id: number;
    studentName: string;
    contentTitle: string;
    enrolledAt: Date | null;
    commissionAmount: number;
  }>;
  isLoading: boolean;
}

export const TeacherDashboardRecentSponsored: React.FC<TeacherDashboardRecentSponsoredProps> = ({
  recentSponsored,
  isLoading
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Recent Sponsored Students</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/teacher/students?tab=sponsored">View All</Link>
        </Button>
      </div>

      <div className={styles.list}>
        {isLoading ? (
          <>
            <div className={styles.skeletonItem}><Skeleton style={{ height: "40px", width: "100%" }} /></div>
            <div className={styles.skeletonItem}><Skeleton style={{ height: "40px", width: "100%" }} /></div>
            <div className={styles.skeletonItem}><Skeleton style={{ height: "40px", width: "100%" }} /></div>
          </>
        ) : recentSponsored.length > 0 ? (
          recentSponsored.map((enrollment) => (
            <div key={enrollment.id} className={styles.item}>
              <div className={styles.itemIcon}>
                <UserPlus size={16} />
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemName}>{enrollment.studentName}</div>
                <div className={styles.itemMeta}>
                  {enrollment.contentTitle} • {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString() : '-'}
                </div>
              </div>
              <div className={styles.itemCost}>
                -₹{enrollment.commissionAmount}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>No sponsored students yet</p>
          </div>
        )}
        
        {recentSponsored.length > 0 && (
           <Button asChild variant="link" size="sm" className={styles.viewMoreLink}>
             <Link to="/teacher/students?tab=sponsored">
               View All History <ArrowRight size={14} />
             </Link>
           </Button>
        )}
      </div>
    </div>
  );
};