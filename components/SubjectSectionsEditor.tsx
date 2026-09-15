import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Selectable } from 'kysely';
import { SubjectSections, TestQuestions } from '../helpers/schema';
import { useSubjectSectionsQuery, useSubjectSectionsMutations } from '../helpers/useSubjectSections';
import { useTeacherQuestionsBySubjectQuery, useAssignSectionsMutation } from '../helpers/useTeacherQuestionsBySubject';
import { mergeRangeEntries, type RangeEntry } from '../helpers/testSeriesEditing';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import styles from './SubjectSectionsEditor.module.css';

type Section = Selectable<SubjectSections>;
type Question = Selectable<TestQuestions>;

export type SubjectSectionsEditorHandle = {
  /** True while typed From Q / To Q ranges have not been applied. */
  hasPendingAssignments: () => boolean;
  /** Validates and saves typed ranges. Resolves false when they were not saved. */
  applyPendingAssignments: () => Promise<boolean>;
};

type SectionRowProps = {
  section: Section;
  subjectId: number;
  fromQ: string;
  toQ: string;
  onChangeRange: (field: 'fromQ' | 'toQ', value: string) => void;
  isAssignBusy: boolean;
  totalQuestions: number;
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getNextSectionName(existingSections: Section[]): string {
  const taken = new Set(existingSections.map((s) => s.sectionName));
  for (const letter of LETTERS) {
    if (!taken.has(`Section ${letter}`)) return `Section ${letter}`;
  }
  let n = existingSections.length + 1;
  while (taken.has(`Section ${n}`)) n++;
  return `Section ${n}`;
}

function deriveInitialRanges(sections: Section[], questions: Question[]): Record<number, RangeEntry> {
  const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const ranges: Record<number, RangeEntry> = {};

  sections.forEach((section) => {
    const indices: number[] = [];
    sorted.forEach((q, idx) => {
      if (q.sectionId === section.id) indices.push(idx + 1);
    });
    ranges[section.id] =
      indices.length === 0
        ? { fromQ: '', toQ: '' }
        : { fromQ: String(Math.min(...indices)), toQ: String(Math.max(...indices)) };
  });
  return ranges;
}

function validateRanges(entries: { fromQ: string; toQ: string; name: string }[], total: number): string | null {
  const filled = entries.filter((e) => e.fromQ !== '' || e.toQ !== '');

  for (const entry of filled) {
    const from = parseInt(entry.fromQ, 10);
    const to = parseInt(entry.toQ, 10);

    if (entry.fromQ === '' || entry.toQ === '') {
      return `Section "${entry.name}": fill both From Q and To Q, or leave both empty.`;
    }
    if (isNaN(from) || isNaN(to)) {
      return `Section "${entry.name}": From Q and To Q must be numbers.`;
    }
    if (from < 1 || to < 1) {
      return `Section "${entry.name}": question numbers start at 1.`;
    }
    if (from > total || to > total) {
      return `Section "${entry.name}": question numbers must be between 1 and ${total}.`;
    }
    if (from > to) {
      return `Section "${entry.name}": From Q (${from}) must not be after To Q (${to}).`;
    }
  }

  const ranges = filled
    .map((e) => ({ from: parseInt(e.fromQ, 10), to: parseInt(e.toQ, 10), name: e.name }))
    .sort((a, b) => a.from - b.from);

  for (let i = 0; i < ranges.length - 1; i++) {
    if (ranges[i].to >= ranges[i + 1].from) {
      return `Sections "${ranges[i].name}" and "${ranges[i + 1].name}" overlap.`;
    }
  }

  return null;
}

// These inputs sit inside the subject dialog's form, where Enter would submit
// the whole dialog. Enter commits the field on its own instead.
const commitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.currentTarget.blur();
};

const ignoreEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.preventDefault();
};

