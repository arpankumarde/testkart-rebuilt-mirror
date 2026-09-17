import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTeacherStudentsQuery } from '../helpers/useTeacherStudentsQuery';
import { useAuth } from '../helpers/useAuth';
import { useSponsoredList } from '../helpers/useTeacherSponsoredEnrollments';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { SponsorStudentDialog } from '../components/SponsorStudentDialog';
import { SponsoredEnrollmentsList } from '../components/SponsoredEnrollmentsList';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { TeacherListToolbar, type TeacherListTab } from '../components/TeacherListToolbar';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherListPagination } from '../components/TeacherListPagination';
import { UserX, BookCopy, GraduationCap, UserPlus, RotateCcw, Zap, Package, FileText, Download, Lock } from 'lucide-react';
import { TeacherStudent as BaseTeacherStudent } from '../endpoints/teacher/students/list_GET.schema';
import Papa from 'papaparse';

type TeacherStudent = Omit<BaseTeacherStudent, 'itemType' | 'orderDate'> & {
  itemType: 'test' | 'course' | 'live_test' | 'bundle' | 'product';
  enrolledAt: Date | null;
  enrollmentType: 'paid' | 'free';
};
import styles from './teacher.students.module.css';

const StudentRowSkeleton = ({ columns }: { columns: number }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i}><Skeleton style={{ height: '1.25rem', width: i === 3 ? '160px' : '100px' }} /></td>
    ))}
  </tr>
);

const getTypeVariant = (type: string) => {
  switch (type) {
    case 'paid': return 'success';
    case 'free': return 'secondary';
    default: return 'default';
  }
};

const getItemIcon = (type: string) => {
  switch (type) {
    case 'test': return <BookCopy size={16} className={styles.itemIcon} />;
    case 'course': return <GraduationCap size={16} className={styles.itemIcon} />;
    case 'live_test': return <Zap size={16} className={styles.itemIcon} />;
    case 'bundle': return <Package size={16} className={styles.itemIcon} />;
    case 'product': return <FileText size={16} className={styles.itemIcon} />;
    default: return <BookCopy size={16} className={styles.itemIcon} />;
  }
};

const getItemBadgeText = (type: string) => {
  switch (type) {
    case 'test': return 'Test';
    case 'course': return 'Course';
    case 'live_test': return 'Live Test';
    case 'bundle': return 'Bundle';
    case 'product': return 'Product';
    default: return 'Item';
  }
};

const getItemBadgeVariant = (type: string) => {
  switch (type) {
    case 'test': return 'default';
    case 'course': return 'secondary';
    case 'live_test': return 'warning';
    case 'bundle': return 'success';
    case 'product': return 'outline';
    default: return 'default';
  }
};

const ITEMS_PER_PAGE = 10;

const TeacherStudentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { authState } = useAuth();
  // Team managers do not see what each student paid; the server sends 0 for them.
  const showAmounts = !(authState.type === 'authenticated' && authState.user.teacherRole === 'manager');
  const defaultTab = searchParams.get('tab') === 'sponsored' ? 'sponsored' : 'purchases';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { data: students, isFetching, error, refetch: refetchStudents } = useTeacherStudentsQuery();
  const { data: sponsoredData, refetch: refetchSponsored, isFetching: isSponsoredFetching } = useSponsoredList();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSponsorDialogOpen, setIsSponsorDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const castedStudents = students as unknown as TeacherStudent[];
    return castedStudents.filter(student =>
      student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentMobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.itemTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  const isDataMasked = useMemo(() => {
    if (!students || students.length === 0) return false;
    return (students as unknown as TeacherStudent[]).some(s => s.studentEmail === null);
  }, [students]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(prev => {
      if (value === 'purchases') {
        prev.delete('tab');
      } else {
        prev.set('tab', value);
      }
      return prev;
    }, { replace: true });
  };

  // Check URL params for sponsored enrollment status
  useEffect(() => {
    const sponsoredStatus = searchParams.get('sponsored');
    if (sponsoredStatus === 'success') {
      toast.success('Student successfully enrolled!');
      setSearchParams(prev => {
        prev.delete('sponsored');
        return prev;
      }, { replace: true });
      // Switch to sponsored tab to show the new enrollment
      handleTabChange('sponsored');
    } else if (sponsoredStatus === 'failed') {
      toast.error('Payment failed. Please try again.');
      setSearchParams(prev => {
        prev.delete('sponsored');
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleExportCSV = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const csvData = filteredStudents.map((student: TeacherStudent) => ({
        'Student Name': student.studentName,
        'Email': student.studentEmail || '',
        'Mobile': student.studentMobile || '',
        'Item Title': student.itemTitle,
        'Item Type': student.itemType,
        'Enrolled Date': student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString('en-CA') : '',
        ...(showAmounts && { 'Amount Paid': student.amountPaid }),
        'Enrollment Type': student.enrollmentType === 'paid' ? 'Paid' : 'Free',
        'Order Status': student.orderStatus || 'N/A'
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];

      link.setAttribute('href', url);
      link.setAttribute('download', `testkart-enrollments-${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export started successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export CSV');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchStudents(), refetchSponsored()]);
      toast.success('Data refreshed successfully');
    } catch (err) {
      toast.error('Failed to refresh data');
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const tabs: TeacherListTab[] = [
    { value: 'purchases', label: 'Online purchases', count: students?.length },
    { value: 'sponsored', label: 'Sponsored', count: sponsoredData?.sponsoredEnrollments.length },
  ];

  const renderPurchases = () => {
    if (!isFetching && paginatedStudents.length === 0) {
      return searchTerm ? (
        <TeacherListEmpty
          icon={<UserX size={26} />}
          title="No enrollments match your search"
          description={`Nothing found for "${searchTerm}". Try a name, email, mobile number or the title of what they bought.`}
        >
          <Button variant="outline" onClick={() => setSearchTerm('')}>Clear search</Button>
        </TeacherListEmpty>
      ) : (
        <TeacherListEmpty
          icon={<UserX size={26} />}
          title="No enrollments yet"
          description="Students appear here the moment they buy or enrol in one of your test series, courses, bundles or notes."
        >
          <Button onClick={() => setIsSponsorDialogOpen(true)}>
            <UserPlus size={16} />
            Sponsor a student
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <>
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Enrolled in</th>
                <th>Date</th>
                {showAmounts && <th>Paid</th>}
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {isFetching ? (
                Array.from({ length: 5 }).map((_, i) => <StudentRowSkeleton key={i} columns={showAmounts ? 7 : 6} />)
              ) : (
                paginatedStudents.map((student: TeacherStudent) => (
                  <tr key={`${student.studentId}-${student.itemId}-${student.enrolledAt}`}>
                    <td>{student.studentName}</td>
                    <td>
                      {student.studentEmail ? (
                        student.studentEmail
                      ) : (
                        <span className={styles.masked}>
                          <Lock size={12} /> Hidden
                        </span>
                      )}
                    </td>
                    <td>
                      {student.studentMobile ? (
                        student.studentMobile
                      ) : student.studentEmail === null ? (
                        <span className={styles.masked}>
                          <Lock size={12} /> Hidden
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className={styles.itemCell}>
                        {getItemIcon(student.itemType)}
                        <span>{student.itemTitle}</span>
                        <Badge variant={getItemBadgeVariant(student.itemType)}>
                          {getItemBadgeText(student.itemType)}
                        </Badge>
                      </div>
                    </td>
                    <td className={styles.amount}>
                      {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : 'N/A'}
                    </td>
                    {showAmounts && (
                      <td className={styles.amount}>
                        {student.amountPaid === 0 ? 'Free' : `₹${student.amountPaid.toFixed(2)}`}
                      </td>
                    )}
                    <td>
                      <div className={styles.typeCell}>
                        <Badge variant={getTypeVariant(student.enrollmentType)}>
                          {student.enrollmentType === 'paid' ? 'Paid' : 'Free'}
                        </Badge>
                        {student.orderStatus === 'refunded' && (
                          <Badge variant="destructive">Refunded</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <TeacherListPagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Enrollments - Testkart</title>
        <meta name="description" content="View and manage students who have enrolled in your tests." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Enrollments">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isFetching || isRefreshing || filteredStudents.length === 0}
          >
            <Download size={16} />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="icon-md"
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching || isSponsoredFetching}
            aria-label="Refresh enrollments"
          >
            <RotateCcw size={16} />
          </Button>
          <Button onClick={() => setIsSponsorDialogOpen(true)}>
            <UserPlus size={16} />
            Sponsor a student
          </Button>
        </TeacherPageHeader>

        <TeacherListToolbar
          tabs={tabs}
          value={activeTab}
          onValueChange={handleTabChange}
          tabsLabel="Enrollment source"
          search={
            activeTab === 'purchases'
              ? {
                  value: searchTerm,
                  onChange: (value) => {
                    setSearchTerm(value);
                    setCurrentPage(1);
                  },
                  placeholder: 'Search name, email, mobile or item',
                  label: 'Search enrollments',
                }
              : undefined
          }
        />

        {activeTab === 'purchases' && isDataMasked && (
          <div className={styles.notice}>
            <Lock size={16} className={styles.noticeIcon} aria-hidden="true" />
            <span>Student email and phone numbers are shown on the Starter plan and above.</span>
            <Button asChild variant="link" className={styles.noticeLink}>
              <Link to="/teacher/subscription">See plans</Link>
            </Button>
          </div>
        )}

        {activeTab === 'purchases' && error && (
          <div className={styles.error} role="alert">
            Could not load your enrollments: {error instanceof Error ? error.message : 'an unknown error occurred'}. Use Refresh to try again.
          </div>
        )}

        {activeTab === 'purchases'
          ? renderPurchases()
          : <SponsoredEnrollmentsList onSponsorClick={() => setIsSponsorDialogOpen(true)} />}

        <SponsorStudentDialog
          open={isSponsorDialogOpen}
          onOpenChange={setIsSponsorDialogOpen}
        />
      </div>
    </>
  );
};

export default TeacherStudentsPage;
