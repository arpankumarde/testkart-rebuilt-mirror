import React from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
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
import styles from './ConvertTestToDraftDialog.module.css';

interface ConvertTestToDraftDialogProps {
  test: TeacherTest;
  isOpen: boolean;
  onClose: () => void;
  onConverted?: () => void;
  className?: string;
}

// Taking a live series down is one click from a dropdown, so it gets the same
// confirmation step as Unpublish and Delete rather than firing on select.
export const ConvertTestToDraftDialog: React.FC<ConvertTestToDraftDialogProps> = ({
  test,
  isOpen,
  onClose,
  onConverted,
  className,
}) => {
  const { useUnpublishTestMutation } = useTeacherTestMutations();
  const convertMutation = useUnpublishTestMutation();

  const handleConvert = () => {
    convertMutation.mutate(
      { testId: test.id },
      {
        onSuccess: () => {
          toast.success(`"${test.title}" has been moved to drafts.`);
          onClose();
          onConverted?.();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'An unknown error occurred.';
          toast.error(`Could not move to drafts: ${message}`);
          console.error('Convert to draft failed:', error);
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>Move to drafts</DialogTitle>
          <DialogDescription>
            "{test.title}" is live on the marketplace. Moving it to drafts takes it down - students
            will no longer find it in search or on your profile, and nobody can buy it until you
            publish it again.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.warning}>
          <AlertTriangle size={20} className={styles.warningIcon} />
          <p>
            No students are enrolled yet, so nothing is lost. You can edit it and publish it again
            from the Drafts tab at any time.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={convertMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="secondary" onClick={handleConvert} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? 'Moving...' : 'Move to drafts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
