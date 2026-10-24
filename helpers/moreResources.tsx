import { BellRing, CalendarDays, PenLine, type LucideIcon } from "lucide-react";

export type MoreResource = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The public reading sections behind the More menu in the navbar and the phone tab bar. */
export const MORE_RESOURCES: MoreResource[] = [
  { href: "/current-affairs", label: "Current Affairs", icon: CalendarDays },
  { href: "/exam-news", label: "Exam News", icon: BellRing },
  { href: "/blog", label: "Blogs", icon: PenLine },
];

export const isMoreResourcePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);