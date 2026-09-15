import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getStudentWalletBalance, OutputType as BalanceType } from "../endpoints/student/wallet/balance_GET.schema";
import { getStudentWalletTransactions, InputType as TransactionInput, OutputType as TransactionsType } from "../endpoints/student/wallet/transactions_GET.schema";

export const STUDENT_WALLET_BALANCE_QUERY_KEY = ["student", "wallet", "balance"] as const;

export const useStudentWalletBalance = () => {
  return useQuery<BalanceType, Error>({
    queryKey: STUDENT_WALLET_BALANCE_QUERY_KEY,
    queryFn: () => getStudentWalletBalance(),
  });
};

export const useStudentWalletTransactions = (params: TransactionInput) => {
  return useQuery<TransactionsType, Error>({
    queryKey: ["student", "wallet", "transactions", params.page, params.limit],
    queryFn: () => getStudentWalletTransactions(params),
    placeholderData: keepPreviousData,
  });
};