import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle,
  Download,
  Edit,
  HelpCircle,
  LoaderCircle,
  Trophy,
  Users,
  XCircle,
  Trash2,
} from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { QuestionsManager } from "../components/QuestionsManager";
import { SubjectManagementDialog } from "../components/SubjectManagementDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../components/Dialog";
import {
  useLiveTestDetailsQuery,
  usePublishLiveTestMutation,
} from "../helpers/useLiveTestQueries";
import {
  useTestItemSubjectsQuery,
  useTestItemSubjectsMutations,
} from "../helpers/useTestItemSubjectsQuery";
import { useSubjectSectionsQuery } from "../helpers/useSubjectSections";
import { SortableSubjectTabs } from "../components/SortableSubjectTabs";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";
import { Selectable } from "kysely";
import { TestItemSubjects } from "../helpers/schema";
import styles from "./teacher.live-test.$liveTestId.questions.module.css";

type SubjectWithCount = Selectable<TestItemSubjects> & {
  actualQuestionCount: number;
};

const Page = () => {
  const { liveTestId } = useParams();
  const navigate = useNavigate();
  const id = Number(liveTestId);

  const {
    data: liveTestDetails,
    isFetching: isDetailsFetching,
    error,
  } = useLiveTestDetailsQuery(id);
  const publishMutation = usePublishLiveTestMutation();

  const testItemId = liveTestDetails?.mockTestItem?.id ?? null;
  const packageId = liveTestDetails?.mockTest?.id ?? null;

  const {
    data: subjects,
    isFetching: isSubjectsFetching,
    refetch: refetchSubjects,
  } = useTestItemSubjectsQuery(testItemId);
  const { useDeleteSubjectMutation } = useTestItemSubjectsMutations(
    testItemId!
  );
  const downloadPdf = useDownloadTestPdf();

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null
  );
  const [localSubjects, setLocalSubjects] = useState<SubjectWithCount[] | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  const { data: sectionsData } = useSubjectSectionsQuery(selectedSubjectId);

  const displaySubjects = localSubjects ?? subjects ?? [];

  useEffect(() => {
    if (subjects && subjects.length > 0 && selectedSubjectId === null) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (subjects) {
      setLocalSubjects(subjects);
    }
  }, [subjects]);

  const handleReorderSuccess = (reordered: SubjectWithCount[]) => {
setLocalSubjects(reordered);
};

