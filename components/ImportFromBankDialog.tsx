import React, { useState, useEffect, useMemo } from "react";
import { Search, Layers, BookOpen, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { Badge } from "./Badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { MathMLContent } from "./MathMLContent";
import { Skeleton } from "./Skeleton";
import { useDebounce } from "../helpers/useDebounce";
import { useTeacherTestsQuery, useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import {
  useTeacherQuestionBankQuery,
  useImportToTestMutation,
} from "../helpers/useTeacherQuestionBank";
import { getTeacherQuestionBankList } from "../endpoints/teacher/question-bank/list_GET.schema";
import styles from "./ImportFromBankDialog.module.css";

interface ImportFromBankDialogProps {
  subjectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_correct_mcq: "Single MCQ",
  multiple_correct_mcq: "Multiple MCQ",
  numerical: "Numerical",
  match_the_following: "Match",
  comprehension: "Comprehension",
  assertion_reason: "Assertion",
};

export const ImportFromBankDialog = ({
  subjectId,
  open,
  onOpenChange,
  onSuccess,
}: ImportFromBankDialogProps) => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sourceFilter, setSourceFilter] = useState<string>("__empty");
  const [testItemFilter, setTestItemFilter] = useState<string>("__empty");
  const [subjectFilter, setSubjectFilter] = useState<string>("__empty");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isImportingAll, setIsImportingAll] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setSourceFilter("__empty");
      setTestItemFilter("__empty");
      setSubjectFilter("__empty");
      setPage(1);
      setSelectedIds(new Set());
    }
  }, [open]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter, testItemFilter, subjectFilter]);

  const { data: testsData } = useTeacherTestsQuery();

  const parsedSourceMockTestId =
    sourceFilter !== "__empty" && sourceFilter !== "directlyUploaded"
      ? parseInt(sourceFilter, 10)
      : null;

  const { data: testItemsData } = useTeacherTestItemsQuery(parsedSourceMockTestId);

  const handleSourceFilterChange = (value: string) => {
    setSourceFilter(value);
    setTestItemFilter("__empty");
    setSubjectFilter("__empty");
  };

  const handleTestItemFilterChange = (value: string) => {
    setTestItemFilter(value);
    setSubjectFilter("__empty");
  };

  const queryParams: any = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    checkSubjectId: subjectId,
  };

  if (sourceFilter === "directlyUploaded") {
    queryParams.directlyUploaded = true;
  } else if (sourceFilter !== "__empty") {
    queryParams.sourceMockTestId = parseInt(sourceFilter, 10);
  }

  if (testItemFilter !== "__empty") {
    queryParams.sourceTestItemId = parseInt(testItemFilter, 10);
  }

  if (subjectFilter !== "__empty") {
    queryParams.subjectName = subjectFilter;
  }

  const { data: bankData, isFetching } = useTeacherQuestionBankQuery(queryParams);

  const importMutation = useImportToTestMutation();

  const currentIds = useMemo(
    () => bankData?.questions.map((q) => q.id) || [],
    [bankData?.questions]
  );

  const isAllCurrentSelected =
    currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = (checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      currentIds.forEach((id) => newSelected.add(id));
    } else {
      currentIds.forEach((id) => newSelected.delete(id));
    }
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    importMutation.mutate(
      {
        questionBankIds: Array.from(selectedIds),
        subjectId,
      },
      {
        onSuccess: (data) => {
          toast.success(`Successfully imported ${data.importedCount} question(s)!`);
          onSuccess();
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to import questions"
          );
        },
      }
    );
  };

  const handleImportAllFromSubject = async () => {
    if (subjectFilter === "__empty") return;

    setIsImportingAll(true);
    try {
      let currentPage = 1;
      let hasMore = true;
      const allIds: number[] = [];

      while (hasMore) {
        const pageData = await getTeacherQuestionBankList({
          ...queryParams,
          page: currentPage,
          limit: 100,
        });

        const pageIds = pageData.questions
          .map((q) => q.id)
          .filter((id): id is number => id !== undefined && id !== null);

        allIds.push(...pageIds);

        if (pageData.questions.length < 100) {
          hasMore = false;
        } else {
          currentPage++;
        }
      }

      if (allIds.length === 0) {
        toast.info("No questions found to import.");
        setIsImportingAll(false);
        return;
      }

      importMutation.mutate(
        {
          questionBankIds: allIds,
          subjectId,
        },
        {
          onSuccess: (data) => {
            toast.success(`Successfully imported ${data.importedCount} question(s)!`);
            onSuccess();
            onOpenChange(false);
          },
          onError: (error) => {
            toast.error(
              error instanceof Error ? error.message : "Failed to import questions"
            );
            setIsImportingAll(false);
          },
          onSettled: () => {
            setIsImportingAll(false);
          },
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch questions for import"
      );
      setIsImportingAll(false);
    }
  };

  const totalPages = bankData ? Math.ceil(bankData.total / bankData.limit) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Import from Question Bank</DialogTitle>
        </DialogHeader>

        <div className={styles.container}>
          {/* Left Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.filters}>
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <Input
                  type="search"
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>
                  <Layers size={12} /> Test Series
                </label>
                <Select value={sourceFilter} onValueChange={handleSourceFilterChange}>
                  <SelectTrigger className={styles.filterSelect}>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">All Sources</SelectItem>
                    <SelectItem value="directlyUploaded">Directly Uploaded</SelectItem>
                    {testsData?.map((test) => (
                      <SelectItem key={test.id} value={test.id.toString()}>
                        {test.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {parsedSourceMockTestId && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>
                    <BookOpen size={12} /> Test Item
                  </label>
                  <Select value={testItemFilter} onValueChange={handleTestItemFilterChange}>
                    <SelectTrigger className={styles.filterSelect}>
                      <SelectValue placeholder="All Test Items" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty">All Test Items</SelectItem>
                      {testItemsData?.map((ti) => (
                        <SelectItem key={ti.id} value={ti.id.toString()}>
                          {ti.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>
                  <Tag size={12} /> Subject
                </label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className={styles.filterSelect}>
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">All Subjects</SelectItem>
                    {bankData?.availableSubjects?.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {subjectFilter !== "__empty" && (
              <div className={styles.sidebarFooter}>
                <Button
                  variant="outline"
                  className={styles.importAllButton}
                  onClick={handleImportAllFromSubject}
                  disabled={isImportingAll || importMutation.isPending}
                >
                  {isImportingAll ? "Importing All..." : "Import All from Subject"}
                </Button>
              </div>
            )}
          </div>

          {/* Right Main Area */}
          <div className={styles.mainArea}>
            <div className={styles.listHeader}>
              <div className={styles.selectAllWrapper}>
                <Checkbox
                  id="selectAllBankQuestions"
                  checked={isAllCurrentSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  disabled={isFetching || currentIds.length === 0}
                />
                <label htmlFor="selectAllBankQuestions" className={styles.selectAllLabel}>
                  Select All on Page
                </label>
              </div>
              <div className={styles.selectedCount}>
                <span>{selectedIds.size} selected</span>
                {bankData && (
                  <>
                    <span className={styles.dotSeparator}>•</span>
                    <span>{bankData.total} questions found</span>
                  </>
                )}
              </div>
            </div>

            <div className={styles.listContainer}>
              {isFetching && !bankData ? (
                <div className={styles.loadingState}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={styles.skeletonItem}>
                      <Skeleton style={{ width: "1.25rem", height: "1.25rem" }} />
                      <div className={styles.skeletonContent}>
                        <Skeleton style={{ width: "100%", height: "1.25rem" }} />
                        <Skeleton style={{ width: "60%", height: "1rem", marginTop: "0.5rem" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bankData?.questions.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No questions found matching your criteria.</p>
                </div>
              ) : (
                <div className={styles.questionList}>
                  {bankData?.questions.map((q) => (
                    <label key={q.id} className={`${styles.questionItem} ${q.alreadyImportedToSubject ? styles.alreadyImported : ""}`}>
                      <div className={styles.checkboxContainer}>
                        <Checkbox
                          checked={selectedIds.has(q.id)}
                          onChange={(e) => toggleSelect(q.id, e.target.checked)}
                        />
                      </div>
                      <div className={styles.questionContent}>
                        <div className={styles.questionHeader}>
                          <Badge variant="outline" className={styles.typeBadge}>
                            {q.questionType
                              ? QUESTION_TYPE_LABELS[q.questionType] || q.questionType
                              : "Unknown"}
                          </Badge>
                          {q.alreadyImportedToSubject && (
                            <Badge variant="secondary" className={styles.importedBadge}>
                              Already in this test
                            </Badge>
                          )}
                          <span className={styles.marks}>
                            +{q.positiveMarks || 0} / -{q.negativeMarks || 0}
                          </span>
                        </div>
                        <div className={styles.mathContainer}>
                          <MathMLContent html={q.questionText} maxLength={150} />
                        </div>
                        <div className={styles.questionFooter}>
                          {q.subjectName && (
                            <span className={styles.subjectText}>{q.subjectName}</span>
                          )}
                          {q.tags && q.tags.length > 0 && (
                            <span className={styles.tagsText}>
                              Tags: {q.tags.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        <DialogFooter className={styles.dialogFooterOverride}>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className={styles.pageInfo}>
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending || isImportingAll}
            >
              {importMutation.isPending && !isImportingAll
                ? "Importing..."
                : `Import Selected (${selectedIds.size})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};