function SectionRow({ section, subjectId, fromQ, toQ, onChangeRange, isAssignBusy, totalQuestions }: SectionRowProps) {
  const [name, setName] = useState(section.sectionName);
  const [maxAttempts, setMaxAttempts] = useState(
    section.maxAttemptsAllowed != null ? String(section.maxAttemptsAllowed) : ''
  );

  const { useUpdateSectionMutation, useDeleteSectionMutation } = useSubjectSectionsMutations(subjectId);
  const updateSection = useUpdateSectionMutation();
  const deleteSection = useDeleteSectionMutation();

  // Follow the saved values when they change on the server.
  useEffect(() => {
    setName(section.sectionName);
    setMaxAttempts(section.maxAttemptsAllowed != null ? String(section.maxAttemptsAllowed) : '');
  }, [section.sectionName, section.maxAttemptsAllowed]);

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(section.sectionName);
      return;
    }
    if (trimmed === section.sectionName) return;

    toast.promise(updateSection.mutateAsync({ id: section.id, sectionName: trimmed }), {
      loading: 'Renaming section...',
      success: 'Section renamed.',
      error: (err) => (err instanceof Error ? err.message : 'Could not rename the section.'),
    });
  };

  const handleMaxAttemptsBlur = () => {
    const parsed = maxAttempts.trim() === '' ? null : parseInt(maxAttempts, 10);
    const currentValue = section.maxAttemptsAllowed ?? null;

    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      setMaxAttempts(currentValue != null ? String(currentValue) : '');
      toast.error('Max attempts must be a positive number.');
      return;
    }

    if (parsed === currentValue) return;

    toast.promise(updateSection.mutateAsync({ id: section.id, maxAttemptsAllowed: parsed }), {
      loading: 'Updating section...',
      success: 'Max attempts updated.',
      error: (err) => (err instanceof Error ? err.message : 'Could not update the section.'),
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete section "${section.sectionName}"? Its questions stay in this subject without a section.`)) return;

    toast.promise(deleteSection.mutateAsync({ id: section.id }), {
      loading: 'Deleting section...',
      success: 'Section deleted.',
      error: (err) => (err instanceof Error ? err.message : 'Could not delete the section.'),
    });
  };

  const isBusy = updateSection.isPending || deleteSection.isPending;

  return (
    <div className={styles.sectionRow}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
        onKeyDown={commitOnEnter}
        disabled={isBusy}
        placeholder="Section name"
        aria-label="Section name"
      />
      <Input
        className={styles.numberInput}
        type="number"
        min={1}
        value={maxAttempts}
        onChange={(e) => setMaxAttempts(e.target.value)}
        onBlur={handleMaxAttemptsBlur}
        onKeyDown={commitOnEnter}
        disabled={isBusy}
        placeholder="No limit"
        aria-label={`Max attempts for section ${section.sectionName}`}
      />
      <Input
        className={styles.numberInput}
        type="number"
        min={1}
        max={totalQuestions}
        value={fromQ}
        onChange={(e) => onChangeRange('fromQ', e.target.value)}
        onKeyDown={ignoreEnter}
        placeholder="-"
        disabled={isAssignBusy || totalQuestions === 0}
        aria-label={`From question for section ${section.sectionName}`}
      />
      <Input
        className={styles.numberInput}
        type="number"
        min={1}
        max={totalQuestions}
        value={toQ}
        onChange={(e) => onChangeRange('toQ', e.target.value)}
        onKeyDown={ignoreEnter}
        placeholder="-"
        disabled={isAssignBusy || totalQuestions === 0}
        aria-label={`To question for section ${section.sectionName}`}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDelete}
        disabled={isBusy}
        aria-label={`Delete section ${section.sectionName}`}
        className={styles.deleteButton}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

type SubjectSectionsEditorProps = {
  subjectId: number;
  className?: string;
};

export const SubjectSectionsEditor = forwardRef<SubjectSectionsEditorHandle, SubjectSectionsEditorProps>(
  function SubjectSectionsEditor({ subjectId, className }, ref) {
    const sectionsQuery = useSubjectSectionsQuery(subjectId);
    const questionsQuery = useTeacherQuestionsBySubjectQuery(subjectId);
    const sections = sectionsQuery.data;
    const questions = questionsQuery.data;

    const { useCreateSectionMutation } = useSubjectSectionsMutations(subjectId);
    const createSection = useCreateSectionMutation();
    const assignMutation = useAssignSectionsMutation(subjectId);

    const [rangeEntries, setRangeEntries] = useState<Record<number, RangeEntry>>({});
    const [initialRangeEntries, setInitialRangeEntries] = useState<Record<number, RangeEntry>>({});
    const touchedRef = useRef<Set<number>>(new Set());

    // Re-derive ranges only when the set of sections or where questions sit
    // changes. A rename or max-attempts edit refetches the list as well, and
    // must not wipe ranges the teacher typed but has not applied yet.
    const structureKey =
      sections && questions
        ? JSON.stringify([sections.map((s) => s.id), questions.map((q) => [q.id, q.sectionId, q.orderIndex])])
        : null;

    useEffect(() => {
      if (!sections || !questions) return;
      const derived = deriveInitialRanges(sections, questions);
      setInitialRangeEntries(derived);
      setRangeEntries((current) => mergeRangeEntries(current, derived, touchedRef.current));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [structureKey]);

    const sortedQuestions = questions ? [...questions].sort((a, b) => a.orderIndex - b.orderIndex) : [];
    const unsectionedCount = sortedQuestions.filter((q) => q.sectionId == null).length;
    const totalQuestions = sortedQuestions.length;
    const isAssignDirty = JSON.stringify(rangeEntries) !== JSON.stringify(initialRangeEntries);

    const latest = useRef({ rangeEntries, isAssignDirty, sections, sortedQuestions });
    latest.current = { rangeEntries, isAssignDirty, sections, sortedQuestions };

    const applyAssignments = async (): Promise<boolean> => {
      const { rangeEntries: entries, isAssignDirty: dirty, sections: currentSections, sortedQuestions: ordered } =
        latest.current;
      if (!dirty || !currentSections) return true;

      const error = validateRanges(
        Object.entries(entries).map(([idStr, r]) => ({
          ...r,
          name: currentSections.find((s) => s.id === Number(idStr))?.sectionName ?? '',
        })),
        ordered.length
      );
      if (error) {
        toast.error(error);
        return false;
      }

      const assignments: { sectionId: number | null; questionIds: number[] }[] = [];
      const assignedIds = new Set<number>();
      for (const [idStr, entry] of Object.entries(entries)) {
        if (entry.fromQ === '' && entry.toQ === '') continue;
        const ids: number[] = [];
        for (let qi = parseInt(entry.fromQ, 10) - 1; qi <= parseInt(entry.toQ, 10) - 1; qi++) {
          if (ordered[qi]) {
            ids.push(ordered[qi].id);
            assignedIds.add(ordered[qi].id);
          }
        }
        assignments.push({ sectionId: Number(idStr), questionIds: ids });
      }
      const unsectionedIds = ordered.filter((q) => !assignedIds.has(q.id)).map((q) => q.id);
      if (unsectionedIds.length > 0) {
        assignments.push({ sectionId: null, questionIds: unsectionedIds });
      }

      const promise = assignMutation.mutateAsync({ subjectId, assignments });
      toast.promise(promise, {
        loading: 'Assigning questions to sections...',
        success: 'Questions assigned to sections.',
        error: (err) => (err instanceof Error ? err.message : 'Could not assign the questions.'),
      });
      try {
        await promise;
      } catch {
        return false;
      }
      touchedRef.current = new Set();
      setInitialRangeEntries(entries);
      return true;
    };

    useImperativeHandle(ref, () => ({
      hasPendingAssignments: () => latest.current.isAssignDirty,
      applyPendingAssignments: applyAssignments,
    }));

    const handleAddSection = () => {
      const existing = sections ?? [];
      const nextName = getNextSectionName(existing);
      const nextOrderIndex = existing.reduce((max, s) => Math.max(max, s.orderIndex + 1), 0);

      toast.promise(createSection.mutateAsync({ subjectId, sectionName: nextName, orderIndex: nextOrderIndex }), {
        loading: 'Adding section...',
        success: `Section "${nextName}" added.`,
        error: (err) => (err instanceof Error ? err.message : 'Could not add the section.'),
      });
    };

    const isInitialLoading = sectionsQuery.isLoading || questionsQuery.isLoading;
    const loadFailed = (sectionsQuery.isError && !sections) || (questionsQuery.isError && !questions);

    return (
      <div className={`${styles.container} ${className ?? ''}`}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.label}>Sections</span>
            {sections && sections.length > 0 && (
              <span className={styles.totalInfo}>
                {totalQuestions} question{totalQuestions === 1 ? '' : 's'} in this subject
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSection}
            disabled={createSection.isPending || !sections}
          >
            <Plus size={14} /> Add Section
          </Button>
        </div>

        {isInitialLoading ? (
          <div className={styles.skeletonList}>
            <Skeleton style={{ height: '2.5rem' }} />
            <Skeleton style={{ height: '2.5rem' }} />
          </div>
        ) : loadFailed ? (
          <p className={styles.emptyText}>Could not load the sections. Close the dialog and try again.</p>
        ) : sections && sections.length > 0 ? (
          <div className={styles.sectionList}>
            <div className={styles.columnHeaders} aria-hidden="true">
              <span>Name</span>
              <span className={styles.columnCenter}>Max attempts</span>
              <span className={styles.columnCenter}>From Q</span>
              <span className={styles.columnCenter}>To Q</span>
            </div>
            {sections.map((section) => {
              const range = rangeEntries[section.id] || { fromQ: '', toQ: '' };
              return (
                <SectionRow
                  key={section.id}
                  section={section}
                  subjectId={subjectId}
                  fromQ={range.fromQ}
                  toQ={range.toQ}
                  onChangeRange={(field, value) => {
                    touchedRef.current.add(section.id);
                    setRangeEntries((prev) => ({
                      ...prev,
                      [section.id]: { ...(prev[section.id] ?? { fromQ: '', toQ: '' }), [field]: value },
                    }));
                  }}
                  isAssignBusy={assignMutation.isPending}
                  totalQuestions={totalQuestions}
                />
              );
            })}

            {isAssignDirty && (
              <div className={styles.applyAction}>
                <span className={styles.pendingNote}>Ranges not applied yet. Saving the subject applies them too.</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void applyAssignments()}
                  disabled={assignMutation.isPending || totalQuestions === 0}
                >
                  Apply Assignments
                </Button>
              </div>
            )}

            {unsectionedCount > 0 && (
              <p className={styles.unsectionedInfo}>
                {unsectionedCount} {unsectionedCount === 1 ? 'question is' : 'questions are'} not in any section.
              </p>
            )}
          </div>
        ) : (
          <p className={styles.emptyText}>No sections yet. Add a section to split this subject into parts.</p>
        )}
      </div>
    );
  }
);
