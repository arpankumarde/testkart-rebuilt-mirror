import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { format } from "date-fns";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  MoreVertical,
  ListChecks,
  FileText,
} from "lucide-react";
import {
  useTeacherTrashQuery,
  useRestoreFromTrashMutation,
  usePermanentDeleteMutation,
} from "../helpers/useTeacherTrash";
import { TrashedTest, TrashedTestItem } from "../endpoints/teacher/trash/list_GET.schema";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { TeacherListToolbar, type TeacherListTab } from "../components/TeacherListToolbar";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../components/Dialog";
import styles from "./teacher.trash.module.css";

type TrashFilter = "all" | "series" | "items";

const formatDeleted = (value: Date | string | null) =>
  value ? format(new Date(value), "MMM d, yyyy") : "Unknown";

export default function TeacherTrashPage() {
  const { data, isLoading, error } = useTeacherTrashQuery();
  const restoreMutation = useRestoreFromTrashMutation();

  const [filter, setFilter] = useState<TrashFilter>("all");
  const [itemToDelete, setItemToDelete] = useState<TrashedTest | TrashedTestItem | null>(null);

  const trashedTests = data?.trashedTests || [];
  const trashedTestItems = data?.trashedTestItems || [];
  const totalItems = trashedTests.length + trashedTestItems.length;

  const tabs: TeacherListTab[] = useMemo(
    () => [
      { value: "all", label: "All", count: totalItems },
      { value: "series", label: "Test series", count: trashedTests.length },
      { value: "items", label: "Tests", count: trashedTestItems.length },
    ],
    [totalItems, trashedTests.length, trashedTestItems.length]
  );

  const showSeries = filter === "all" || filter === "series";
  const showItems = filter === "all" || filter === "items";
  const visibleCount =
    (showSeries ? trashedTests.length : 0) + (showItems ? trashedTestItems.length : 0);

  const renderCard = (
    key: string,
    kind: { icon: React.ReactNode; label: string },
    title: string,
    parent: string | null,
    rows: Array<{ label: string; value: string }>,
    daysRemaining: number,
    onRestore: () => void,
    onDelete: () => void
  ) => (
    <article key={key} className={styles.card}>
      <div className={styles.cardContent}>
        <div className={styles.cardTop}>
          <h2 className={styles.title}>
            {title}
            {parent && <span className={styles.parent}>From {parent}</span>}
          </h2>
          <span className={styles.kind}>
            {kind.icon}
            {kind.label}
          </span>
        </div>
        <div className={styles.rows}>
          {rows.map((row) => (
            <div key={row.label} className={styles.row}>
              <span className={styles.rowLabel}>{row.label}</span>
              <span className={styles.rowValue}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.footer}>
        <span className={`${styles.countdown} ${daysRemaining <= 7 ? styles.urgent : ""}`}>
          {daysRemaining <= 7 && <AlertTriangle size={12} aria-hidden="true" />}
          {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
        </span>
        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            onClick={onRestore}
            disabled={restoreMutation.isPending}
          >
            <RotateCcw size={14} />
            Restore
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${title}`}>
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className={`${styles.menuItem} ${styles.destructive}`}
                onClick={onDelete}
              >
                <Trash2 size={14} /> Delete permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardContent}>
                <Skeleton style={{ width: "75%", height: "1.25rem" }} />
                <Skeleton style={{ width: "45%", height: "1rem" }} />
                <Skeleton style={{ width: "60%", height: "1rem" }} />
              </div>
              <div className={styles.footer}>
                <Skeleton style={{ width: "5rem", height: "1.5rem" }} />
                <Skeleton style={{ width: "6rem", height: "2rem" }} />
              </div>
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
          title="Could not load your trash"
          description="Something went wrong fetching your deleted items. Reload the page to try again."
        />
      );
    }

    if (totalItems === 0) {
      return (
        <TeacherListEmpty
          icon={<Trash2 size={26} />}
          title="Your trash is empty"
          description="Test series and individual tests you delete land here for 30 days, so you can restore them before they go for good."
        />
      );
    }

    if (visibleCount === 0) {
      return (
        <TeacherListEmpty
          icon={<Trash2 size={26} />}
          title={filter === "series" ? "No deleted test series" : "No deleted tests"}
          description="Nothing of this kind is in the trash right now."
        >
          <Button variant="outline" onClick={() => setFilter("all")}>
            Show everything
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {showSeries &&
          trashedTests.map((test) =>
            renderCard(
              `test-${test.id}`,
              { icon: <ListChecks size={12} aria-hidden="true" />, label: "Series" },
              test.title,
              null,
              [
                { label: "Exam", value: test.examName || "Not specified" },
                {
                  label: "Contents",
                  value: `${test.testItemsCount} tests, ${test.totalQuestions} questions`,
                },
                { label: "Deleted", value: formatDeleted(test.deletedAt) },
              ],
              test.daysRemaining,
              () => restoreMutation.mutate({ testId: test.id }),
              () => setItemToDelete(test)
            )
          )}
        {showItems &&
          trashedTestItems.map((item) =>
            renderCard(
              `item-${item.id}`,
              { icon: <FileText size={12} aria-hidden="true" />, label: "Test" },
              item.title,
              item.parentTestTitle,
              [
                { label: "Subject", value: item.subject || "Not specified" },
                { label: "Questions", value: String(item.questionsCount) },
                { label: "Deleted", value: formatDeleted(item.deletedAt) },
              ],
              item.daysRemaining,
              () => restoreMutation.mutate({ testItemId: item.id }),
              () => setItemToDelete(item)
            )
          )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Trash - Testkart</title>
        <meta name="description" content="Manage your deleted mock test series." />
      </Helmet>

      <TeacherPageHeader title="Trash" />

      <TeacherListToolbar
        tabs={tabs}
        value={filter}
        onValueChange={(value) => setFilter(value as TrashFilter)}
        tabsLabel="Filter trash by kind"
      >
        <span className={styles.retention}>Deleted items are kept for 30 days</span>
      </TeacherListToolbar>

      {renderContent()}

      <PermanentDeleteDialog item={itemToDelete} onClose={() => setItemToDelete(null)} />
    </div>
  );
}

function PermanentDeleteDialog({
  item,
  onClose,
}: {
  item: TrashedTest | TrashedTestItem | null;
  onClose: () => void;
}) {
  const deleteMutation = usePermanentDeleteMutation();

  const handleDelete = () => {
    if (!item) return;

    const isTestItem = 'parentTestId' in item;
    const payload = isTestItem ? { testItemId: item.id } : { testId: item.id };

    deleteMutation.mutate(payload, { onSuccess: onClose });
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete permanently?</DialogTitle>
          <DialogDescription>
            "{item?.title}" will be erased for good.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.dialogWarning}>
          <AlertTriangle size={20} className={styles.dialogWarningIcon} aria-hidden="true" />
          <p>
            This cannot be undone. Every question and setting inside it is deleted with it, and
            Restore will no longer be an option.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={deleteMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
