import React, { useState } from "react";
import { FileSearch } from "lucide-react";
import { Button } from "./Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { GecExamPicker, type GecPickedExam } from "./GecExamPicker";
import { useAdminGecTestkartPages } from "../helpers/useAdminGovtExamsCalendar";
import styles from "./GecPagePicker.module.css";

const SITE_PAGES = [
  { label: "All test series", href: "/mock-test" },
  { label: "All exams", href: "/exams" },
  { label: "Courses", href: "/course" },
];

/** Picks an existing Testkart page (an exam's syllabus, pattern, mock tests and so on) and returns its path. */
export const GecPagePicker: React.FC<{ onPick: (href: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  const [exam, setExam] = useState<GecPickedExam | null>(null);
  const { data, isFetching } = useAdminGecTestkartPages(exam?.id ?? null);

  const pick = (href: string) => {
    onPick(href);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSearch size={15} /> Pick a Testkart page
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.panel}>
        <p className={styles.heading}>Site pages</p>
        <div className={styles.chips}>
          {SITE_PAGES.map((page) => (
            <button key={page.href} type="button" className={styles.chip} onClick={() => pick(page.href)}>
              {page.label}
            </button>
          ))}
        </div>
        <p className={styles.heading}>An exam's pages</p>
        <GecExamPicker value={exam} onChange={setExam} />
        {exam && (
          <ul className={styles.pages}>
            {isFetching && !data && <li className={styles.muted}>Loading pages...</li>}
            {data?.pages.map((page) => (
              <li key={page.href}>
                <button type="button" className={styles.page} onClick={() => pick(page.href)}>
                  <span>{page.label}</span>
                  <span className={styles.path}>{page.href}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};