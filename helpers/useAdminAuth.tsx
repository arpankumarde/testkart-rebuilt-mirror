import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminSession } from "../endpoints/admin/session_GET.schema";
import { postAdminLogout } from "../endpoints/admin/logout_POST.schema";
import { AdminProfile } from "./AdminTypes";

export const ADMIN_AUTH_QUERY_KEY = ["auth", "admin", "session"] as const;

type AdminAuthState =
  | {
      type: "loading";
    }
  | {
      type: "authenticated";
      admin: AdminProfile;
    }
  | {
      type: "unauthenticated";
      errorMessage?: string;
    };

type AdminAuthContextType = {
  authState: AdminAuthState;
  onLogin: (admin: AdminProfile) => void;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
  undefined
);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  const { data, error, status } = useQuery({
    queryKey: ADMIN_AUTH_QUERY_KEY,
    queryFn: async () => {
      const result = await getAdminSession();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result.admin;
    },
    retry: 1,
    staleTime: Infinity,
  });

  const authState: AdminAuthState =
    status === "pending"
      ? { type: "loading" }
      : status === "error"
      ? {
          type: "unauthenticated",
          errorMessage:
            error instanceof Error ? error.message : "Session check failed",
        }
      : data
      ? { type: "authenticated", admin: data }
      : { type: "unauthenticated" };

  const logout = useCallback(async () => {
    queryClient.setQueryData(ADMIN_AUTH_QUERY_KEY, null);
    await postAdminLogout();
    queryClient.resetQueries({ queryKey: ADMIN_AUTH_QUERY_KEY });
  }, [queryClient]);

  const onLogin = useCallback(
    (admin: AdminProfile) => {
      queryClient.setQueryData(ADMIN_AUTH_QUERY_KEY, admin);
    },
    [queryClient]
  );

  return (
    <AdminAuthContext.Provider value={{ authState, logout, onLogin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};