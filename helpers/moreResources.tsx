import { BellRing, CalendarDays, GraduationCap, PenLine, Presentation, Smartphone, Users, type LucideIcon } from "lucide-react";

export type MoreResource = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The public sections behind the More menu in the navbar and the phone tab bar, ending with the app page. */
export const MORE_RESOURCES: MoreResource[] = [
  { href: "/exams", label: "Exams", icon: GraduationCap },
  { href: "/expert", label: "1:1 Tutors", icon: Users },
  { href: "/current-affairs", label: "Current Affairs", icon: CalendarDays },
  { href: "/exam-news", label: "Exam News", icon: BellRing },
  { href: "/blog", label: "Blogs", icon: PenLine },
  { href: "/masterclass", label: "Masterclass", icon: Presentation },
  { href: "/app", label: "Testkart App", icon: Smartphone },
];

export const isMoreResourcePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);