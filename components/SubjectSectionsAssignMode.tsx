import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Selectable } from 'kysely';
import { SubjectSections, TestQuestions } from '../helpers/schema';
import { useAssignSectionsMutation } from '../helpers/useTeacherQuestionsBySubject';
import { Button } from './Button';
import { Input } from './Input';
import styles from './SubjectSectionsAssignMode.module.css';

type AssignmentEntry = {
  sectionId: number;
  sectionName: string;
  fromQ: string;
  toQ: string;
};

type Props = {
  subjectId: number;
  sections: Selectable<SubjectSections>[];
  questions: Selectable<TestQuestions>[];
  onClose: () => void;
};

/**
 * Derive initial assignment ranges from current question→section assignments.
 * Questions are sorted by orderIndex. For each section, find the contiguous block
 * (or first/last 1-based indices) assigned to it.
 */
function deriveInitialRanges(
  sections: Selectable<SubjectSections>[],
  questions: Selectable<TestQuestions>[]
): AssignmentEntry[] {
  const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);

  return sections.map((section) => {
    const indices: number[] = [];
    sorted.forEach((q, idx) => {
      if (q.sectionId === section.id) {
        indices.push(idx + 1); // 1-based
      }
    });

    if (indices.length === 0) {
      return { sectionId: section.id, sectionName: section.sectionName, fromQ: '', toQ: '' };
    }

    return {
      sectionId: section.id,
      sectionName: section.sectionName,
      fromQ: String(Math.min(...indices)),
      toQ: String(Math.max(...indices)),
    };
  });
}

type ValidationError = string | null;

function validateRanges(entries: AssignmentEntry[], total: number): ValidationError {
  const filled = entries.filter((e) => e.fromQ !== '' || e.toQ !== '');

  for (const entry of filled) {
    const from = parseInt(entry.fromQ, 10);
    const to = parseInt(entry.toQ, 10);

    if (entry.fromQ === '' || entry.toQ === '') {
      return `Section "${entry.sectionName}": both From Q and To Q must be filled (or both empty).`;
    }
    if (isNaN(from) || isNaN(to)) {
      return `Section "${entry.sectionName}": From Q and To Q must be valid numbers.`;
    }
    if (from < 1 || to < 1) {
      return `Section "${entry.sectionName}": question numbers must be at least 1.`;
    }
    if (from > total || to > total) {
      return `Section "${entry.sectionName}": question numbers must be within 1–${total}.`;
    }
    if (from > to) {
      return `Section "${entry.sectionName}": From Q (${from}) must be ≤ To Q (${to}).`;
    }
  }

  // Check for overlaps
  const ranges = filled
    .map((e) => ({ from: parseInt(e.fromQ, 10), to: parseInt(e.toQ, 10), name: e.sectionName }))
    .sort((a, b) => a.from - b.from);

  for (let i = 0; i < ranges.length - 1; i++) {
    if (ranges[i].to >= ranges[i + 1].from) {
      return `Sections "${ranges[i].name}" and "${ranges[i + 1].name}" have overlapping ranges.`;
    }
  }

  return null;
}

export function SubjectSectionsAssignMode({ subjectId, sections, questions, onClose }: Props) {
  const [entries, setEntries] = useState<AssignmentEntry[]>(() =>
    deriveInitialRanges(sections, questions)
  );

  // Re-derive if sections/questions change externally
  useEffect(() => {
    setEntries(deriveInitialRanges(sections, questions));
  }, [sections, questions]);

  const assignMutation = useAssignSectionsMutation(subjectId);
  const total = questions.length;

  const updateEntry = (index: number, field: 'fromQ' | 'toQ', value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const handleApply = () => {
    const error = validateRanges(entries, total);
    if (error) {
      toast.error(error);
      return;
    }

    const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);

    // Build a map: questionId -> sectionId | null
    const assignments: { sectionId: number | null; questionIds: number[] }[] = [];

    // For each filled section, collect question IDs in that range
    const assignedIds = new Set<number>();
    for (const entry of entries) {
      if (entry.fromQ === '' && entry.toQ === '') continue;
      const from = parseInt(entry.fromQ, 10);
      const to = parseInt(entry.toQ, 10);
      const ids: number[] = [];
      for (let qi = from - 1; qi <= to - 1; qi++) {
        if (sorted[qi]) {
          ids.push(sorted[qi].id);
          assignedIds.add(sorted[qi].id);
        }
      }
      assignments.push({ sectionId: entry.sectionId, questionIds: ids });
    }

    // Unsectioned: all questions not covered by any range
    const unsectionedIds = sorted
      .filter((q) => !assignedIds.has(q.id))
      .map((q) => q.id);

    if (unsectionedIds.length > 0) {
      assignments.push({ sectionId: null, questionIds: unsectionedIds });
    }

    console.log(`Assigning questions for subject ${subjectId}:`, assignments);

    const promise = assignMutation.mutateAsync({ subjectId, assignments });
    toast.promise(promise, {
      loading: 'Assigning questions to sections...',
      success: () => {
        onClose();
        return 'Questions assigned successfully.';
      },
      error: (err) => (err instanceof Error ? err.message : 'Failed to assign questions.'),
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.totalInfo}>
        Total questions in subject: <strong>{total}</strong>
        {total === 0 && (
          <span className={styles.noQuestionsNote}> — no questions to assign yet.</span>
        )}
      </div>

      <div className={styles.assignmentList}>
        <div className={styles.assignmentHeader}>
          <span className={styles.headerSectionName}>Section</span>
          <span className={styles.headerRange}>From Q</span>
          <span className={styles.headerRange}>To Q</span>
        </div>

        {entries.map((entry, index) => (
          <div key={entry.sectionId} className={styles.assignmentRow}>
            <span className={styles.assignmentLabel}>{entry.sectionName}</span>
            <Input
              className={styles.rangeInput}
              type="number"
              min={1}
              max={total}
              value={entry.fromQ}
              onChange={(e) => updateEntry(index, 'fromQ', e.target.value)}
              placeholder="—"
              disabled={assignMutation.isPending || total === 0}
              aria-label={`From question for section ${entry.sectionName}`}
            />
            <Input
              className={styles.rangeInput}
              type="number"
              min={1}
              max={total}
              value={entry.toQ}
              onChange={(e) => updateEntry(index, 'toQ', e.target.value)}
              placeholder="—"
              disabled={assignMutation.isPending || total === 0}
              aria-label={`To question for section ${entry.sectionName}`}
            />
          </div>
        ))}
      </div>

      <p className={styles.helpText}>
        Questions not covered by any range will become <em>unsectioned</em>.
      </p>

      <div className={styles.assignmentActions}>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={assignMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={assignMutation.isPending || total === 0}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}