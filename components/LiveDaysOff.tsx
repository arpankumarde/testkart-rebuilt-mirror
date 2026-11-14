import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import {
  useAddBlockedDateMutation,
  useDeleteBlockedDateMutation,
  useTeacherAvailabilityQuery,
} from "../helpers/useTeacherMentorship";
import field from "./LiveField.module.css";
import styles from "./LiveDaysOff.module.css";

/* Dates with no open slots. Each add and remove saves at once; the body only, without its card. */
export const LiveDaysOff: React.FC = () => {
  const { data, isFetching } = useTeacherAvailabilityQuery();
  const addBlockedDate = useAddBlockedDateMutation();
  const deleteBlockedDate = useDeleteBlockedDateMutation();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const add = () => {
    if (!date) {
      setDateError("Pick a date to block.");
      return;
    }
    setDateError(null);
    addBlockedDate.mutate(
      { blockedDate: new Date(date), reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setDate("");
          setReason("");
          toast.success("Day off added.");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not block this date."),
      }
    );
  };

  return (
    <div className={styles.body}>
      <div className={styles.form}>
        <Input
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setDateError(null);
          }}
          className={field.input}
          aria-label="Date to block"
          aria-invalid={!!dateError || undefined}
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={field.input}
          placeholder="Reason (optional)"
          aria-label="Reason (optional)"
          maxLength={200}
        />
        <Button variant="outline" className={styles.addButton} onClick={add} disabled={addBlockedDate.isPending}>
          <Plus size={16} aria-hidden="true" /> {addBlockedDate.isPending ? "Adding..." : "Add day off"}
        </Button>
      </div>
      {dateError && (
        <p className={field.error} role="alert">
          {dateError}
        </p>
      )}

      {isFetching && !data ? (
        <Skeleton style={{ height: "3rem", width: "100%" }} />
      ) : data && data.blockedDates.length > 0 ? (
        <ul className={styles.list}>
          {data.blockedDates.map((b) => (
            <li key={b.id} className={styles.row}>
              <span className={styles.rowIcon} aria-hidden="true">
                <CalendarX size={16} />
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowDate}>
                  {new Date(b.blockedDate).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {b.reason && <span className={styles.rowReason}>{b.reason}</span>}
              </span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => deleteBlockedDate.mutate(b.id)}
                disabled={deleteBlockedDate.isPending}
                aria-label="Remove this day off"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No days off planned.</p>
      )}
    </div>
  );
};