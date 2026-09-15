export const getSessionId = (): string => {
  try {
    let sessionId = localStorage.getItem("testkart_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("testkart_session_id", sessionId);
    }
    return sessionId;
  } catch (e) {
    // Fallback if localStorage or crypto fails (e.g., in non-secure contexts)
    return "temp-" + Math.random().toString(36).substring(2);
  }
};