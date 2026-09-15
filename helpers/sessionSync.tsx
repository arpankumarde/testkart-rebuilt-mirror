// Keeps every open tab's auth state in step with the one session cookie the browser shares.
// Stopping impersonation or logging out in one tab clears that cookie for all of them, but the
// auth query never goes stale, so other tabs kept rendering signed-in pages whose requests failed.

const CHANNEL_NAME = "testkart-auth-session";

export const SESSION_ENDED_UPLOAD_MESSAGE = "Your session has ended. Sign in again to upload.";

const NOT_AUTHENTICATED_MESSAGES = new Set(["not authenticated", "user not authenticated"]);

export function isNotAuthenticatedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return NOT_AUTHENTICATED_MESSAGES.has(error.message.trim().toLowerCase());
}

type Listener = () => void;

const sessionChangeListeners = new Set<Listener>();
const authFailureListeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel || typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return channel;
  }
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => sessionChangeListeners.forEach((listener) => listener());
  } catch {
    channel = null;
  }
  return channel;
}

/** Tells the other tabs of this browser that the session changed. The calling tab is not notified. */
export function announceSessionChange(): void {
  try {
    getChannel()?.postMessage("changed");
  } catch {
    // Without a channel, other tabs still recover on their next "not authenticated" response.
  }
}

export function onSessionChangedElsewhere(listener: Listener): () => void {
  getChannel();
  sessionChangeListeners.add(listener);
  return () => {
    sessionChangeListeners.delete(listener);
  };
}

/** Passes "not authenticated" errors on to the auth provider; any other error is ignored. */
export function reportAuthFailure(error: unknown): void {
  if (!isNotAuthenticatedError(error)) return;
  authFailureListeners.forEach((listener) => listener());
}

export function onAuthFailure(listener: Listener): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}
