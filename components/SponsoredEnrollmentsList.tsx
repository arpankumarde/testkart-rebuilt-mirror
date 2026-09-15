import React, { useState, useMemo } from "react";
import { useSponsoredList, TEACHER_SPONSORED_LIST_QUERY_KEY } from "../helpers/useTeacherSponsoredEnrollments";
import type { SponsoredEnrollment } from "../endpoints/teacher/sponsor-student/list_GET.schema";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { Input } from "./Input";
import { Button } from "./Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import {
  Search,
  User,
  Calendar,
  BookOpen,
  IndianRupee,
  Download,
  Filter,
  ArrowUpDown,
  Users,
  Wallet,
} from "lucide-react";
import styles from "./SponsoredEnrollmentsList.module.css";

// Helper component for Stat Cards
const StatCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  colorClass: "blue" | "orange";
}) => (
  <div className={styles.statCard}>
    <div className={`${styles.statIconWrapper} ${styles[colorClass]}`}>
      <Icon size={24} />
    </div>
    <div className={styles.statContent}>
      <p className={styles.statTitle}>{title}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  </div>
);

interface SponsoredEnrollmentsListProps {
  className?: string;
  onSponsorClick?: () => void;
}

export const SponsoredEnrollmentsList: React.FC<SponsoredEnrollmentsListProps> = ({
  className,
  onSponsorClick,
}) => {
  const { data, isLoading, isError } = useSponsoredList();

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [testFilter, setTestFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Formatters
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: Date | string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Derived Data
  const uniqueTests = useMemo(() => {
    if (!data?.sponsoredEnrollments) return [];
    const tests = new Set(data.sponsoredEnrollments.map((e) => e.contentTitle));
    return Array.from(tests).sort();
  }, [data]);

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "mock_test":
      case "live_test":
        return "Test";
      case "course":
        return "Course";
      case "course_bundle":
        return "Bundle";
      case "digital_product":
        return "Product";
      default:
        return "Content";
    }
  };

  const stats = useMemo(() => {
    if (!data?.sponsoredEnrollments)
      return { totalStudents: 0, totalSpent: 0 };
    // Only count active enrollments (not payment-pending ones)
    const activeEnrollments = data.sponsoredEnrollments.filter(
      (e) => !(e.paymentMethod === "online_pending" && e.orderStatus === "pending")
    );
    return {
      totalStudents: activeEnrollments.length,
      totalSpent: activeEnrollments.reduce(
        (sum, e) => sum + e.commissionAmount,
        0
      ),
    };
  }, [data]);

  const filteredEnrollments = useMemo(() => {
    if (!data?.sponsoredEnrollments) return [];

    return data.sponsoredEnrollments
      .filter((enrollment) => {
        // Search Filter
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          enrollment.studentName.toLowerCase().includes(searchLower) ||
          enrollment.studentPhone.includes(searchLower) ||
          enrollment.contentTitle.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;

        // Payment Method Filter
        if (paymentFilter !== "all") {
          if (
            !enrollment.paymentMethod
              .toLowerCase()
              .includes(paymentFilter.toLowerCase())
          ) {
            return false;
          }
        }

        // Test Filter
        if (testFilter !== "all" && enrollment.contentTitle !== testFilter) {
          return false;
        }

        // Date Filter
        if (dateFilter !== "all") {
          if (!enrollment.enrolledAt) return true; // Include if no date
          const enrollDate = new Date(enrollment.enrolledAt);
          const now = new Date();
          const cutoffDate = new Date();

          if (dateFilter === "7d") {
            cutoffDate.setDate(now.getDate() - 7);
          } else if (dateFilter === "30d") {
            cutoffDate.setDate(now.getDate() - 30);
          } else if (dateFilter === "3m") {
            cutoffDate.setMonth(now.getMonth() - 3);
          }

          if (enrollDate < cutoffDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "date-asc":
            return (
              (a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0) -
              (b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0)
            );
          case "date-desc":
            return (
              (b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0) -
              (a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0)
            );
          case "amount-asc":
            return a.commissionAmount - b.commissionAmount;
          case "amount-desc":
            return b.commissionAmount - a.commissionAmount;
          default:
            return 0;
        }
      });
  }, [data, searchTerm, paymentFilter, dateFilter, testFilter, sortBy]);

  const handleExport = () => {
    if (!filteredEnrollments.length) return;

    const headers = [
      "Date",
      "Student Name",
      "Phone",
      "Content",
      "Amount",
      "Payment Method",
      "Status",
    ];

    const csvRows = filteredEnrollments.map((row) => [
      row.enrolledAt ? new Date(row.enrolledAt).toLocaleDateString("en-IN") : "N/A",
      `"${row.studentName.replace(/"/g, '""')}"`,
      row.studentPhone,
      `"${row.contentTitle.replace(/"/g, '""')}"`,
      row.commissionAmount,
      row.paymentMethod,
      "Active",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map((e) => e.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `sponsored_enrollments_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading sponsored enrollments...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorState}>
        <p>Failed to load sponsored enrollments. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Summary Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          title="Total Sponsored Students"
          value={stats.totalStudents}
          icon={Users}
          colorClass="blue"
        />
        <StatCard
          title="Total Amount Spent"
          value={formatCurrency(stats.totalSpent)}
          icon={Wallet}
          colorClass="orange"
        />
      </div>

      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Sponsored Enrollments History</h3>
        </div>

        {/* Filters Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.topToolbarRow}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={16} />
              <Input
                placeholder="Search by student, phone, or test..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredEnrollments.length === 0}
              title="Export filtered results to CSV"
            >
              <Download size={14} /> Export CSV
            </Button>
          </div>

          <div className={styles.filtersRow}>
            <div className={styles.filterGroup}>
              <Filter size={14} className={styles.filterIcon} />

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="balance">Wallet Balance</SelectItem>
                  <SelectItem value="online">Online Payment</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                </SelectContent>
              </Select>

              <Select value={testFilter} onValueChange={setTestFilter}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="All Content" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Content</SelectItem>
                  {uniqueTests.map((test) => (
                    <SelectItem key={test} value={test}>
                      {test}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.sortGroup}>
              <ArrowUpDown size={14} className={styles.filterIcon} />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className={styles.selectTrigger}>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="amount-desc">Amount: High to Low</SelectItem>
                  <SelectItem value="amount-asc">Amount: Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredEnrollments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrapper}>
              <User size={32} />
            </div>
            <h4>
              {searchTerm ||
              paymentFilter !== "all" ||
              dateFilter !== "all" ||
              testFilter !== "all"
                ? "No matching enrollments found"
                : "No sponsored enrollments yet"}
            </h4>
            <p>
              {searchTerm ||
              paymentFilter !== "all" ||
              dateFilter !== "all" ||
              testFilter !== "all"
                ? "Try adjusting your filters or search terms"
                : "Sponsor your first student to help them access your test series"}
            </p>
            {searchTerm === "" &&
              paymentFilter === "all" &&
              dateFilter === "all" &&
              testFilter === "all" && (
                <div style={{ marginTop: "1rem" }}>
                  <Button onClick={onSponsorClick}>Sponsor Student</Button>
                </div>
              )}
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Content</th>
                    <th>Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td className={styles.dateCell}>
                        <div className={styles.cellContent}>
                          <Calendar size={14} className={styles.cellIcon} />
                          {formatDate(enrollment.enrolledAt)}
                        </div>
                      </td>
                      <td>
                        <div className={styles.studentInfo}>
                          <span className={styles.studentName}>
                            {enrollment.studentName}
                          </span>
                          <span className={styles.studentPhone}>
                            {enrollment.studentPhone}
                          </span>
                          {enrollment.wasNewUser && (
                            <Badge
                              variant="secondary"
                              className={styles.newBadge}
                            >
                              New User
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.testInfo}>
                          <BookOpen size={14} className={styles.cellIcon} />
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
                            <span className={styles.testTitle}>
                              {enrollment.contentTitle}
                            </span>
                            <Badge
                              variant="outline"
                              style={{ padding: "0 4px", fontSize: "0.65rem", height: "1.25rem" }}
                            >
                              {getContentTypeLabel(enrollment.contentType)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.costInfo}>
                          <IndianRupee size={14} className={styles.cellIcon} />
                          <span className={styles.amount}>
                            {formatCurrency(enrollment.commissionAmount)}
                          </span>
                          <span className={styles.paymentMethod}>
                            via {enrollment.paymentMethod}
                          </span>
                        </div>
                      </td>
                      <td>
                        {enrollment.paymentMethod === "online_pending" && enrollment.orderStatus === "pending" ? (
                          <div className={styles.statusCell}>
                            <Badge variant="warning">Payment Pending</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className={styles.retryButton}
                              onClick={onSponsorClick}
                            >
                              Retry
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className={styles.mobileList}>
              {filteredEnrollments.map((enrollment) => (
                <div key={enrollment.id} className={styles.mobileCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardDate}>
                      {formatDate(enrollment.enrolledAt)}
                    </div>
                    {enrollment.paymentMethod === "online_pending" && enrollment.orderStatus === "pending" ? (
                      <div className={styles.cardStatusGroup}>
                        <Badge variant="warning">Payment Pending</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className={styles.retryButton}
                          onClick={onSponsorClick}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Student</span>
                      <div className={styles.cardValue}>
                        <div className={styles.studentName}>
                          {enrollment.studentName}
                        </div>
                        <div className={styles.studentPhone}>
                          {enrollment.studentPhone}
                        </div>
                        {enrollment.wasNewUser && (
                          <Badge
                            variant="secondary"
                            className={styles.newBadgeMobile}
                          >
                            New
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Content</span>
                      <div className={styles.cardValue}>
                        <span>{enrollment.contentTitle}</span>
                        <Badge
                          variant="outline"
                          className={styles.newBadgeMobile}
                        >
                          {getContentTypeLabel(enrollment.contentType)}
                        </Badge>
                      </div>
                    </div>

                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Cost</span>
                      <div className={styles.cardValue}>
                        <span className={styles.amount}>
                          {formatCurrency(enrollment.commissionAmount)}
                        </span>
                        <span className={styles.paymentMethod}>
                          ({enrollment.paymentMethod})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};