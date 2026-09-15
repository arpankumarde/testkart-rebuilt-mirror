import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postSendOtp,
  InputType as SendOtpInput,
} from "../endpoints/auth/send_otp_POST.schema";
import {
  postVerifyOtp,
  InputType as VerifyOtpInput,
} from "../endpoints/auth/verify_otp_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useSendOtpMutation = () => {
  return useMutation({
    mutationFn: (data: SendOtpInput) => postSendOtp(data),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(parseErrorMessage(error));
      } else {
        toast.error("An unknown error occurred while sending OTP.");
      }
      console.error("Send OTP error:", error);
    },
  });
};

export const useVerifyOtpMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyOtpInput) => postVerifyOtp(data),
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalidate session to refetch user data which now includes mobileVerified status
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(parseErrorMessage(error));
      } else {
        toast.error("An unknown error occurred during OTP verification.");
      }
      console.error("Verify OTP error:", error);
    },
  });
};