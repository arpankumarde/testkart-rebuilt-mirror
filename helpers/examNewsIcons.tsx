import { Bell, BookOpen, CalendarClock, Gauge, KeyRound, Ticket, Trophy, type LucideIcon } from "lucide-react";
import type { ExamNewsType } from "./schema";

export const EXAM_NEWS_TYPE_ICONS: Record<ExamNewsType, LucideIcon> = {
  notification: Bell,
  admit_card: Ticket,
  result: Trophy,
  answer_key: KeyRound,
  syllabus: BookOpen,
  cut_off: Gauge,
  date_change: CalendarClock,
};