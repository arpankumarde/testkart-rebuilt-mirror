import React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';
import { Button } from './Button';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import styles from './DeleteCourseDialog.module.css';

interface DeleteCourseDialogProps {
  course: TeacherCourseListItem;
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteCourseDialog: React.FC<DeleteCourseDialogProps> = ({
  course,
  isOpen,
  onClose,
}) => {
  const { deleteCourseMutation } = useTeacherCourseMutations();

  const handleDelete = () => {
    deleteCourseMutation.mutate(
      { courseId: course.id },
      {
        onSuccess: () => {
          toast.success('Course deleted successfully.');
          onClose();
        },
        onError: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : 'An unknown error occurred.';
          toast.error(`Failed to delete course: ${errorMessage}`);
          console.error('Delete course failed:', error);
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <div className={styles.iconWrapper}>
            <Trash2 size={24} />
          </div>
          <DialogTitle>Delete Course</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{course.title}"? This action cannot be undone.
            All sections, lessons, and related data will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleteCourseMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCourseMutation.isPending}
          >
            {deleteCourseMutation.isPending ? 'Deleting...' : 'Delete Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};