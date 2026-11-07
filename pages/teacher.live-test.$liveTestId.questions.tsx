import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle,
  Download,
  LoaderCircle,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { LiveTestQuestionsEditor } from "../components/LiveTestQuestionsEditor";
import { LiveTestSteps } from "../components/LiveTestGuidedForm";
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
import { TeacherRejectionBanner } from "../components/TeacherRejectionBanner";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";
import { usePublishesWithoutReview } from "../helpers/usePublishesWithoutReview";
import styles from "./teacher.live-test.$liveTestId.questions.module.css";

const formatMoment = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const Page = () => {
  const { liveTestId } = useParams();
  const navigate = useNavigate();
  const id = Number(liveTestId);

  const {
    data: liveTestDetails,
    isFetching: isDetailsFetching,
  } = useLiveTestDetailsQuery(id);
  const publishMutation = usePublishLiveTestMutation();
  const publishesDirectly = usePublishesWithoutReview();

  const testItemId = liveTestDetails?.mockTestItem?.id ?? null;

  const { data: subjects } = useTestItemSubjectsQuery(testItemId);
  const downloadPdf = useDownloadTestPdf();

  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  const handlePublish = () => {
    if (!liveTestDetails) return;

    toast.promise(
      publishMutation.mutateAsync({ liveTestId: liveTestDetails.id }),
      {
        loading: publishesDirectly ? "Publishing live test..." : "Submitting live test for review...",
        success: (data) => {
          navigate("/teacher/live-tests");
          return data.message || (data.published ? "Your live test is live." : "Your live test has been submitted for review.");
        },
        error: (err) =>
          err instanceof Error
            ? err.message
            : publishesDirectly ? "Failed to publish live test" : "Failed to submit live test for review",
      }
    );
    setIsPublishDialogOpen(false);
  };

  const totalQuestions =
    subjects?.reduce((acc, s) => acc + s.actualQuestionCount, 0) ?? 0;

  // Can be submitted once it has questions, is not active and is not already in review
  const isReadyToPublish =
    totalQuestions > 0 &&
    !!liveTestDetails &&
    !liveTestDetails.isActive &&
    !liveTestDetails.inReview;
  const isSubmitted = !!liveTestDetails && (liveTestDetails.isActive || !!liveTestDetails.inReview);
  const publishLabel = publishesDirectly ? "Publish" : "Submit for review";

  const status = !liveTestDetails
    ? null
    : liveTestDetails.isActive
      ? { tone: "done", text: "Live. Students can register now." }
      : liveTestDetails.inReview
        ? { tone: "wait", text: "In review. Students can register once our team approves it. We will email you either way." }
        : totalQuestions === 0
          ? { tone: "todo", text: "Add at least one question to publish." }
          : {
              tone: "todo",
              text: publishesDirectly
                ? "When the paper is complete, publish it. It goes live at once."
                : "When the paper is complete, submit it. Our team reviews it before students can register.",
            };

  const renderHeader = () => {
    if (!liveTestDetails && isDetailsFetching) {
      return <Skeleton style={{ height: "120px" }} />;
    }
    if (!liveTestDetails) return null;

    return (
      <div className={styles.liveTestHeader}>
        <div className={styles.headerMain}>
          <h1 className={styles.testTitle}>{liveTestDetails.title}</h1>
          <div className={styles.headerActions}>
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
            {!isSubmitted && (
              <Button
                onClick={() => setIsPublishDialogOpen(true)}
                disabled={!isReadyToPublish || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : (
                  <Send size={16} />
                )}
                {publishLabel}
              </Button>
            )}
          </div>
        </div>

        <div className={styles.metaGrid}>
          {liveTestDetails.startTime && (
            <div className={styles.metaItem}>
              <CalendarIcon size={16} />
              <span>Starts {formatMoment(liveTestDetails.startTime)}</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <CalendarIcon size={16} />
            <span>Ends {formatMoment(liveTestDetails.endTime)}</span>
          </div>
          <div className={styles.metaItem}>
            <Users size={16} />
            <span>{liveTestDetails.maxSeats} seats</span>
          </div>
          {liveTestDetails.hasPrizes && (
            <div className={styles.metaItem}>
              <Trophy size={16} />
              <span>
                Prize pool ₹
                {parseFloat(liveTestDetails.totalPrizePool as unknown as string).toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        {status && (
          <div className={styles.status} data-tone={status.tone}>
            {status.tone === "done" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{status.text}</span>
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
      <div className={`${styles.page} tk-flow`}>
        <LiveTestSteps
          current="questions"
          liveTestId={id}
          submitted={isSubmitted}
          back="/teacher/live-tests"
          onPublish={isReadyToPublish ? () => setIsPublishDialogOpen(true) : undefined}
        />
        {liveTestDetails && <TeacherRejectionBanner contentType="live_test" contentId={liveTestDetails.id} />}
        {renderHeader()}
        <LiveTestQuestionsEditor liveTestId={id} />
      </div>

      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {publishesDirectly ? "Publish this live test?" : "Submit this live test for review?"}
            </DialogTitle>
            <DialogDescription className={styles.publishConfirmWarning}>
              <AlertTriangle size={20} className={styles.warningIcon} />
              {publishesDirectly ? (
                <span>
                  It goes live straight away and students can register. Once live, the schedule, price, seats and
                  prizes are locked, so check them first.
                </span>
              ) : (
                <span>
                  Our team reviews it before students can register, and we will email you once it is approved or needs
                  changes. Leave time for the review before registration closes. Once live, the schedule, price, seats
                  and prizes are locked.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handlePublish} disabled={publishMutation.isPending}>
              {publishesDirectly
                ? (publishMutation.isPending ? "Publishing..." : "Publish")
                : (publishMutation.isPending ? "Submitting..." : "Submit for review")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Page;