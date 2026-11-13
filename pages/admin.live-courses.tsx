import React, { useDeferredValue, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAdminLiveCoursesQuery } from "../helpers/useLiveCourses";
import { formatIstDate, formatRupees } from "../helpers/liveCourseRules";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { SegmentedControl } from "../components/SegmentedControl";
import styles from "./admin.live-courses.module.css";

type Status = "all" | "draft" | "published" | "completed" | "cancelled";
const LABEL: Record<string, string> = { draft: "Draft", published: "Live", completed: "Completed", cancelled: "Cancelled" };

const AdminLiveCoursesPage: React.FC = () => {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const { data, isLoading, error } = useAdminLiveCoursesQuery({ status, q: q || undefined });

  return (
    <>
      <Helmet>
        <title>Live courses - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <Link to="/admin/live-lessons" className={styles.back}>
          <ArrowLeft size={14} /> Live Lessons
        </Link>
        <ConsolePageHeader title="Live courses" />
        <div className={styles.toolbar}>
          <SegmentedControl
            aria-label="Status"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "published", label: "Live" },
              { value: "draft", label: "Draft" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or teacher" className={styles.search} />
        </div>

        {isLoading ? (
          <Skeleton style={{ height: "14rem" }} />
        ) : error ? (
          <p className={styles.error}>{error instanceof Error ? error.message : "Could not load live courses."}</p>
        ) : !data || data.courses.length === 0 ? (
          <p className={styles.empty}>No live courses here.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Seats</th>
                  <th scope="col">Price</th>
                  <th scope="col">Net sales</th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/admin/live-lessons/courses/${c.id}`} className={styles.title}>
                        {c.title}
                      </Link>
                      {c.examName && <span className={styles.sub}>{c.examName}</span>}
                    </td>
                    <td>{c.teacher.name}</td>
                    <td>
                      <span className={`${styles.chip} ${styles[`s_${c.status}`]}`}>{LABEL[c.status] ?? c.status}</span>
                    </td>
                    <td>{c.startsOn ? `${formatIstDate(c.startsOn)} - ${formatIstDate(c.endsOn ?? c.startsOn)}` : "-"}</td>
                    <td>
                      {c.enrolledCount} / {c.seatLimit}
                    </td>
                    <td>{formatRupees(c.price)}</td>
                    <td>
                      {formatRupees(c.revenue)}
                      {c.refunds > 0 && <span className={styles.sub}>{formatRupees(c.refunds)} refunded</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminLiveCoursesPage;
