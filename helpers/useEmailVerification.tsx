import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postAuthSendEmailOtp,
  InputType as SendEmailOtpInput,
} from "../endpoints/auth/send-email-otp_POST.schema";
import {
  postAuthVerifyEmailOtp,
  InputType as VerifyEmailOtpInput,
} from "../endpoints/auth/verify-email-otp_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useSendEmailOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendEmailOtpInput) => postAuthSendEmailOtp(data),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(parseErrorMessage(error));
      } else {
        toast.error("An unknown error occurred while sending OTP.");
      }
      console.error("Send Email OTP error:", error);
    },
  });
};

export const useVerifyEmailOtpMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyEmailOtpInput) => postAuthVerifyEmailOtp(data),
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalidate session to refetch user data which now includes emailVerified status
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(parseErrorMessage(error));
      } else {
        toast.error("An unknown error occurred during email verification.");
      }
      console.error("Verify Email OTP error:", error);
    },
  });
};