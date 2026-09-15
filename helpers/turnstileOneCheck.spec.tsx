import React, { createRef } from "react";
import superjson from "superjson";
import { render, act, fireEvent, waitFor, cleanup, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TurnstileWidget, TurnstileWidgetHandle } from "../components/TurnstileWidget";
import { MobileOTPLoginForm } from "../components/MobileOTPLoginForm";
import { AuthProvider } from "./useAuth";

type RenderOptions = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];

function installFakeTurnstile() {
  const widgets: RenderOptions[] = [];
  const api = {
    render: jasmine.createSpy("render").and.callFake((_el: HTMLElement, options: RenderOptions) => {
      widgets.push(options);
      return `w${widgets.length}`;
    }),
    reset: jasmine.createSpy("reset"),
    remove: jasmine.createSpy("remove"),
    getResponse: () => undefined,
  };
  window.turnstile = api;
  return { api, last: () => widgets[widgets.length - 1] };
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// Jasmine's expect records a failure instead of throwing, so waitFor needs a
// condition that throws to keep retrying.
const until = (condition: () => boolean) =>
  waitFor(() => {
    if (!condition()) throw new Error("condition not met yet");
  });

const settled = async <T,>(promise: Promise<T>) => {
  let done = false;
  let value: T | undefined;
  promise.then((v) => {
    done = true;
    value = v;
  });
  await flush();
  return { done, value };
};

async function drainLeftoverToken() {
  installFakeTurnstile();
  const ref = createRef<TurnstileWidgetHandle>();
  const view = render(<TurnstileWidget ref={ref} />);
  await flush();
  void ref.current!.getToken();
  await flush();
  view.unmount();
}

describe("TurnstileWidget one check per send", () => {
  beforeEach(async () => {
    await drainLeftoverToken();
  });

  afterEach(() => {
    cleanup();
  });

  it("hands the first send the token minted on load without re-running the challenge", async () => {
    const { api, last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    const onVerify = jasmine.createSpy("onVerify");
    render(<TurnstileWidget ref={ref} onVerify={onVerify} />);
    await flush();

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(last()["refresh-expired"]).toBe("never");
    act(() => last().callback!("t1"));
    expect(onVerify).toHaveBeenCalledWith("t1");

    expect(await ref.current!.getToken()).toBe("t1");
    expect(api.reset).not.toHaveBeenCalled();
  });

  it("runs one new challenge for the next send and shares it between concurrent callers", async () => {
    const { api, last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} />);
    await flush();
    act(() => last().callback!("t1"));
    await ref.current!.getToken();

    const first = ref.current!.getToken();
    const second = ref.current!.getToken();
    expect(first).toBe(second);
    expect(api.reset).toHaveBeenCalledTimes(1);
    expect((await settled(first)).done).toBe(false);

    act(() => last().callback!("t2"));
    expect(await first).toBe("t2");
  });

  it("does nothing in the background when a token expires, and re-mints on demand", async () => {
    const { api, last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} />);
    await flush();
    act(() => last().callback!("t1"));
    act(() => last()["expired-callback"]!());
    expect(api.reset).not.toHaveBeenCalled();

    const pending = ref.current!.getToken();
    expect(api.reset).toHaveBeenCalledTimes(1);
    act(() => last().callback!("t2"));
    expect(await pending).toBe("t2");
  });

  it("resolves null when the challenge errors while a send is waiting", async () => {
    const { last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} />);
    await flush();

    const pending = ref.current!.getToken();
    act(() => last()["error-callback"]!());
    expect(await pending).toBeNull();
  });

  it("does not hand out a token older than its lifetime", async () => {
    const { api, last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} />);
    await flush();
    const start = Date.now();
    act(() => last().callback!("old"));

    spyOn(Date, "now").and.returnValue(start + 280_000);
    const pending = ref.current!.getToken();
    expect(api.reset).toHaveBeenCalledTimes(1);
    act(() => last().callback!("new"));
    expect(await pending).toBe("new");
  });

  it("carries an unspent token to the next widget instead of challenging again", async () => {
    const { api, last } = installFakeTurnstile();
    const firstRef = createRef<TurnstileWidgetHandle>();
    const firstView = render(<TurnstileWidget ref={firstRef} />);
    await flush();
    act(() => last().callback!("carried"));
    firstView.unmount();

    const ref = createRef<TurnstileWidgetHandle>();
    const onVerify = jasmine.createSpy("onVerify");
    render(<TurnstileWidget ref={ref} onVerify={onVerify} />);
    await flush();
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("carried");
    expect(await ref.current!.getToken()).toBe("carried");

    const pending = ref.current!.getToken();
    await flush();
    expect(api.render).toHaveBeenCalledTimes(2);
    act(() => last().callback!("fresh"));
    expect(await pending).toBe("fresh");
  });

  it("keeps auto refresh and reset() for the mobile app bridge", async () => {
    const { api, last } = installFakeTurnstile();
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} refreshExpired="auto" />);
    await flush();
    expect(last()["refresh-expired"]).toBe("auto");
    act(() => last().callback!("t1"));
    ref.current!.reset();
    expect(api.reset).toHaveBeenCalledTimes(1);
  });
});

describe("MobileOTPLoginForm with Turnstile", () => {
  beforeEach(async () => {
    await drainLeftoverToken();
  });

  afterEach(() => {
    cleanup();
  });

  it("asks for one check per send and never re-challenges after the OTP goes out", async () => {
    const { api, last } = installFakeTurnstile();
    const sendBodies: { turnstileToken?: string }[] = [];
    const fakeResponse = (status: number, body: unknown) =>
      ({
        ok: status < 400,
        status,
        headers: new Headers(),
        text: async () => superjson.stringify(body),
        json: async () => JSON.parse(superjson.stringify(body)),
      }) as unknown as Response;

    spyOn(globalThis, "fetch").and.callFake(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("mobile-login/send-otp")) {
        sendBodies.push(superjson.parse(String(init?.body)));
        return sendBodies.length === 1
          ? fakeResponse(429, { error: "Please wait before retrying" })
          : fakeResponse(200, { success: true, message: "sent" });
      }
      return fakeResponse(401, { error: "Not authenticated" });
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter>
            <MobileOTPLoginForm />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await flush();

    const sendButton = screen.getByRole("button", { name: "Send OTP" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    act(() => last().callback!("t1"));
    expect(sendButton.disabled).toBe(false);

    fireEvent.change(screen.getByPlaceholderText("Enter your 10-digit mobile number"), {
      target: { value: "9876543210" },
    });
    fireEvent.click(sendButton);
    await until(() => sendBodies.length === 1);
    expect(sendBodies[0].turnstileToken).toBe("t1");
    await until(() => screen.queryByText("Please wait before retrying") !== null);
    expect(api.reset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send OTP" }));
    await until(() => api.reset.calls.count() > 0);
    expect(api.reset).toHaveBeenCalledTimes(1);
    expect(sendBodies.length).toBe(1);
    act(() => last().callback!("t2"));
    await until(() => sendBodies.length === 2);
    expect(sendBodies[1].turnstileToken).toBe("t2");

    await until(() => screen.queryByText(/Enter the 4-digit OTP/) !== null);
    await flush();
    expect(api.reset).toHaveBeenCalledTimes(1);
    expect(api.render).toHaveBeenCalledTimes(1);
  });
});