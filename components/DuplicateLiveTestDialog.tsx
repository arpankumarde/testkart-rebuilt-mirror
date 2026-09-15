import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./Dialog";
import { Button } from "./Button";
import { useTeacherLiveTestMutations } from "../helpers/useTeacherLiveTestMutations";
import { TeacherLiveTestItem } from "../endpoints/teacher/live-tests/list_GET.schema";
import styles from "./DuplicateLiveTestDialog.module.css";

interface DuplicateLiveTestDialogProps {
  liveTest: TeacherLiveTestItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newId: number) => void;
}

const formatDate = (date: Date | null) => {
  if (!date) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

const formatTime = (date: Date | null) => {
  if (!date) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(11, 16);
};

export const DuplicateLiveTestDialog: React.FC<DuplicateLiveTestDialogProps> = ({
  liveTest,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { useDuplicateLiveTestMutation } = useTeacherLiveTestMutations();
  const duplicateMutation = useDuplicateLiveTestMutation();

  const [startDate, setStartDate] = useState<string>("");
  const [startTimeVal, setStartTimeVal] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTimeVal, setEndTimeVal] = useState<string>("");
  const [deadlineDate, setDeadlineDate] = useState<string>("");
  const [deadlineTimeVal, setDeadlineTimeVal] = useState<string>("");
  const [errors, setErrors] = useState<{startTime?: string; endTime?: string; deadline?: string}>({});

  useEffect(() => {
    setErrors({});
  }, [startDate, startTimeVal, endDate, endTimeVal, deadlineDate, deadlineTimeVal]);

  useEffect(() => {
    if (open && liveTest) {
      const now = new Date();
      const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      defaultStart.setMinutes(0, 0, 0); // round to nearest hour
      
      const durationMs = liveTest.durationMinutes * 60 * 1000;
      // if duration is 0, just add 1 hour
      const defaultEnd = new Date(defaultStart.getTime() + (durationMs > 0 ? durationMs : 60 * 60 * 1000));
      
      const defaultDeadline = new Date(defaultStart.getTime() - 60 * 60 * 1000);

      setStartDate(formatDate(defaultStart));
      setStartTimeVal(formatTime(defaultStart));
      setEndDate(formatDate(defaultEnd));
      setEndTimeVal(formatTime(defaultEnd));
      setDeadlineDate(formatDate(defaultDeadline));
      setDeadlineTimeVal(formatTime(defaultDeadline));
    }
  }, [open, liveTest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTest) return;

    const newErrors: {startTime?: string; endTime?: string; deadline?: string} = {};

    if (!endDate || !endTimeVal) {
      newErrors.endTime = "End time is required.";
    }

    const start = startDate && startTimeVal ? new Date(`${startDate}T${startTimeVal}`) : null;
    const end = endDate && endTimeVal ? new Date(`${endDate}T${endTimeVal}`) : null;
    const deadline = deadlineDate && deadlineTimeVal ? new Date(`${deadlineDate}T${deadlineTimeVal}`) : null;

    if (deadline && start && deadline >= start) {
      newErrors.deadline = "Registration deadline must be before the start time.";
    }

    if (start && end && start >= end) {
      newErrors.startTime = "Start time must be before the end time.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    duplicateMutation.mutate(
      {
        liveTestId: liveTest.id,
        startTime: start,
        endTime: end!,
        registrationDeadline: deadline,
      },
      {
        onSuccess: (data) => {
          onSuccess(data.id);
        }
      }
    );
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-publish Live Test</DialogTitle>
          <DialogDescription>
            Duplicate "{liveTest?.title}" to run it again. This will create a new draft live test with all the original questions, subjects, and settings.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="startDate">Start Time</label>
            <div className={styles.row}>
              <input 
                id="startDate"
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className={styles.input}
              />
              <input 
                id="startTimeVal"
                type="time" 
                value={startTimeVal} 
                onChange={(e) => setStartTimeVal(e.target.value)} 
                className={styles.input}
              />
            </div>
            {errors.startTime && <span className={styles.errorText}>{errors.startTime}</span>}
          </div>
          
          <div className={styles.field}>
            <label htmlFor="endDate">End Time *</label>
            <div className={styles.row}>
              <input 
                id="endDate"
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                required
                className={styles.input}
              />
              <input 
                id="endTimeVal"
                type="time" 
                value={endTimeVal} 
                onChange={(e) => setEndTimeVal(e.target.value)} 
                required
                className={styles.input}
              />
            </div>
            {errors.endTime && <span className={styles.errorText}>{errors.endTime}</span>}
          </div>
          
          <div className={styles.field}>
            <label htmlFor="deadlineDate">Registration Deadline</label>
            <div className={styles.row}>
              <input 
                id="deadlineDate"
                type="date" 
                value={deadlineDate} 
                onChange={(e) => setDeadlineDate(e.target.value)} 
                className={styles.input}
              />
              <input 
                id="deadlineTimeVal"
                type="time" 
                value={deadlineTimeVal} 
                onChange={(e) => setDeadlineTimeVal(e.target.value)} 
                className={styles.input}
              />
            </div>
            {errors.deadline && <span className={styles.errorText}>{errors.deadline}</span>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={duplicateMutation.isPending || hasErrors}>
              {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};