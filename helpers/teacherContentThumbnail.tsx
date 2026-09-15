import type { LucideIcon } from "lucide-react";
import { BookCopy, BookOpen, FileText, Package, Radio } from "lucide-react";
import type { TeacherMixKind } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { Placeholder } from "./placeholderImages";

/**
 * What to draw in a content row's thumbnail slot: a real image when the item
 * has one, otherwise the kind's stock placeholder, otherwise an icon tile.
 *
 * Study notes deliberately resolve to an icon and never to Placeholder.NOTE -
 * thumbnails for digital products are discontinued site-wide, which is why
 * the endpoint sends null for them in the first place. See the NOTE comment
 * in helpers/placeholderImages before changing this.
 */
export type TeacherContentThumbnail =
  | { type: "image"; src: string }
  | { type: "icon"; icon: LucideIcon };

const KIND_ICONS: Record<TeacherMixKind, LucideIcon> = {
  mock_test: BookCopy,
  live_test: Radio,
  course: BookOpen,
  digital_product: FileText,
  bundle: Package,
};

const KIND_PLACEHOLDERS: Partial<Record<TeacherMixKind, string>> = {
  mock_test: Placeholder.TEST,
  live_test: Placeholder.LIVE,
  course: Placeholder.COURSE,
};

export const teacherContentThumbnail = (
  kind: TeacherMixKind | null,
  thumbnail: string | null
): TeacherContentThumbnail => {
  if (thumbnail) return { type: "image", src: thumbnail };
  const placeholder = kind ? KIND_PLACEHOLDERS[kind] : undefined;
  if (placeholder) return { type: "image", src: placeholder };
  return { type: "icon", icon: kind ? KIND_ICONS[kind] : FileText };
};
