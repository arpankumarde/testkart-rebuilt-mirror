import React from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
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
import styles from './UnpublishTestDialog.module.css';

interface UnpublishTestDialogProps {
  test: TeacherTest;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const UnpublishTestDialog: React.FC<UnpublishTestDialogProps> = ({ test, isOpen, onClose, className }) => {
  const { useUnpublishTestMutation } = useTeacherTestMutations();
  const unpublishMutation = useUnpublishTestMutation();

  const handleUnpublish = () => {
    unpublishMutation.mutate(
      { testId: test.id },
      {
        onSuccess: () => {
          toast.success(`"${test.title}" has been unpublished successfully.`);
          onClose();
        },
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
          toast.error(`Failed to unpublish test: ${errorMessage}`);
          console.error("Unpublish test failed:", error);
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>Unpublish Test</DialogTitle>
          <DialogDescription>
            Are you sure you want to unpublish the test series "{test.title}"? This will hide it from the marketplace, and new students will not be able to enroll.
          </DialogDescription>
        </DialogHeader>
        
        <div className={styles.info}>
          <Info size={20} className={styles.infoIcon} />
          <p>
            Enrolled students will still have access to the test. You can re-publish this test series at any time from your dashboard.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={unpublishMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="secondary"
            onClick={handleUnpublish}
            disabled={unpublishMutation.isPending}
          >
            {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};