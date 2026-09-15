import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Layers, BookOpen, Clock, Tag, ChevronDown, ChevronUp, Library, AlertTriangle, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useTeacherQuestionBankQuery, useDeleteBankQuestionsMutation } from '../helpers/useTeacherQuestionBank';
import { useTeacherTestsQuery, useTeacherTestItemsQuery } from '../helpers/useTeacherTestsQuery';
import { useDebounce } from '../helpers/useDebounce';
import { QuestionBank } from '../helpers/schema';
import { Selectable } from 'kysely';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Badge } from '../components/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../components/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/DropdownMenu';
import { MathMLContent } from '../components/MathMLContent';
import { Skeleton } from '../components/Skeleton';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { TeacherListToolbar, teacherToolbarControlClass } from '../components/TeacherListToolbar';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherListPagination } from '../components/TeacherListPagination';
import { BankQuestionForm } from '../components/BankQuestionForm';
import { BulkBankQuestionUpload } from '../components/BulkBankQuestionUpload';

import styles from './teacher.question-bank.module.css';

const TeacherQuestionBankPage: React.FC = () => {
  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('__empty');
  const [testItem, setTestItem] = useState<string>('__empty');
  const [subjectName, setSubjectName] = useState('');

  // Debounced filters
  const debouncedSearch = useDebounce(search, 500);
  const debouncedSubjectName = useDebounce(subjectName, 500);

  // Queries
  const sourceMockTestId = source !== '__empty' && source !== 'directly_uploaded' ? parseInt(source) : undefined;
  const sourceTestItemId = testItem !== '__empty' ? parseInt(testItem) : undefined;
  const isSourceSelected = source !== '__empty' && source !== 'directly_uploaded';

  const { data: testsData } = useTeacherTestsQuery();
  const { data: testItemsData } = useTeacherTestItemsQuery(sourceMockTestId || null);

  const { data, isFetching, error } = useTeacherQuestionBankQuery({
    page,
    limit: 100,
    search: debouncedSearch || undefined,
    subjectName: isSourceSelected ? subjectName || undefined : debouncedSubjectName || undefined,
    sourceMockTestId,
    sourceTestItemId,
    directlyUploaded: source === 'directly_uploaded' ? true : undefined,
  });

  const hasFilters = !!search || source !== '__empty' || !!subjectName;

  const clearFilters = () => {
    setSearch('');
    setSource('__empty');
    setTestItem('__empty');
    setSubjectName('');
    setPage(1);
  };

  const handleSourceChange = (val: string) => {
    setSource(val);
    setTestItem('__empty');
    setSubjectName('');
    setPage(1);
  };

  const handleTestItemChange = (val: string) => {
    setTestItem(val);
    setSubjectName('');
    setPage(1);
  };

  const deleteMutation = useDeleteBankQuestionsMutation();

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<Selectable<QuestionBank> | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Selectable<QuestionBank> | null>(null);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const [expandedOptions, setExpandedOptions] = useState<Set<number>>(new Set());

  const toggleOptions = (id: number) => {
    setExpandedOptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderOptions = (q: Selectable<QuestionBank>) => {
    if (q.questionType === 'numerical') {
      return (
        <div className={styles.numericalAnswer}>
          <span className={styles.answerLabel}>Correct answer: </span>
          {q.numericalAnswer}
        </div>
      );
    }

    const options = [
      { key: 'a', label: 'A', text: q.optionA },
      { key: 'b', label: 'B', text: q.optionB },
      { key: 'c', label: 'C', text: q.optionC },
      { key: 'd', label: 'D', text: q.optionD },
    ];

    return (
      <>
        {options.map(opt => {
          if (!opt.text) return null;
          let isCorrect = false;
          if (q.questionType === 'single_correct_mcq') {
            isCorrect = q.correctOption === opt.key;
          } else if (q.questionType === 'multiple_correct_mcq') {
            isCorrect = Array.isArray(q.correctOptions)
              ? q.correctOptions.includes(opt.key)
              : typeof q.correctOptions === 'string' && (q.correctOptions as string).includes(opt.key);
          }
          return (
            <div key={opt.key} className={`${styles.option} ${isCorrect ? styles.correct : ''}`}>
              <span className={styles.optionLabel}>{opt.label}</span>
              <MathMLContent html={opt.text} />
            </div>
          );
        })}
      </>
    );
  };

  const formatQuestionType = (type?: string | null) => {
    if (!type) return "Unknown";
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleAddClick = () => {
    setQuestionToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (q: Selectable<QuestionBank>) => {
    setQuestionToEdit(q);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!questionToDelete) return;
    deleteMutation.mutate({ questionIds: [questionToDelete.id] }, {
      onSuccess: () => {
        toast.success("Question deleted.");
        setQuestionToDelete(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Could not delete the question.");
      }
    });
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className={styles.card}>
              <Skeleton style={{ height: '1.5rem', width: '30%' }} />
              <Skeleton style={{ height: '4rem', width: '100%' }} />
              <Skeleton style={{ height: '1.5rem', width: '50%' }} />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          icon={<AlertTriangle size={26} />}
          title="Could not load your questions"
          description={error instanceof Error ? error.message : 'Something went wrong on our side.'}
        />
      );
    }

    if (!data?.questions || data.questions.length === 0) {
      return hasFilters ? (
        <TeacherListEmpty
          icon={<Library size={26} />}
          title="No questions match these filters"
          description="Try a different test series or subject, or search for different wording."
        >
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        </TeacherListEmpty>
      ) : (
        <TeacherListEmpty
          icon={<Library size={26} />}
          title="Your question bank is empty"
          description="Questions you add here can be reused across any of your mock tests, so you only write them once."
        >
          <Button onClick={handleAddClick}>
            <Plus size={16} /> Add a question
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <>
        <div className={styles.list}>
          {data.questions.map(q => (
            <article key={q.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <Badge variant="secondary">{formatQuestionType(q.questionType)}</Badge>
                <div className={styles.meta}>
                  <span className={styles.metaItem} title="Source">
                    <Layers size={14} aria-hidden="true" />
                    {q.sourceTestSeriesTitle
                      ? q.sourceTestItemTitle
                        ? `${q.sourceTestSeriesTitle} → ${q.sourceTestItemTitle}`
                        : q.sourceTestSeriesTitle
                      : 'Directly uploaded'}
                  </span>
                  {q.subjectName && (
                    <span className={styles.metaItem} title="Subject">
                      <BookOpen size={14} aria-hidden="true" /> {q.subjectName}
                    </span>
                  )}
                  <span className={styles.marks} title="Marks">
                    <span className={styles.positive}>+{q.positiveMarks}</span>
                    <span aria-hidden="true">/</span>
                    <span className={styles.negative}>-{q.negativeMarks}</span>
                  </span>
                  {q.createdAt && (
                    <span className={styles.metaItem} title="Added">
                      <Clock size={14} aria-hidden="true" />
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(q.createdAt))}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.question}>
                <MathMLContent html={q.questionText} maxLength={250} />
              </div>

              <div>
                <Button variant="outline" size="sm" onClick={() => toggleOptions(q.id)}>
                  {expandedOptions.has(q.id) ? (
                    <><ChevronUp size={14} /> Hide answer</>
                  ) : (
                    <><ChevronDown size={14} /> Show answer</>
                  )}
                </Button>
              </div>

              {expandedOptions.has(q.id) && (
                <div className={styles.options}>{renderOptions(q)}</div>
              )}

              <div className={styles.cardFooter}>
                <div className={styles.tags}>
                  {q.tags && q.tags.length > 0 ? (
                    q.tags.map((t, i) => (
                      <Badge key={i} variant="outline" className={styles.tag}>
                        <Tag size={12} aria-hidden="true" /> {t}
                      </Badge>
                    ))
                  ) : (
                    <span className={styles.noTags}>No tags</span>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(q)}>Edit</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="More actions for this question">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className={`${styles.menuItem} ${styles.destructive}`}
                        onClick={() => setQuestionToDelete(q)}
                      >
                        <Trash2 size={14} /> Delete question
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <TeacherListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Question Bank | Teacher Dashboard - Testkart</title>
        <meta name="description" content="Manage your reusable question bank on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Question Bank">
          <BulkBankQuestionUpload
            subjectName={isSourceSelected ? subjectName || undefined : debouncedSubjectName || undefined}
            onSuccess={() => setPage(1)}
          />
          <Button onClick={handleAddClick}>
            <Plus size={16} />
            Add question
          </Button>
        </TeacherPageHeader>

        <TeacherListToolbar
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
            placeholder: 'Search question text',
            label: 'Search questions',
          }}
        >
          <Select value={source} onValueChange={handleSourceChange}>
            <SelectTrigger className={teacherToolbarControlClass} aria-label="Filter by source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty">All sources</SelectItem>
              <SelectItem value="directly_uploaded">Directly uploaded</SelectItem>
              {testsData?.map(test => (
                <SelectItem key={test.id} value={test.id.toString()}>
                  {test.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isSourceSelected && (
            <Select value={testItem} onValueChange={handleTestItemChange}>
              <SelectTrigger className={teacherToolbarControlClass} aria-label="Filter by test">
                <SelectValue placeholder="All tests" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">All tests</SelectItem>
                {testItemsData?.map(item => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isSourceSelected ? (
            <Select
              value={subjectName || '__empty'}
              onValueChange={(val) => { setSubjectName(val === '__empty' ? '' : val); setPage(1); }}
            >
              <SelectTrigger className={teacherToolbarControlClass} aria-label="Filter by subject">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">All subjects</SelectItem>
                {data?.availableSubjects?.map(subj => (
                  <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className={teacherToolbarControlClass}
              placeholder="All subjects"
              aria-label="Filter by subject"
              value={subjectName}
              onChange={(e) => { setSubjectName(e.target.value); setPage(1); }}
            />
          )}
        </TeacherListToolbar>

        {data && (
          <span className={styles.resultCount}>
            Showing {data.questions.length} of {data.total} question{data.total === 1 ? '' : 's'}
          </span>
        )}

        {renderContent()}

        {/* Form Modal */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent style={{ maxWidth: '800px', width: '90vw' }}>
            <DialogHeader>
              <DialogTitle>{questionToEdit ? 'Edit question' : 'Add question'}</DialogTitle>
              <DialogDescription>
                {questionToEdit ? 'Changes apply everywhere this question is used.' : 'Add a question you can reuse across your mock tests.'}
              </DialogDescription>
            </DialogHeader>
            <BankQuestionForm
              questionToEdit={questionToEdit}
              onSuccess={() => setIsFormOpen(false)}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this question?</DialogTitle>
              <DialogDescription>
                It is removed from your question bank for good. Tests that already include it keep
                their own copy. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setQuestionToDelete(null)}>Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default TeacherQuestionBankPage;
