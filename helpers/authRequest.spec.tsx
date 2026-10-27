import superjson from "superjson";
import {
  AUTH_ERROR_MESSAGES,
  AUTH_REQUEST_TIMEOUT_MS,
  AuthRequestError,
  postAuthRequest,
} from "./authRequest";

const respond = (status: number, text: string, headers: Record<string, string> = {}) =>
  ({
    ok: status < 400,
    status,
    headers: new Headers(headers),
    text: async () => text,
  }) as unknown as Response;

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  respond(status, superjson.stringify(body), headers);

async function failureOf(promise: Promise<unknown>): Promise<AuthRequestError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AuthRequestError) return err;
    throw err;
  }
  throw new Error("expected the request to fail");
}

describe("postAuthRequest", () => {
  it("returns the parsed body on success", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(json(200, { success: true, message: "sent" }));
    expect(await postAuthRequest("/_api/x", { a: 1 })).toEqual({ success: true, message: "sent" });
  });

  it("fails fast without a request when the browser is offline", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    spyOnProperty(navigator, "onLine").and.returnValue(false);
    const err = await failureOf(postAuthRequest("/_api/x", {}));
    expect(err.kind).toBe("offline");
    expect(err.message).toBe(AUTH_ERROR_MESSAGES.offline);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("times out a request that never answers", async () => {
    spyOn(globalThis, "fetch").and.callFake(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    jasmine.clock().install();
    try {
      const pending = failureOf(postAuthRequest("/_api/x", {}));
      jasmine.clock().tick(AUTH_REQUEST_TIMEOUT_MS);
      const err = await pending;
      expect(err.kind).toBe("timeout");
      expect(err.message).toBe(AUTH_ERROR_MESSAGES.timeout);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it("reports an unreachable server as a network problem", async () => {
    spyOn(globalThis, "fetch").and.rejectWith(new TypeError("Failed to fetch"));
    const err = await failureOf(postAuthRequest("/_api/x", {}));
    expect(err.kind).toBe("network");
    expect(err.message).toBe(AUTH_ERROR_MESSAGES.network);
  });

  it("keeps the server's rate-limit message and wait time", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(
      json(429, { error: "Please wait 30 seconds before requesting another OTP.", retryAfterSeconds: 30 })
    );
    const err = await failureOf(postAuthRequest("/_api/x", {}));
    expect(err.kind).toBe("rate_limited");
    expect(err.message).toBe("Please wait 30 seconds before requesting another OTP.");
    expect(err.retryAfterSeconds).toBe(30);
  });

  it("reads the wait time from Retry-After when the body has none", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(json(429, { error: "Slow down" }, { "Retry-After": "12" }));
    expect((await failureOf(postAuthRequest("/_api/x", {}))).retryAfterSeconds).toBe(12);
  });

  it("turns a gateway HTML page into the generic server message", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(respond(502, "<html>Bad Gateway</html>"));
    const err = await failureOf(postAuthRequest("/_api/x", {}));
    expect(err.kind).toBe("server");
    expect(err.message).toBe(AUTH_ERROR_MESSAGES.server);
  });

  it("keeps a readable message from one of our own 500s", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(json(500, { error: "Failed to send OTP. Please try again." }));
    expect((await failureOf(postAuthRequest("/_api/x", {}))).message).toBe(
      "Failed to send OTP. Please try again."
    );
  });

  it("flattens a Zod issue array into its messages", async () => {
    spyOn(globalThis, "fetch").and.resolveTo(
      json(400, { error: [{ message: "Invalid email address" }] })
    );
    const err = await failureOf(postAuthRequest("/_api/x", {}));
    expect(err.kind).toBe("invalid");
    expect(err.message).toBe("Invalid email address");
  });
});
