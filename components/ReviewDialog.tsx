import React, { useState, useEffect } from 'react';
import { Star, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import { Button } from './Button';
import { useReviewMutations } from '../helpers/useReviewMutations';
import styles from './ReviewDialog.module.css';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mockTestId?: number;
  digitalProductId?: number;
  courseId?: number;
  productSlug?: string; // Optional slug for digital products to handle cache invalidation
  testPackageTitle: string;
  className?: string;
  initialRating?: number | null;
  initialReviewText?: string | null;
}

export const ReviewDialog: React.FC<ReviewDialogProps> = ({
  isOpen,
  onClose,
  mockTestId,
  digitalProductId,
  courseId,
  productSlug,
  testPackageTitle,
  className,
  initialRating,
  initialReviewText,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  
  const isEditMode = !!initialRating && initialRating > 0;

  const { submitReviewMutation } = useReviewMutations({ 
    mockTestId, 
    digitalProductId, 
    courseId,
    slug: productSlug 
  });

  useEffect(() => {
    // Reset or pre-fill state when dialog is closed/reopened
    if (isOpen) {
      setRating(initialRating || 0);
      setHoverRating(0);
      setReviewText(initialReviewText || '');
    } else {
      setTimeout(() => {
        setRating(0);
        setHoverRating(0);
        setReviewText('');
      }, 300); // Delay to allow closing animation
    }
  }, [isOpen, initialRating, initialReviewText]);

  const handleSubmit = () => {
    if (rating === 0) {
      return;
    }
    
    const mutationData: { mockTestId?: number; digitalProductId?: number; courseId?: number; rating: number; reviewText?: string } = {
      rating,
      reviewText: reviewText.trim() || undefined,
    };
    
    if (mockTestId) {
      mutationData.mockTestId = mockTestId;
    }
    if (digitalProductId) {
      mutationData.digitalProductId = digitalProductId;
    }
    if (courseId) {
      mutationData.courseId = courseId;
    }
    
    submitReviewMutation.mutate(
      mutationData as any,
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (submitReviewMutation.isPending) return;
    onClose();
  };

  const isDigitalProduct = !!digitalProductId;
  const isCourse = !!courseId;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={`${styles.dialogContent} ${className ?? ''}`}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Edit your review of "${testPackageTitle}"` : `How was "${testPackageTitle}"?`}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update your rating and feedback."
              : isCourse
              ? "Thank you for completing this course! Your feedback helps other students and the instructor."
              : isDigitalProduct 
              ? "Thank you for your purchase! Your feedback helps other students and the creator."
              : "Thank you for completing the test! Your feedback helps other students and the creator."
            }
          </DialogDescription>
        </DialogHeader>

        <div className={styles.ratingContainer}>
          <div
            className={styles.stars}
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={styles.starButton}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <Star
                  className={`${styles.starIcon} ${
                    (hoverRating || rating) >= star ? styles.filled : ''
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <textarea
          className={styles.textarea}
          placeholder="Tell us more about your experience (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={4}
          maxLength={1000}
          disabled={submitReviewMutation.isPending}
        />

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={submitReviewMutation.isPending}
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitReviewMutation.isPending}
          >
            {submitReviewMutation.isPending ? (
              <>
                <Loader2 className={styles.loaderIcon} />
                {isEditMode ? 'Updating...' : 'Submitting...'}
              </>
            ) : (
              isEditMode ? 'Update Review' : 'Submit Review'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};