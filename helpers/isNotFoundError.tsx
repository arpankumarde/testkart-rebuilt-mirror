// Public detail endpoints and their *Server prefetch twins report a missing, deleted or
// unpublished item with a message naming it ("Course not found or not published",
// "This mock test is not available for public viewing."), so the message decides when no
// HTTP status is attached. Some fetch wrappers only keep the status ("Request failed with
// status 404"). Anything else (5xx, network, parse failures) is a real error.
const NOT_FOUND_MESSAGE = /not found|not published|not available|status 404\b/i;

export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { status?: unknown }).status === 404) return true;
  return error instanceof Error && NOT_FOUND_MESSAGE.test(error.message);
}
