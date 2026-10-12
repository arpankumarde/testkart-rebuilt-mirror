import type { Location } from 'react-router-dom';

export type CourseReturnState = { courseReturnTo: string };

export type CourseReturnTarget = { to: string; label: string };

const DEFAULT_TARGET: CourseReturnTarget = { to: '/student/courses', label: 'Back to my courses' };

// Router state for links into the course player, so its quiz results can send the student back.
export const courseReturnState = (location: Pick<Location, 'pathname' | 'search'>): CourseReturnState => ({
  courseReturnTo: location.pathname + location.search,
});

const labelFor = (path: string): string => {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === '/student/dashboard') return 'Back to dashboard';
  if (pathname === '/student/courses') return 'Back to my courses';
  if (pathname.startsWith('/course/')) return 'Back to course page';
  return 'Go back';
};

// Only same-site paths are accepted; anything else falls back to the courses list.
export const resolveCourseReturnTarget = (state: unknown): CourseReturnTarget => {
  const to = (state as Partial<CourseReturnState> | null)?.courseReturnTo;
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/\\') || to.startsWith('/student/courses/')) {
    return DEFAULT_TARGET;
  }
  return { to, label: labelFor(to) };
};
