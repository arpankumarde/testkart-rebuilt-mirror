import React, { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "./Button";
import { Calendar } from "./Calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { formatExpiryDay, todayIst } from "../helpers/contentExpiry";
import styles from "./ExpiryDateField.module.css";

interface ExpiryDateFieldProps {
  /** Last day on sale (YYYY-MM-DD, IST), or null for no expiry. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const dayToDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dateToDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/*
 * Compact date-only picker for a product's last day on sale. Days before today
 * (IST) cannot be picked; Clear removes the expiry.
 */
export const ExpiryDateField: React.FC<ExpiryDateFieldProps> = ({ value, onChange, disabled, className }) => {
  const [open, setOpen] = useState(false);
  const today = dayToDate(todayIst());
  const selected = value ? dayToDate(value) : undefined;

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button type="button" variant="outline" size="sm" className={styles.trigger} disabled={disabled}>
            <CalendarClock size={16} aria-hidden="true" />
            {value ? formatExpiryDay(value) : <span className={styles.placeholder}>No expiry date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent removeBackgroundAndPadding align="start" collisionPadding={8}>
          <div className={styles.calendar}>
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? today}
              disabled={{ before: today }}
              startMonth={today}
              onSelect={(date?: Date) => {
                if (!date) return;
                onChange(dateToDay(date));
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.clear}
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X size={14} aria-hidden="true" />
          Remove
        </Button>
      )}
    </div>
  );
};