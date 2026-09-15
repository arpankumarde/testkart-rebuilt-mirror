import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "../endpoints/auth/session_GET.schema";
import { postLogout } from "../endpoints/auth/logout_POST.schema";
import { User } from "./User";
import {
  announceSessionChange,
  onAuthFailure,
  onSessionChangedElsewhere,
} from "./sessionSync";

// React Query key for auth session. Make sure to optimistically update user infos using this.
export const AUTH_QUERY_KEY = ["auth", "session"] as const;

type SessionData = { user: User; impersonatorAdminId?: number };

// Do not use this state in login/register UI because it's irrelevant. Only use it in UI that requires authentication.
// For pages that requires authentication only in parts of the UI (e.g. typical home page with a user avatar), the loading
// state should not apply to the full page, only to the parts that require authentication.
// Also, global context providers should not be blocked on auth states as it will block the whole page.
type AuthState =
  | {
      // Make sure to display a nice loading state UI when loading authentication state
      type: "loading";
    }
  | {
      type: "authenticated";
      user: User;
      impersonatorAdminId?: number;
    }
  | {
      // Make sure to redirect to login or show auth error UI
      type: "unauthenticated";
      errorMessage?: string;
    };

type AuthContextType = {
  // Use this to display the correct UI based on auth state
  authState: AuthState;
  // Notify the auth provider that we have logged in
  onLogin: (user: User) => void;
  // Clear the auth state and perform the logout request
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Add this to components/_globalContextProviders but not any pageLayout files.
// Make sure it's within the QueryClientProvider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  const { data, error, status, refetch } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const result = await getSession();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result;
    },
    retry: 1,
    enabled: true,
    staleTime: Infinity,
  });

  // The session query never goes stale, so a session that ends after it loaded (another tab stopped impersonating
  // or logged out, or the session expired) must be caught here, or protected pages keep failing every request.
  useEffect(() => {
    const signedInUserId = () => {
      const state = queryClient.getQueryState<SessionData | null>(AUTH_QUERY_KEY);
      return state?.status === "success" ? (state.data?.user.id ?? null) : null;
    };

    const unsubscribeFailure = onAuthFailure(() => {
      if (signedInUserId() === null) return;
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }, { cancelRefetch: false });
    });

    const unsubscribeChange = onSessionChangedElsewhere(async () => {
      const previousUserId = signedInUserId();
      await queryClient.refetchQueries({ queryKey: AUTH_QUERY_KEY });
      if (signedInUserId() !== previousUserId) {
        queryClient.resetQueries();
      }
    });

    return () => {
      unsubscribeFailure();
      unsubscribeChange();
    };
  }, [queryClient]);

  const authState: AuthState =
    status === "pending"
      ? { type: "loading" }
      : status === "error"
        ? {
            type: "unauthenticated",
            errorMessage:
              error instanceof Error ? error.message : "Session check failed",
          }
        : data
          ? { type: "authenticated", user: data.user, impersonatorAdminId: data.impersonatorAdminId }
          : { type: "unauthenticated" };

  const logout = useCallback(async () => {
    // Optimistically update UI
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    // Make the actual API call
    await postLogout();
    announceSessionChange();
    // Invalidate all queries after login so previous user's state don't corrupt new user state.
    queryClient.resetQueries();
  }, [queryClient]);

  // This should only be used for login. For user profile changes, create separate endpoints and react query hooks
  // and update the data linked to AUTH_QUERY_KEY.
  // Login responses carry only part of the user (no slug, bio, tagline...) and this query never goes stale, so the
  // full session is loaded straight after. Profile forms seeded from the partial user saved blanks over stored values.
  const onLogin = useCallback(
    (user: User) => {
      queryClient.setQueryData<SessionData | null>(AUTH_QUERY_KEY, { user });
      announceSessionChange();
      getSession()
        .then((result) => {
          if ("error" in result) return;
          queryClient.setQueryData<SessionData | null>(
            AUTH_QUERY_KEY,
            (current) => (current?.user.id === result.user.id ? result : current)
          );
        })
        .catch((error) => console.error("Failed to load the full session after login:", error));
    },
    [queryClient]
  );

  return (
    <AuthContext.Provider value={{ authState, logout, onLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

// Prefer using protectedRoutes instead of this hook unless the route doesn't need to be protected (e.g. login/register)
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};
