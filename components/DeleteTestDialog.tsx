import React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';
import { TeacherTest } from '../endpoints/teacher/tests/list_GET.schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './Dialog';
import { Button } from './Button';
import styles from './DeleteTestDialog.module.css';

interface DeleteTestDialogProps {
  test: TeacherTest;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const DeleteTestDialog: React.FC<DeleteTestDialogProps> = ({ test, isOpen, onClose, className }) => {
  const { useDeleteTestMutation } = useTeacherTestMutations();
  const deleteMutation = useDeleteTestMutation();

  // Compute test state flags
  const hasEnrollments = test.studentsEnrolled > 0;
  const isPublished = test.isPublished;
  const isDraft = !isPublished;
  const canDelete = isDraft || (isPublished && !hasEnrollments);

  const handleDelete = () => {
    // Extra safeguard - should not be called if cannot delete
    if (!canDelete) {
      toast.error('This test cannot be deleted because students are enrolled.');
      return;
    }

    deleteMutation.mutate(
      { testId: test.id },
      {
        onSuccess: () => {
          toast.success(`"${test.title}" has been moved to trash.`);
           onClose();
        },
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
          toast.error(`Failed to delete test: ${errorMessage}`);
          console.error("Delete test failed:", error);
        },
      }
    );
  };

  // Determine description text based on test state
  let descriptionText: string;
  if (hasEnrollments && isPublished) {
    descriptionText = `This test cannot be deleted because ${test.studentsEnrolled} student(s) have enrolled. To hide it from the marketplace, please unpublish it instead. Enrolled students will still have access.`;
  } else if (isPublished && !hasEnrollments) {
    descriptionText = `Are you sure you want to move "${test.title}" to trash? It will be unpublished and automatically deleted after 30 days if not restored.`;
  } else {
    descriptionText = `Are you sure you want to move the draft test "${test.title}" to trash? It will be automatically deleted after 30 days if not restored.`;
  }

  // Determine if we need to show a warning box
  const showWarning = isPublished;
  const warningVariant = hasEnrollments ? 'error' : 'caution';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>Move to Trash</DialogTitle>
          <DialogDescription>
            {descriptionText}
          </DialogDescription>
        </DialogHeader>
        
        {showWarning && (
          <div className={`${styles.warning} ${styles[warningVariant]}`}>
            {hasEnrollments ? (
              <XCircle size={20} className={styles.warningIcon} />
            ) : (
              <AlertTriangle size={20} className={styles.warningIcon} />
            )}
            <p>
              {hasEnrollments ? (
                <>
                  <strong>Deletion Blocked:</strong> This test has <strong>{test.studentsEnrolled} student(s) enrolled</strong>. You cannot delete it. Please unpublish the test instead to hide it from new users.
                </>
              ) : (
                <>
                  <strong>Caution:</strong> This test is published but has no enrollments yet. It will be completely removed from the database.
                </>
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={deleteMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteMutation.isPending}
          >
            {!canDelete ? 'Cannot Delete' : deleteMutation.isPending ? 'Moving...' : 'Move to Trash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};