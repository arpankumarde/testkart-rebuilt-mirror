import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./Dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./Sheet";
import { TeacherKindTile } from "./TeacherKindTile";
import { teacherConsoleClass } from "./TeacherConsoleTheme";
import { useIsMobile } from "../helpers/useIsMobile";
import { useTeacherDashboardOverview } from "../helpers/useTeacherDashboardOverview";
import { BUNDLE_MIN_PUBLISHED_ITEMS, TEACHER_CONTENT_KINDS } from "../helpers/teacherContentKinds";
import styles from "./TeacherCreateChooser.module.css";

type ChooserContextValue = { openChooser: () => void };

const ChooserContext = createContext<ChooserContextValue | null>(null);

/**
 * Opens "What do you want to create?". Outside the teacher layout (no
 * provider) it falls back to the test series creator, the most common start.
 */
export const useTeacherCreateChooser = (): ChooserContextValue => {
  const context = useContext(ChooserContext);
  const navigate = useNavigate();
  return context ?? { openChooser: () => navigate(TEACHER_CONTENT_KINDS[0].createPath) };
};

const TITLE = "What do you want to create?";
const DESCRIPTION = "Pick one to start. You can save a draft and come back to it any time.";

const ChooserOptions = ({ publishedItems, onPick }: { publishedItems: number | null; onPick: () => void }) => (
  <ul className={styles.list}>
    {TEACHER_CONTENT_KINDS.map((meta) => {
      const bundleNote =
        meta.kind === "bundle" && publishedItems !== null && publishedItems < BUNDLE_MIN_PUBLISHED_ITEMS
          ? `Goes live once it holds ${BUNDLE_MIN_PUBLISHED_ITEMS} published items. You have ${publishedItems}.`
          : null;
      return (
        <li key={meta.kind}>
          <Link to={meta.createPath} className={styles.option} onClick={onPick}>
            <TeacherKindTile kind={meta.kind} />
            <span className={styles.text}>
              <span className={styles.label}>{meta.label}</span>
              <span className={styles.pitch}>{meta.pitch}</span>
              {bundleNote && <span className={styles.note}>{bundleNote}</span>}
            </span>
            <ChevronRight className={styles.chevron} aria-hidden="true" />
          </Link>
        </li>
      );
    })}
  </ul>
);

const TeacherCreateChooser = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const isMobile = useIsMobile();
  const { data } = useTeacherDashboardOverview("30d", open);
  const publishedItems = data
    ? data.totals.publishedTests + data.totals.publishedCourses + data.totals.publishedProducts
    : null;
  const close = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={`${teacherConsoleClass} ${styles.sheet}`}>
          <SheetHeader className={styles.sheetHeader}>
            <SheetTitle className={styles.title}>{TITLE}</SheetTitle>
            <SheetDescription className={styles.description}>{DESCRIPTION}</SheetDescription>
          </SheetHeader>
          <div className={styles.sheetBody}>
            <ChooserOptions publishedItems={publishedItems} onPick={close} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${teacherConsoleClass} ${styles.dialog}`}>
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle className={styles.title}>{TITLE}</DialogTitle>
          <DialogDescription className={styles.description}>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <ChooserOptions publishedItems={publishedItems} onPick={close} />
      </DialogContent>
    </Dialog>
  );
};

/** Mounted once by the teacher layout; any page inside opens it with useTeacherCreateChooser. */
export const TeacherCreateChooserProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const openChooser = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openChooser }), [openChooser]);

  return (
    <ChooserContext.Provider value={value}>
      {children}
      <TeacherCreateChooser open={open} onOpenChange={setOpen} />
    </ChooserContext.Provider>
  );
};