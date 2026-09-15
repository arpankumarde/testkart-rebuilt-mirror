"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import styles from "./Calendar.module.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  mode: "single" | "range";
  showDropdowns?: boolean;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  showDropdowns = false,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={showDropdowns ? "dropdown" : undefined}
      className={`${styles.calendar} ${className ?? ""}`}
      classNames={{
        chevron: styles.chevron,
        weekdays: styles.weekdays,
        weekday: styles.weekday,
        today: styles.today,
        selected: styles.selected,
        range_middle: styles.range_middle,
        range_end: styles.range_end,
        outside: styles.outside,
        nav: styles.nav,
        months: styles.months,
        month: styles.month,
        month_grid: styles.month_grid,
        month_caption: styles.month_caption,
        hidden: styles.hidden,
        footer: styles.footer,
        disabled: styles.disabled,
        day: styles.day, // the cell around day button
        day_button: styles.day_button, // the day button
        cell: styles.cell,
        caption_label: styles.caption_label,
        button_previous: styles.button_previous,
        button_next: styles.button_next,
        caption_dropdowns: styles.caption_dropdowns,
        dropdown: styles.dropdown,
        dropdown_icon: styles.dropdown_icon,
        dropdown_year: styles.dropdown_year,
        dropdown_month: styles.dropdown_month,
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
