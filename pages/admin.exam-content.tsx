import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import {
  useAdminExamCategoriesQuery,
  useDeleteExamCategoryMutation,
  useDeleteExamMutation,
} from '../helpers/useAdminExamCategories';
import { Button } from '../components/Button';
import { ExamCategoryFormDialog } from '../components/ExamCategoryFormDialog';
import { ExamFormDialog } from '../components/ExamFormDialog';
import { AdminExamDashboardTable } from '../components/AdminExamDashboardTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { AdminCustomExamNamesTab } from '../components/AdminCustomExamNamesTab';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/DropdownMenu';
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { ConsoleConfirmDialog } from '../components/ConsoleConfirmDialog';
import { type Selectable } from "kysely";
import { type ExamCategories, type Exams } from '../helpers/schema';
import { type ExamDashboardRow } from '../endpoints/admin/exam-dashboard/list_GET.schema';
import styles from "./admin.exam-content.module.css";

type ExamCategory = Selectable<ExamCategories>;
type Exam = Selectable<Exams>;

const DeleteConfirmationDialog: React.FC<{
  itemType: "category" | "exam";
  itemName: string;
  warning?: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}> = ({ itemType, itemName, warning, onClose, onConfirm, isPending }) => (
  <ConsoleConfirmDialog
    open
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
    tone="destructive"
    icon={<Trash2 size={20} />}
    title={`Delete this ${itemType}?`}
    description={
      <>
        <strong>"{itemName}"</strong> will be removed for good. This cannot be undone.
        {warning ? <span className={styles.deleteWarning}>{warning}</span> : null}
      </>
    }
    confirmLabel={`Delete ${itemType}`}
    pendingLabel="Deleting..."
    isPending={isPending}
    onConfirm={onConfirm}
  />
);

// Main Page Component
export default function AdminExamCategoriesPage() {
  const { data, isFetching, error } = useAdminExamCategoriesQuery();
  const deleteCategoryMutation = useDeleteExamCategoryMutation();
  const deleteExamMutation = useDeleteExamMutation();

  const [activeTab, setActiveTab] = useState("official");
  const [searchParams] = useSearchParams();
  const hasExamListFilter = searchParams.has("filter") || searchParams.has("content");

  // A dashboard link filters the official exams table, so it must be the tab on show.
  useEffect(() => {
    if (hasExamListFilter) setActiveTab("official");
  }, [hasExamListFilter]);

  const [dialogState, setDialogState] = useState<
    | { type: "add-category" }
    | { type: "edit-category"; category: ExamCategory }
    | { type: "delete-category"; category: ExamCategory; examCount: number }
    | { type: "add-exam"; categoryId: number }
    | { type: "edit-exam"; exam: Exam }
    | { type: "delete-exam"; exam: Exam }
    | null
  >(null);

  const categoryOptions = data?.categories.map((c) => ({
    id: c.id,
    categoryName: c.categoryName,
  })) ?? [];

  const openDialog = (state: NonNullable<typeof dialogState>) =>
    setDialogState(state);
  const closeDialog = () => setDialogState(null);

  const handleDeleteCategory = () => {
    if (dialogState?.type === "delete-category") {
      deleteCategoryMutation.mutate(
        { id: dialogState.category.id },
        { onSuccess: closeDialog }
      );
    }
  };

  const handleDeleteExam = () => {
    if (dialogState?.type === "delete-exam") {
      deleteExamMutation.mutate(
        { id: dialogState.exam.id },
        { onSuccess: closeDialog }
      );
    }
  };

  const renderDialog = () => {
    if (!dialogState) return null;

    switch (dialogState.type) {
      case "add-category":
        return <ExamCategoryFormDialog isOpen={true} onClose={closeDialog} />;
      case "edit-category":
        return (
          <ExamCategoryFormDialog
            isOpen={true}
            category={dialogState.category}
            onClose={closeDialog}
          />
        );
      case "add-exam":
        return (
          <ExamFormDialog
            isOpen={true}
            categoryId={dialogState.categoryId}
            categories={categoryOptions}
            onClose={closeDialog}
          />
        );
      case "edit-exam":
        return (
          <ExamFormDialog
            isOpen={true}
            exam={dialogState.exam}
            categoryId={dialogState.exam.categoryId}
            categories={categoryOptions}
            onClose={closeDialog}
          />
        );
      case "delete-category":
        return (
          <DeleteConfirmationDialog
            itemType="category"
            itemName={dialogState.category.categoryName}
            warning={
              dialogState.examCount > 0
                ? `This category holds ${dialogState.examCount} exam${dialogState.examCount === 1 ? "" : "s"}. They will be deleted with it.`
                : undefined
            }
            onClose={closeDialog}
            onConfirm={handleDeleteCategory}
            isPending={deleteCategoryMutation.isPending}
          />
        );
      case "delete-exam":
        return (
          <DeleteConfirmationDialog
            itemType="exam"
            itemName={dialogState.exam.examName}
            onClose={closeDialog}
            onConfirm={handleDeleteExam}
            isPending={deleteExamMutation.isPending}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Exam content - Testkart Admin</title>
        <meta
          name="description"
          content="Exam categories and the exams inside them."
        />
      </Helmet>

      <ConsolePageHeader title="Exam content">
        {activeTab === "official" && (
          <div className={styles.headerActions}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Layers size={16} /> Categories
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.categoryMenu}>
                <DropdownMenuLabel>Manage categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categoryOptions.map((category) => (
                  <DropdownMenuItem
                    key={category.id}
                    className={styles.categoryMenuItem}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className={styles.categoryMenuName}>{category.categoryName}</span>
                    <span className={styles.categoryMenuActions}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          openDialog({
                            type: "edit-category",
                            category: data!.categories.find((c) => c.id === category.id)!,
                          })
                        }
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          const fullCategory = data!.categories.find((c) => c.id === category.id)!;
                          openDialog({
                            type: "delete-category",
                            category: fullCategory,
                            examCount: fullCategory.exams.length,
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => openDialog({ type: "add-category" })}>
              <Plus size={18} /> Add a category
            </Button>
          </div>
        )}
      </ConsolePageHeader>

      {renderDialog()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.tabs}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="official">Official exams</TabsTrigger>
          <TabsTrigger value="custom">Custom names</TabsTrigger>
        </TabsList>

        <TabsContent value="official">
          {error ? (
            <ConsoleListEmpty
              tone="error"
              icon={<AlertTriangle size={24} />}
              title="Could not load the exam categories"
              description={error.message}
            />
          ) : (
            <AdminExamDashboardTable
              onEditExam={(exam) => openDialog({ type: "edit-exam", exam })}
              onDeleteExam={(exam) => openDialog({ type: "delete-exam", exam })}
              onAddExam={() =>
                openDialog({
                  type: "add-exam",
                  categoryId: categoryOptions[0]?.id ?? 0,
                })
              }
            />
          )}
        </TabsContent>
        <TabsContent value="custom">
          <AdminCustomExamNamesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}