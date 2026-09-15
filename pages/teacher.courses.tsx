import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap } from 'lucide-react';
import { useTeacherCoursesQuery } from '../helpers/useTeacherCoursesQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import { Button } from '../components/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/Select';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import {
  TeacherListToolbar,
  teacherToolbarControlClass,
} from '../components/TeacherListToolbar';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherCourseCard } from '../components/TeacherCourseCard';
import { DeleteCourseDialog } from '../components/DeleteCourseDialog';
import { TestCardSkeleton } from '../components/TestCardSkeleton';
import styles from './teacher.courses.module.css';

type StatusTab = 'all' | 'published' | 'draft' | 'archived';

const TAB_LABELS: Record<StatusTab, string> = {
  all: 'All',
  published: 'Published',
  draft: 'Drafts',
  archived: 'Archived',
};

const TAB_ORDER: StatusTab[] = ['all', 'published', 'draft', 'archived'];

const DEFAULT_TAB: StatusTab = 'all';

const TeacherCoursesPage: React.FC = () => {
  const { data: courses, isFetching, error, refetch } = useTeacherCoursesQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('recent');
  const [courseToDelete, setCourseToDelete] = useState<TeacherCourseListItem | null>(null);

  // The tab lives in the URL so the dashboard's catalogue figures can land on
  // Published or Drafts.
  const { read, write, searchParams } = useListUrlParams();
  const activeTab = read<StatusTab>('status', TAB_ORDER, DEFAULT_TAB);
  useRefetchOnLinkArrival(searchParams.has('status'), isFetching, refetch);
  const setActiveTab = (value: string) => {
    const next = TAB_ORDER.find((tab) => tab === value) ?? DEFAULT_TAB;
    write({ status: next === DEFAULT_TAB ? null : next });
  };

  const allCourses = useMemo(() => courses ?? [], [courses]);

  const counts = useMemo(() => {
    const base: Record<StatusTab, number> = { all: 0, published: 0, draft: 0, archived: 0 };
    for (const course of allCourses) {
      base.all += 1;
      const status = course.status as StatusTab | null;
      if (status && status !== 'all' && status in base) base[status] += 1;
    }
    return base;
  }, [allCourses]);

  const visibleCourses = useMemo(() => {
    let filtered =
      activeTab === 'all'
        ? allCourses
        : allCourses.filter((course) => course.status === activeTab);

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          (course.category ?? '').toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'price-desc':
          return b.price - a.price;
        case 'price-asc':
          return a.price - b.price;
        case 'recent':
        default: {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
      }
    });
  }, [allCourses, activeTab, searchQuery, sortOption]);

  const hasAnyCourses = allCourses.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  const renderContent = () => {
    if (isFetching && !courses) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <TestCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          title="Your courses could not be loaded"
          description="The list did not come back from the server. Check your connection and try again."
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (!hasAnyCourses) {
      return (
        <TeacherListEmpty
          icon={<GraduationCap size={26} />}
          title="No courses yet"
          description="A course is a set of video lessons students buy once and keep. Build your first one to start selling."
        >
          <Button asChild>
            <Link to="/teacher/courses/create">
              <Plus size={16} />
              Create a course
            </Link>
          </Button>
        </TeacherListEmpty>
      );
    }

    if (visibleCourses.length === 0) {
      return (
        <TeacherListEmpty
          title={
            isSearching
              ? `Nothing in ${TAB_LABELS[activeTab].toLowerCase()} matches "${searchQuery.trim()}"`
              : `No ${TAB_LABELS[activeTab].toLowerCase()} courses`
          }
          description={
            isSearching
              ? 'Try a different word, or check the other tabs.'
              : 'Nothing here yet. The other tabs may have what you are looking for.'
          }
        >
          {isSearching && (
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {visibleCourses.map((course) => (
          <TeacherCourseCard
            key={course.id}
            course={course}
            onDelete={() => setCourseToDelete(course)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Courses - Testkart for Teachers</title>
        <meta name="description" content="Manage your courses on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Courses">
          <Button asChild>
            <Link to="/teacher/courses/create">
              <Plus size={16} />
              New course
            </Link>
          </Button>
        </TeacherPageHeader>

        {hasAnyCourses && (
          <TeacherListToolbar
            tabs={TAB_ORDER.map((tab) => ({
              value: tab,
              label: TAB_LABELS[tab],
              count: counts[tab],
            }))}
            value={activeTab}
            onValueChange={setActiveTab}
            tabsLabel="Filter by status"
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: 'Search by title or category',
              label: 'Search courses',
            }}
          >
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className={teacherToolbarControlClass} aria-label="Sort courses">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
              </SelectContent>
            </Select>
          </TeacherListToolbar>
        )}

        <main className={styles.content}>{renderContent()}</main>
      </div>

      {courseToDelete && (
        <DeleteCourseDialog
          course={courseToDelete}
          isOpen={!!courseToDelete}
          onClose={() => setCourseToDelete(null)}
        />
      )}
    </>
  );
};

export default TeacherCoursesPage;
