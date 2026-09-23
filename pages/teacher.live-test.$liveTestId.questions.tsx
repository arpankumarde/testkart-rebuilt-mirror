import React, { useState } from "react";
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
} from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { LiveTestQuestionsEditor } from "../components/LiveTestQuestionsEditor";
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
import { useTestItemSubjectsQuery } from "../helpers/useTestItemSubjectsQuery";
import { WithdrawReviewButton } from "../components/WithdrawReviewButton";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";
import styles from "./teacher.live-test.$liveTestId.questions.module.css";

const Page = () => {
  const { liveTestId } = useParams();
  const navigate = useNavigate();
  const id = Number(liveTestId);

  const {
    data: liveTestDetails,
    isFetching: isDetailsFetching,
  } = useLiveTestDetailsQuery(id);
  const publishMutation = usePublishLiveTestMutation();

  const testItemId = liveTestDetails?.mockTestItem?.id ?? null;

  const { data: subjects } = useTestItemSubjectsQuery(testItemId);
  const downloadPdf = useDownloadTestPdf();

  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  const handlePublish = () => {
    if (!liveTestDetails) return;

    toast.promise(
      publishMutation.mutateAsync({ liveTestId: liveTestDetails.id }),
      {
        loading: "Submitting live test for review...",
        success: (data) => {
          navigate("/teacher/live-tests");
          return data.message || "Your live test has been submitted for review.";
        },
        error: (err) =>
          err instanceof Error
            ? err.message
            : "Failed to submit live test for review",
      }
    );
    setIsPublishDialogOpen(false);
  };

  const totalQuestions =
    subjects?.reduce((acc, s) => acc + s.actualQuestionCount, 0) ?? 0;

  // Can be submitted once it has questions, is not active and is not already in review
  const isReadyToPublish =
    totalQuestions > 0 &&
    liveTestDetails &&
    !liveTestDetails.isActive &&
    !liveTestDetails.inReview;

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
            {!liveTestDetails.isActive && liveTestDetails.inReview && (
              <WithdrawReviewButton contentType="live_test" contentId={liveTestDetails.id} title={liveTestDetails.title} />
            )}
            {!liveTestDetails.isActive && !liveTestDetails.inReview && (
              <Button
                onClick={() => setIsPublishDialogOpen(true)}
                disabled={!isReadyToPublish || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : (
                  <CheckCircle size={16} />
                )}
                Submit for review
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
              <DialogTitle>Submit this live test for review?</DialogTitle>
              <DialogDescription className={styles.publishConfirmWarning}>
                <AlertTriangle size={20} className={styles.warningIcon} />
                <span>
                  <strong>Heads up:</strong> Our team reviews your live test
                  before students can see it and register, and we will email you
                  once it is approved or needs changes. Leave time for the review
                  before registration closes, and check that all details -
                  including questions, schedule, prize pool, and settings - are
                  correct.
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
                  ? "Submitting..."
                  : "Submit for review"}
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

        {!liveTestDetails.isActive && liveTestDetails.inReview && (
          <div className={styles.publishWarning}>
            <HelpCircle size={16} />
            <span>In review. Students can register once our team approves it. We will email you either way.</span>
          </div>
        )}

        {!liveTestDetails.isActive && !liveTestDetails.inReview && (
          <>
            {totalQuestions === 0 && (
              <div className={styles.publishWarning}>
                <XCircle size={16} />
                <span>
                  You must add at least one question before submitting for review.
                </span>
              </div>
            )}
            {totalQuestions > 0 && (
              <div className={styles.publishWarning}>
                <HelpCircle size={16} />
                <span>Review all details before submitting. Students can register once our team approves it.</span>
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

  return (
    <>
      <Helmet>
        <title>Manage Live Test Questions | Testkart</title>
      </Helmet>
      <div className={styles.page}>
        {renderHeader()}
        <LiveTestQuestionsEditor liveTestId={id} />
      </div>
    </>
  );
};

export default Page;