import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseErrorMessage } from "./parseErrorMessage";
import { postSubmitReview, InputType as SubmitReviewInput } from '../endpoints/reviews/submit_POST.schema';
import { ENROLLED_TESTS_QUERY_KEY } from './useEnrolledTestsQuery';
import { SHOP_PRODUCTS_QUERY_KEY, SHOP_PRODUCT_DETAILS_QUERY_KEY, STUDENT_PURCHASES_QUERY_KEY } from './useShopQuery';
import { PUBLIC_COURSES_QUERY_KEY, STUDENT_COURSES_QUERY_KEY, STUDENT_ENROLLED_COURSES_QUERY_KEY } from './useStudentCoursesQuery';

interface UseReviewMutationsOptions {
  mockTestId?: number;
  digitalProductId?: number;
  courseId?: number;
  slug?: string;
}

export const useReviewMutations = (options?: number | UseReviewMutationsOptions) => {
  const queryClient = useQueryClient();

  // Backward compatibility: check if the argument is a number (mockTestId)
  const mockTestId = typeof options === 'number' ? options : options?.mockTestId;
  const digitalProductId = typeof options === 'object' ? options.digitalProductId : undefined;
  const courseId = typeof options === 'object' ? options.courseId : undefined;
  const slug = typeof options === 'object' ? options.slug : undefined;

  const submitReviewMutation = useMutation({
    mutationFn: (data: SubmitReviewInput) => postSubmitReview(data),
    onSuccess: () => {
      toast.success('Thank you for your feedback!');

      if (mockTestId) {
        // Invalidate queries related to reviews for this test to show the new review
        queryClient.invalidateQueries({ queryKey: ['reviews', mockTestId] });
        // Optionally, invalidate queries for the test details if it shows average rating
        queryClient.invalidateQueries({ queryKey: ['testDetails', mockTestId] });
        // Invalidate enrolled tests query to update hasReviewed flag and hide review button
              queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
      }

      if (digitalProductId) {
        // Invalidate shop product list queries
        queryClient.invalidateQueries({ queryKey: SHOP_PRODUCTS_QUERY_KEY });
        // Invalidate student purchases query
        queryClient.invalidateQueries({ queryKey: STUDENT_PURCHASES_QUERY_KEY });
        
        // Invalidate specific product details if slug is known
        if (slug) {
          queryClient.invalidateQueries({ queryKey: SHOP_PRODUCT_DETAILS_QUERY_KEY(slug) });
        }
      }

      if (courseId) {
        queryClient.invalidateQueries({ queryKey: PUBLIC_COURSES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: STUDENT_COURSES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLED_COURSES_QUERY_KEY });
      }
    },
    onError: (error) => {
      console.error('Failed to submit review:', error);
      toast.error(parseErrorMessage(error) ||  'An unknown error occurred.');
    },
  });

  return { submitReviewMutation };
};