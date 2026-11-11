import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTeacherCoursesQuery } from '../helpers/useTeacherCoursesQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import { Button } from '../components/Button';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherContentPage } from '../components/TeacherContentPage';
import { TeacherContentEmpty } from '../components/TeacherContentEmpty';
import { withStatusCounts, type TeacherStatusTabDef } from '../components/TeacherStatusTabs';
import { TeacherCourseCard } from '../components/TeacherCourseCard';
import { useCreatorBonusOverview } from '../helpers/useCreatorBonus';
import { DeleteCourseDialog } from '../components/DeleteCourseDialog';
import { TeacherTestCardSkeleton } from '../components/TeacherTestCardSkeleton';
import styles from './teacher.courses.module.css';

type StatusTab = 'all' | 'published' | 'draft' | 'archived';

const TABS: TeacherStatusTabDef<StatusTab>[] = [
  { value: 'all', label: 'All', word: '' },
  { value: 'published', label: 'Published', word: 'published' },
  { value: 'draft', label: 'Drafts', word: 'draft' },
  { value: 'archived', label: 'Archived', word: 'archived' },
];

const TAB_ORDER = TABS.map((tab) => tab.value);

const DEFAULT_TAB: StatusTab = 'all';

const CREATE = { label: 'New course', to: '/teacher/courses/create' };

const TeacherCoursesPage: React.FC = () => {
  const { data: courses, isFetching, error, refetch } = useTeacherCoursesQuery();
  const { data: bonus } = useCreatorBonusOverview();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('recent');
  const [courseToDelete, setCourseToDelete] = useState<TeacherCourseListItem | null>(null);

  // The tab lives in the URL so the dashboard's catalogue figures can land on
  // Published or Drafts.
  const { read, write, searchParams } = useListUrlParams();
  const activeTab = read<StatusTab>('status', TAB_ORDER, DEFAULT_TAB);
  useRefetchOnLinkArrival(searchParams.has('status'), isFetching, refetch);
  const setActiveTab = (tab: StatusTab) => {
    write({ status: tab === DEFAULT_TAB ? null : tab });
  };

  const allCourses = useMemo(() => courses ?? [], [courses]);

  const bonusByCourse = useMemo(() => {
    const map = new Map<number, { state: string; amount: number }>();
    if (bonus?.campaign) {
      for (const item of bonus.items) {
        if (item.type === 'course') map.set(item.id, { state: item.state, amount: bonus.slots.course.amount });
      }
    }
    return map;
  }, [bonus]);

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
        (course) => course.title.toLowerCase().includes(query)
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

  const total = courses ? allCourses.length : undefined;
  const query = searchQuery.trim();
  const statusWord = TABS.find((tab) => tab.value === activeTab)?.word || undefined;

  const renderContent = () => {
    if (isFetching && !courses) {
      return (
        <div className={styles.grid} aria-busy="true" aria-label="Loading courses">
          {Array.from({ length: 6 }).map((_, index) => (
            <TeacherTestCardSkeleton key={index} />
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

    if (!total) {
      return (
        <TeacherContentEmpty
          kind="course"
          plural="courses"
          reason="none"
          description="A course is a set of video lessons students buy once and keep. Build your first one to start selling."
          create={{ ...CREATE, label: 'Create a course' }}
        />
      );
    }

    if (visibleCourses.length === 0) {
      return query ? (
        <TeacherContentEmpty
          kind="course"
          plural="courses"
          reason="search"
          query={query}
          statusWord={statusWord}
          onClearSearch={() => setSearchQuery('')}
        />
      ) : (
        <TeacherContentEmpty kind="course" plural="courses" reason="status" statusWord={statusWord ?? ''} />
      );
    }

    return (
      <div className={styles.grid}>
        {visibleCourses.map((course) => (
          <TeacherCourseCard
            key={course.id}
            course={course}
            bonus={bonusByCourse.get(course.id)}
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
      <TeacherContentPage
        kind="course"
        title="Courses"
        description="Create, organise and manage your courses in one place."
        create={CREATE}
        busy={isFetching}
        toolbar={{
          tabs: {
            tabs: withStatusCounts(TABS, counts),
            value: activeTab,
            onValueChange: setActiveTab,
            total,
          },
          search: {
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Search by title',
            label: 'Search courses',
          },
          selects: [
            {
              value: sortOption,
              onChange: setSortOption,
              label: 'Sort courses',
              options: [
                { value: 'recent', label: 'Newest first' },
                { value: 'price-desc', label: 'Price: high to low' },
                { value: 'price-asc', label: 'Price: low to high' },
              ],
            },
          ],
        }}
      >
        {renderContent()}
      </TeacherContentPage>

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