const handleSubjectsRefetch = () => {
setLocalSubjects(null);
refetchSubjects();
};

  const deleteSubject = useDeleteSubjectMutation();

  const handleDeleteSubject = (subjectId: number, subjectName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the subject "${subjectName}"? This will also delete all questions in this subject.`
      )
    ) {
      deleteSubject.mutate(
        { id: subjectId },
        {
          onSuccess: () => {
                        toast.success("Subject deleted successfully.");
            handleSubjectsRefetch();
            if (selectedSubjectId === subjectId) {
              const remainingSubjects = displaySubjects.filter(
                (s) => s.id !== subjectId
              );
              setSelectedSubjectId(
                remainingSubjects.length > 0
                  ? remainingSubjects[0].id
                  : null
              );
            }
          },
          onError: (e) =>
            toast.error(
              e instanceof Error ? e.message : "Failed to delete subject."
            ),
        }
      );
    }
  };

  const handlePublish = () => {
    if (!liveTestDetails) return;

    toast.promise(
      publishMutation.mutateAsync({ liveTestId: liveTestDetails.id }),
      {
        loading: "Publishing live test...",
        success: (data) => {
          navigate("/teacher/live-tests");
          return data.message || "Your live test has been published successfully.";
        },
        error: (err) =>
          err instanceof Error
            ? err.message
            : "Failed to publish live test",
      }
    );
    setIsPublishDialogOpen(false);
  };

  const totalQuestions =
    subjects?.reduce((acc, s) => acc + s.actualQuestionCount, 0) ?? 0;

  // Publishable once it has questions and is not yet active
  const isReadyToPublish =
    totalQuestions > 0 &&
    liveTestDetails &&
    !liveTestDetails.isActive;

  const renderHeader = () => {
    if (!liveTestDetails && isDetailsFetching) {
      return (
        <Skeleton style={{ height: "120px", marginBottom: "var(--spacing-6)" }} />
      );
    }
    if (!liveTestDetails) return null;

    return (
      <div className={styles.liveTestHeader}>
        <div className={styles.headerMain}>
          <h1 className={styles.testTitle}>{liveTestDetails.title}</h1>
          <div className={styles.headerActions}>
            <Button asChild variant="outline">
              <Link to="/teacher/live-tests">
                <ArrowLeft size={16} /> Back to Live Tests
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/teacher/live-test/${id}/edit`}>
                <Edit size={16} /> Edit Test Details
              </Link>
            </Button>
            {testItemId && (
              <Button
                variant="outline"
                onClick={() => downloadPdf.mutate({ testItemId })}
                disabled={downloadPdf.isPending}
              >
                {downloadPdf.isPending ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : (
                  <Download size={16} />
                )}
                Download PDF
              </Button>
            )}
            {!liveTestDetails.isActive && (
              <Button
                onClick={() => setIsPublishDialogOpen(true)}
                disabled={!isReadyToPublish || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : (
                  <CheckCircle size={16} />
                )}
                Publish live test
              </Button>
            )}
          </div>
        </div>

        <Dialog
          open={isPublishDialogOpen}
          onOpenChange={setIsPublishDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish this live test?</DialogTitle>
              <DialogDescription className={styles.publishConfirmWarning}>
                <AlertTriangle size={20} className={styles.warningIcon} />
                <span>
                  <strong>Heads up:</strong> Your live test goes live as soon as
                  you publish it, and students can see it and register straight
                  away. Please ensure all details - including questions,
                  schedule, prize pool, and settings - are correct.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending
                  ? "Publishing..."
                  : "Publish live test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className={styles.metaGrid}>
          {liveTestDetails.startTime && (
            <div className={styles.metaItem}>
              <CalendarIcon size={16} />
              <span>
                Starts:{" "}
                {new Date(liveTestDetails.startTime).toLocaleString()}
              </span>
            </div>
          )}
          <div className={styles.metaItem}>
            <CalendarIcon size={16} />
            <span>
              Ends: {new Date(liveTestDetails.endTime).toLocaleString()}
            </span>
          </div>
          <div className={styles.metaItem}>
            <Users size={16} />
            <span>{liveTestDetails.maxSeats} Seats</span>
          </div>
          {liveTestDetails.hasPrizes && (
            <div className={styles.metaItem}>
              <Trophy size={16} />
              <span>
                Prize Pool: ₹
                {parseFloat(liveTestDetails.totalPrizePool as unknown as string).toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>
          )}
        </div>

        {!liveTestDetails.isActive && (
          <>
            {totalQuestions === 0 && (
              <div className={styles.publishWarning}>
                <XCircle size={16} />
                <span>
                  You must add at least one question before publishing.
                </span>
              </div>
            )}
            {totalQuestions > 0 && (
              <div className={styles.publishWarning}>
                <HelpCircle size={16} />
                <span>Review all details before publishing. Students can register as soon as it is live.</span>
              </div>
            )}
          </>
        )}

        {liveTestDetails.isActive && (
          <div className={styles.publishSuccess}>
            <CheckCircle size={16} />
            <span>This live test is published and active.</span>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // Skeleton only before the first load. Background refetches after adding or
    // deleting a question keep the manager mounted, with its scroll and state.
    if ((!liveTestDetails && isDetailsFetching) || (testItemId && !subjects && isSubjectsFetching)) {
      return <Skeleton style={{ height: "400px" }} />;
    }

    if (error && !liveTestDetails) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
          <h3>Could not load this live test</h3>
          <p>{error.message}</p>
        </div>
      );
    }

    if (!liveTestDetails || !testItemId || !packageId) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
          <h3>Could not open this live test</h3>
          <p>The requested live test could not be found.</p>
        </div>
      );
    }

    if (!subjects || subjects.length === 0) {
      return (
        <div className={styles.mainContent}>
          <div className={styles.emptyState}>
            <h3>No Subjects Yet</h3>
            <p>Add subjects to organize questions for this live test.</p>
            <SubjectManagementDialog
              packageId={packageId}
              testItemId={testItemId}
              onSuccess={handleSubjectsRefetch}
              subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
            />
          </div>
        </div>
      );
    }

    const selectedSubject = displaySubjects.find(s => s.id === selectedSubjectId);

    return (
      <div className={styles.mainContent}>
        <div className={styles.tabsWrapper}>
          <SortableSubjectTabs
            subjects={displaySubjects}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={setSelectedSubjectId}
            testItemId={testItemId}
            onReorderSuccess={handleReorderSuccess}
            className={styles.sortableTabsContainer}
          />
          {selectedSubject && (
            <div className={styles.subjectActionsLeft}>
              <SubjectManagementDialog
                packageId={packageId}
                testItemId={testItemId}
                subjectToEdit={selectedSubject}
                onSuccess={handleSubjectsRefetch}
                subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  handleDeleteSubject(
                    selectedSubject.id,
                    selectedSubject.subjectName
                  )
                }
                disabled={deleteSubject.isPending}
              >
                <Trash2 size={16} />
                <span className={styles.srOnly}>Delete</span>
              </Button>
            </div>
          )}
          <div className={styles.subjectActionsRight}>
            <SubjectManagementDialog
              packageId={packageId}
              testItemId={testItemId}
              onSuccess={handleSubjectsRefetch}
              subjectWiseTiming={liveTestDetails.mockTestItem?.subjectWiseTiming}
            />
          </div>
        </div>

        {selectedSubject && (
          <div className={styles.subjectContent}>
            {liveTestDetails.mockTestItem?.subjectWiseTiming && selectedSubject.durationMinutes != null && (
              <p className={styles.subjectMeta}>
                {selectedSubject.durationMinutes} min
              </p>
            )}
            {selectedSubject.description && (
              <p className={styles.subjectDescription}>{selectedSubject.description}</p>
            )}
            <QuestionsManager
              testId={packageId}
              subjectId={selectedSubject.id}
              examName={liveTestDetails.mockTest?.examName || "Live Test"}
              subjectName={selectedSubject.subjectName}
              refetchSubjects={handleSubjectsRefetch}
              sections={sectionsData ?? []}
              questionWiseTiming={liveTestDetails.mockTestItem?.questionWiseTiming}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Manage Live Test Questions | Testkart</title>
      </Helmet>
      <div className={styles.page}>
        {renderHeader()}
        {renderContent()}
      </div>
    </>
  );
};

export default Page;